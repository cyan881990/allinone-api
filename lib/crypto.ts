import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("Thiếu ENCRYPTION_KEY");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY phải là 32 byte base64 (openssl rand -base64 32)");
  return buf;
}

/** AES-256-GCM → "v1.<iv>.<tag>.<data>" (base64url) */
export function encryptJSON(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptJSON<T = Record<string, unknown>>(payload: string): T {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1") throw new Error("Định dạng credentials không hợp lệ");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const out = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Sinh API key mới. Chỉ lưu hash; key thô hiển thị cho người dùng đúng 1 lần. */
export function generateApiKey() {
  const raw = "aio_" + randomBytes(24).toString("base64url");
  return { raw, prefix: raw.slice(0, 10), hash: sha256(raw) };
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
