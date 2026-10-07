import { postForm } from "./http";
import type { Credentials } from "./types";

/** Làm mới access token từ refresh_token + client credentials mà người dùng đã dán vào API con. */
type Refresher = (c: Credentials) => Promise<{ access_token: string; refresh_token?: string; expires_at?: number }>;

const exp = (sec?: number) => (sec ? Date.now() + sec * 1000 : undefined);

const refreshers: Record<string, Refresher> = {
  async youtube(c) {
    const r = await postForm("https://oauth2.googleapis.com/token", {
      refresh_token: c.refresh_token,
      grant_type: "refresh_token",
      client_id: c.client_id,
      client_secret: c.client_secret,
    });
    return { access_token: r.access_token, refresh_token: r.refresh_token || c.refresh_token, expires_at: exp(r.expires_in) };
  },
  async tiktok(c) {
    const r = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
      refresh_token: c.refresh_token,
      grant_type: "refresh_token",
      client_key: c.client_key,
      client_secret: c.client_secret,
    });
    if (r.error) throw new Error(r.error_description || r.error);
    return { access_token: r.access_token, refresh_token: r.refresh_token || c.refresh_token, expires_at: exp(r.expires_in) };
  },
};

/**
 * Trả về access token còn hạn. Nền tảng có refresh_token sẽ tự làm mới khi thiếu/sắp hết hạn
 * và gọi onUpdate để lưu token mới (đã mã hoá) vào DB.
 */
export async function ensureFreshToken(platform: string, creds: Credentials, onUpdate: (c: Credentials) => Promise<void>) {
  const refresh = refreshers[platform];
  const valid = creds.access_token && (!creds.expires_at || creds.expires_at - 60_000 > Date.now());
  if (valid || !refresh || !creds.refresh_token) return creds.access_token as string;
  const t = await refresh(creds);
  const next = { ...creds, ...t };
  await onUpdate(next);
  Object.assign(creds, next);
  return next.access_token as string;
}
