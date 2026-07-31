import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "mad_admin_session";
const MAX_AGE = 60 * 60 * 12;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sessionSecret() {
  const explicit = process.env.ADMIN_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const accounts = process.env.ADMIN_ACCOUNTS?.trim();
  if (accounts) return accounts;
  const password = process.env.ADMIN_PASSWORD;
  if (password) return `${process.env.ADMIN_USERNAME || "admin"}:${password}`;
  return "";
}

function signature(payload: string) {
  const secret = sessionSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function hasAdminSessionSecret() {
  return Boolean(sessionSecret());
}

function adminAccounts() {
  const raw = process.env.ADMIN_ACCOUNTS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<{ username?: unknown; password?: unknown }>;
      return parsed
        .filter(
          (account): account is { username: string; password: string } =>
            typeof account.username === "string" &&
            typeof account.password === "string" &&
            Boolean(account.username.trim()) &&
            Boolean(account.password),
        )
        .map((account) => ({ username: account.username.trim(), password: account.password }));
    } catch {
      return [];
    }
  }
  return process.env.ADMIN_PASSWORD
    ? [{ username: process.env.ADMIN_USERNAME || "admin", password: process.env.ADMIN_PASSWORD }]
    : [];
}

export function verifyAdminCredentials(username: string, password: string) {
  const normalizedUsername = username.trim();
  const account = adminAccounts().find((item) => safeEqual(item.username, normalizedUsername));
  return account && safeEqual(account.password, password) ? account.username : null;
}

export function createSessionToken(username: string) {
  if (!hasAdminSessionSecret()) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const identity = Buffer.from(username).toString("base64url");
  const payload = `${identity}.${timestamp}`;
  return `${payload}.${signature(payload)}`;
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

export async function isAdmin() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [identity, timestamp, providedSignature] = token.split(".");
  if (!identity || !timestamp || !providedSignature) return false;
  const payload = `${identity}.${timestamp}`;
  if (!signature(payload) || !safeEqual(providedSignature, signature(payload))) return false;
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= MAX_AGE;
}

export function hasValidOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}
