import { jsonFetch, postForm } from "./http";
import type { Credentials } from "./types";

type Fresh = { access_token: string; refresh_token?: string; expires_at?: number; token_issued_at?: number };
type Refresher = {
  /** Có cần làm mới không */
  due: (c: Credentials) => boolean;
  refresh: (c: Credentials) => Promise<Fresh>;
};

const DAY = 86_400_000;
const exp = (sec?: number) => (sec ? Date.now() + sec * 1000 : undefined);
/** Token kiểu OAuth2 có refresh_token: làm mới khi thiếu hoặc sắp hết hạn */
const expiring = (c: Credentials) => !!c.refresh_token && (!c.access_token || (!!c.expires_at && c.expires_at - 60_000 <= Date.now()));

const refreshers: Record<string, Refresher> = {
  youtube: {
    due: expiring,
    async refresh(c) {
      const r = await postForm("https://oauth2.googleapis.com/token", {
        refresh_token: c.refresh_token,
        grant_type: "refresh_token",
        client_id: c.client_id,
        client_secret: c.client_secret,
      });
      return { access_token: r.access_token, refresh_token: r.refresh_token || c.refresh_token, expires_at: exp(r.expires_in) };
    },
  },
  tiktok: {
    due: expiring,
    async refresh(c) {
      const r = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
        refresh_token: c.refresh_token,
        grant_type: "refresh_token",
        client_key: c.client_key,
        client_secret: c.client_secret,
      });
      if (r.error) throw new Error(r.error_description || r.error);
      return { access_token: r.access_token, refresh_token: r.refresh_token || c.refresh_token, expires_at: exp(r.expires_in) };
    },
  },
  /**
   * Token dài hạn của Instagram Login (60 ngày): gia hạn khi còn dưới 15 ngày.
   * Điều kiện của Meta: token còn hạn và đã tạo được ít nhất 24 giờ.
   */
  instagram: {
    due: (c) =>
      c.host === "graph.instagram.com" &&
      !!c.access_token &&
      !!c.expires_at &&
      c.expires_at > Date.now() &&
      c.expires_at - Date.now() < 15 * DAY &&
      Date.now() - (c.token_issued_at || 0) > DAY,
    async refresh(c) {
      const r = await jsonFetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(c.access_token)}`,
      );
      return { access_token: r.access_token, expires_at: exp(r.expires_in || 60 * 86400), token_issued_at: Date.now() };
    },
  },
};

/**
 * Trả về access token dùng được. Nếu nền tảng hỗ trợ và token cần làm mới thì làm mới,
 * gọi onUpdate để lưu token mới (đã mã hoá). Làm mới thất bại nhưng token cũ còn hạn → vẫn dùng token cũ.
 */
export async function ensureFreshToken(platform: string, creds: Credentials, onUpdate: (c: Credentials) => Promise<void>) {
  const r = refreshers[platform];
  if (!r || !r.due(creds)) return creds.access_token as string;
  try {
    const next = { ...creds, ...(await r.refresh(creds)) };
    await onUpdate(next);
    Object.assign(creds, next);
    return next.access_token as string;
  } catch (e) {
    const stillValid = creds.access_token && (!creds.expires_at || creds.expires_at > Date.now());
    if (stillValid) return creds.access_token as string;
    throw e;
  }
}
