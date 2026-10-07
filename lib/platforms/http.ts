import { PlatformError, type PostInput } from "./types";

export async function jsonFetch<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* không phải JSON */
  }
  if (!res.ok) {
    const msg =
      body?.error?.message ||
      body?.error_description ||
      body?.message ||
      body?.detail ||
      body?.title ||
      (typeof body?.error === "string" ? body.error : null) ||
      (typeof body === "string" ? body.slice(0, 300) : null) ||
      res.statusText;
    throw new PlatformError(`HTTP ${res.status}: ${msg}`, body);
  }
  return body as T;
}

export function postJSON<T = any>(url: string, data: unknown, headers: Record<string, string> = {}) {
  return jsonFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
}

export function postForm<T = any>(url: string, data: Record<string, string | undefined>, headers: Record<string, string> = {}) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== null) body.set(k, String(v));
  return jsonFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body,
  });
}

const MAX_DOWNLOAD = 512 * 1024 * 1024;

/** Tải file media về bộ nhớ (cho nền tảng yêu cầu upload byte) */
export async function download(url: string): Promise<{ buf: Buffer; type: string; size: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new PlatformError(`Không tải được media ${url}: HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_DOWNLOAD) throw new PlatformError("Media quá lớn (>512MB)");
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, type: res.headers.get("content-type") || "application/octet-stream", size: buf.length };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ghép text + link thành 1 chuỗi caption */
export function caption(input: PostInput, max?: number): string {
  const parts = [input.text?.trim(), input.link].filter(Boolean) as string[];
  let s = parts.join("\n\n");
  if (max && s.length > max) s = s.slice(0, max - 1) + "…";
  return s;
}

export const images = (i: PostInput) => i.media.filter((m) => m.type === "image");
export const videos = (i: PostInput) => i.media.filter((m) => m.type === "video");

export function need(creds: Record<string, any>, ...keys: string[]) {
  for (const k of keys) if (!creds[k]) throw new PlatformError(`Thiếu trường "${k}" trong cấu hình API con`);
}
