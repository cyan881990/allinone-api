import "server-only";
import { jsonFetch, postForm } from "./platforms/http";

/**
 * Instagram API with Instagram Login (Business Login for Instagram).
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 */
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];
export const IG_STATE_TTL_MIN = 30;
const V = () => process.env.META_GRAPH_VERSION || "v26.0";

export const igRedirectUri = () => `${(process.env.APP_URL || "").replace(/\/$/, "")}/api/oauth/instagram/callback`;

/** App ID/Secret mặc định từ biến môi trường (tuỳ chọn) */
export const igEnvApp = () => ({ app_id: process.env.INSTAGRAM_APP_ID || "", app_secret: process.env.INSTAGRAM_APP_SECRET || "" });

export function igAuthorizeUrl(appId: string, state: string) {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", igRedirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("state", state);
  u.searchParams.set("enable_fb_login", "0");
  u.searchParams.set("force_reauth", "true"); // luôn hỏi đăng nhập, để chọn đúng tài khoản
  return u.toString();
}

/** code → token ngắn hạn (1 giờ). Instagram nối "#_" vào cuối code, phải cắt bỏ. */
export async function igExchangeCode(appId: string, appSecret: string, code: string) {
  const r = await postForm("https://api.instagram.com/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: igRedirectUri(),
    code: code.replace(/#_$/, ""),
  });
  const d = Array.isArray(r?.data) ? r.data[0] : r; // hỗ trợ cả 2 dạng phản hồi
  if (!d?.access_token) throw new Error("Instagram không trả access token");
  return { access_token: String(d.access_token), permissions: d.permissions as string | string[] | undefined };
}

/** token ngắn hạn → token dài hạn (60 ngày) */
export async function igLongLived(appSecret: string, shortToken: string) {
  const u = new URL("https://graph.instagram.com/access_token");
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("access_token", shortToken);
  const r = await jsonFetch(u.toString());
  return { access_token: String(r.access_token), expires_in: Number(r.expires_in) || 60 * 86400 };
}

/** user_id = ID tài khoản Instagram chuyên nghiệp, dùng để đăng bài */
export async function igMe(token: string) {
  const r = await jsonFetch(
    `https://graph.instagram.com/${V()}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(token)}`,
  );
  return { user_id: String(r.user_id || r.id), username: String(r.username || ""), account_type: r.account_type as string | undefined };
}

export type IgPrecheck = { problem: "app" | "secret" | "redirect" | null; message?: string };

/**
 * Kiểm tra nhanh App ID/Secret/Redirect URI trước khi đưa URL cho người dùng:
 * gửi một code giả tới endpoint đổi token và đọc lỗi Instagram trả về.
 * App/secret/redirect hợp lệ thì lỗi sẽ chỉ là "code không hợp lệ" → coi như ổn.
 * Lỗi mạng hoặc phản hồi lạ → bỏ qua (không chặn).
 */
export async function igPrecheck(appId: string, appSecret: string): Promise<IgPrecheck> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: igRedirectUri(),
        code: "aio-precheck",
      }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.error_message || j.error?.message || j.error_description || text;
    } catch {}
    msg = String(msg).slice(0, 300);
    if (/platform app|invalid client|client_id|invalid app|application.*(not|invalid)/i.test(msg)) return { problem: "app", message: msg };
    if (/client secret|app secret|client_secret/i.test(msg)) return { problem: "secret", message: msg };
    // Lỗi nói về code (vd "Error validating verification code… redirect_uri…") là bình thường với code giả → không cảnh báo
    if (/\bcode\b/i.test(msg)) return { problem: null, message: msg };
    if (/redirect/i.test(msg)) return { problem: "redirect", message: msg };
    return { problem: null, message: msg };
  } catch {
    return { problem: null };
  } finally {
    clearTimeout(timer);
  }
}
