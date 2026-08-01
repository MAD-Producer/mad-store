// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmitForm } from "./SubmitForm";

vi.mock("@/components/LicenseSelector", () => ({
  LicenseSelector: () => <input type="hidden" name="license" value="MIT" />,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SubmitForm", () => {
  it("sends only one request while the first submission is pending", () => {
    const pendingResponse = new Promise<Response>(() => undefined);
    const fetchMock = vi.fn(() => pendingResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <SubmitForm settings={{ categories: [], tags: ["工具"] }} />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("submits a website with only its three required fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "已收到" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    render(<SubmitForm settings={{ categories: [], tags: ["工具"] }} />);
    fireEvent.click(screen.getByRole("tab", { name: "网站" }));
    fireEvent.change(screen.getByLabelText(/^网站名称/), { target: { value: "MAD Producer" } });
    fireEvent.change(screen.getByLabelText(/^网站链接/), { target: { value: "https://madproducer.cn" } });
    fireEvent.change(screen.getByLabelText(/^网站介绍/), { target: { value: "MAD 创作者社区" } });
    fireEvent.submit(screen.getByRole("button", { name: "提交网站" }).closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/websites");
    expect(JSON.parse(String(options.body))).toEqual(expect.objectContaining({
      name: "MAD Producer",
      url: "https://madproducer.cn",
      description: "MAD 创作者社区",
      tags: [],
    }));
  });
});
