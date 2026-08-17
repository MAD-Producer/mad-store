"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PROXY_DOWNLOAD_CHUNK_SIZE } from "@/lib/proxy-downloads";

const MAX_RETRIES = 3;
const CONCURRENT_CHUNKS = 3;

type DownloadFileInfo = {
  contentType: string;
  filename: string;
  total: number;
};

type WritableDownload = {
  write(data: unknown): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
};

type SaveFileHandle = {
  createWritable(): Promise<WritableDownload>;
};

type PickerWindow = Window & {
  showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<SaveFileHandle>;
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let size = value;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function decodeFilename(value: string) {
  const clean = value.trim().replace(/^['"]|['"]$/g, "");
  try {
    return decodeURIComponent(clean);
  } catch {
    return clean;
  }
}

function filenameFromResponse(contentDisposition: string | null, target: string) {
  const encoded = contentDisposition?.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)?.[1];
  if (encoded) return decodeFilename(encoded);
  const plain = contentDisposition?.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1];
  if (plain) return decodeFilename(plain);

  const pathname = new URL(target).pathname.replace(/\/+$/, "");
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return decodeFilename(lastSegment) || "download";
}

function totalFromContentRange(value: string | null) {
  const total = value?.match(/\/([0-9]+)$/)?.[1];
  const parsed = total ? Number(total) : 0;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function resolveTarget(rawTarget: string) {
  const origin = typeof window === "undefined" ? "https://store.invalid" : window.location.origin;
  const target = new URL(rawTarget, origin);
  if (
    (typeof window !== "undefined" && target.origin !== window.location.origin) ||
    (!target.pathname.startsWith("/https:/") && !target.pathname.startsWith("/https://"))
  ) {
    throw new Error("下载地址无效");
  }
  return target.toString();
}

async function inspectTarget(target: string, signal: AbortSignal): Promise<DownloadFileInfo> {
  const head = await fetch(target, { method: "HEAD", cache: "no-store", signal });
  if (!head.ok) throw new Error(`代理返回了 ${head.status}，暂时无法下载`);

  let total = Number(head.headers.get("content-length")) || 0;
  let contentDisposition = head.headers.get("content-disposition");
  let contentType = head.headers.get("content-type") || "application/octet-stream";

  // Some serverless platforms remove Content-Length from a HEAD response. A one-byte
  // probe still reveals the complete size through Content-Range without moving the file.
  if (!total) {
    const probe = await fetch(target, {
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
      signal,
    });
    if (!probe.ok && probe.status !== 206) {
      throw new Error(`无法读取文件大小（${probe.status}）`);
    }
    total = totalFromContentRange(probe.headers.get("content-range"));
    contentDisposition ||= probe.headers.get("content-disposition");
    contentType = probe.headers.get("content-type") || contentType;
  }

  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error("上游没有返回可用的文件大小");
  }

  return {
    contentType,
    filename: filenameFromResponse(contentDisposition, target),
    total,
  };
}

async function fetchChunk(
  target: string,
  start: number,
  end: number,
  signal: AbortSignal,
) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(target, {
        headers: { Range: `bytes=${start}-${end}` },
        cache: "no-store",
        signal,
      });
      if (!response.ok && response.status !== 206) {
        throw new Error(`分片请求失败（${response.status}）`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const expected = end - start + 1;
      if (bytes.byteLength > PROXY_DOWNLOAD_CHUNK_SIZE || bytes.byteLength > expected) {
        throw new Error("上游返回的分片大小异常");
      }
      if (response.status === 200 || bytes.byteLength !== expected) {
        throw new Error("上游没有按 Range 返回完整分片");
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("分片下载失败");
}

export function DownloadProxyClient({ target: rawTarget }: { target: string }) {
  const target = useMemo(() => {
    try {
      return resolveTarget(rawTarget);
    } catch {
      return null;
    }
  }, [rawTarget]);
  const [fileInfo, setFileInfo] = useState<DownloadFileInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("正在读取文件信息…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    if (!target) {
      return () => controller.abort();
    }

    inspectTarget(target, controller.signal)
      .then((info) => {
        if (disposed) return;
        setFileInfo(info);
        setStatus("文件已准备好，可以开始分片下载");
      })
      .catch((reason: unknown) => {
        if (disposed || controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "无法读取文件信息");
        setStatus("下载准备失败");
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [target]);

  async function startDownload() {
    if (!target || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    let writer: WritableDownload | null = null;
    const fallbackChunks: Uint8Array[] = [];

    try {
      setBusy(true);
      setCompleted(false);
      setError("");
      setProgress(0);
      setStatus("正在准备分片下载…");

      const picker = (window as PickerWindow).showSaveFilePicker;
      if (picker) {
        const handle = await picker({ suggestedName: fileInfo?.filename || "download" });
        writer = await handle.createWritable();
      }

      const info = fileInfo || await inspectTarget(target, controller.signal);
      setFileInfo(info);
      const totalChunks = Math.ceil(info.total / PROXY_DOWNLOAD_CHUNK_SIZE);
      let completedBytes = 0;

      for (let batchStart = 0; batchStart < totalChunks; batchStart += CONCURRENT_CHUNKS) {
        const batch = Array.from(
          { length: Math.min(CONCURRENT_CHUNKS, totalChunks - batchStart) },
          (_, offset) => {
            const chunkIndex = batchStart + offset;
            const start = chunkIndex * PROXY_DOWNLOAD_CHUNK_SIZE;
            const end = Math.min(info.total - 1, start + PROXY_DOWNLOAD_CHUNK_SIZE - 1);
            return { chunkIndex, start, end };
          },
        );
        const chunks = await Promise.all(
          batch.map(({ start, end }) => fetchChunk(target, start, end, controller.signal)),
        );

        for (let index = 0; index < batch.length; index += 1) {
          const { start } = batch[index];
          const bytes = chunks[index];
          if (writer) {
            await writer.write({ type: "write", position: start, data: bytes });
          } else {
            fallbackChunks.push(bytes);
          }
          completedBytes += bytes.byteLength;
          setProgress(Math.min(100, Math.round((completedBytes / info.total) * 100)));
        }
      }

      if (writer) {
        await writer.close();
      } else {
        const blobParts = fallbackChunks.map((chunk) => {
          const copy = new Uint8Array(chunk.byteLength);
          copy.set(chunk);
          return copy.buffer;
        });
        const blob = new Blob(blobParts, { type: info.contentType });
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = info.filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
      }
      setProgress(100);
      setCompleted(true);
      setStatus("下载完成");
    } catch (reason) {
      if (writer) {
        try {
          await writer.abort?.();
        } catch {
          // The partial file is already unusable; keep the original download error visible.
        }
      }
      if (controller.signal.aborted) {
        setStatus("下载已取消");
      } else {
        setError(reason instanceof Error ? reason.message : "分片下载失败，请重试");
        setStatus("下载失败");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function cancelDownload() {
    abortRef.current?.abort();
  }

  const visibleError = error || (!target ? "下载地址无效" : "");
  const visibleStatus = !target ? "下载准备失败" : status;

  return (
    <main className="download-proxy-page">
      <section className="download-proxy-card" aria-live="polite">
        <span className="eyebrow"><i />本站分片下载</span>
        <h1>{fileInfo?.filename || "准备下载"}</h1>
        <p className="download-proxy-description">
          大文件会拆成多个 4 MiB 分片，并行请求后直接写入本地文件，避免单次请求超过平台限制。
        </p>
        <div className="download-proxy-meta">
          <span>文件大小</span>
          <strong>{fileInfo ? formatBytes(fileInfo.total) : "读取中…"}</strong>
        </div>
        <div className="download-proxy-progress" aria-label={`下载进度 ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="download-proxy-status">
          <span>{visibleStatus}</span>
          <strong>{busy || completed ? `${progress}%` : ""}</strong>
        </div>
        {visibleError ? <p className="form-error" role="alert">{visibleError}</p> : null}
        <div className="download-proxy-actions">
          <button
            className="submit-button"
            type="button"
            disabled={busy || !target || Boolean(error && !fileInfo)}
            onClick={startDownload}
          >
            {completed ? "再次下载" : busy ? "正在分片下载…" : "开始分片下载"}
          </button>
          {busy ? (
            <button className="download-proxy-cancel" type="button" onClick={cancelDownload}>
              取消
            </button>
          ) : null}
        </div>
        <p className="download-proxy-note">
          Chrome、Edge 等现代浏览器会优先直接写入你选择的文件；不支持时将使用浏览器内存合并下载。
        </p>
      </section>
    </main>
  );
}
