import "server-only";
import { createHash } from "node:crypto";
import { jsonFetch, postForm } from "./platforms/http";
import type { Credentials } from "./platforms/types";

export type TokenSet = { access_token: string; refresh_token?: string; expires_at?: number; [k: string]: any };

type OAuthProvider = {
  env: [string, string];
  authorizeUrl: string;
  scopes: string[];
  scopeSep?: string;
  pkce?: boolean;
  extraAuthParams?: Record<string, string>;
  clientIdParam?: string;
  exchange: (code: string, redirectUri: string, verifier?: string) => Promise<TokenSet>;
  refresh?: (creds: Credentials) => Promise<TokenSet>;
  profile: (t: TokenSet) => Promise<{ name: string; extra?: Record<string, any> }>;
};

const env = (k: string) => process.env[k] || "";
const exp = (sec?: number) => (sec ? Date.now() + sec * 1000 : undefined);
const basic = (id: string, secret: string) => "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");

export const providers: Record<string, OAuthProvider> = {
  youtube: {
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    async exchange(code, redirect_uri) {
      const r = await postForm("https://oauth2.googleapis.com/token", {
        code, redirect_uri, grant_type: "authorization_code",
        client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
      });
      return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp(r.expires_in) };
    },
    async refresh(c) {
      const r = await postForm("https://oauth2.googleapis.com/token", {
        refresh_token: c.refresh_token, grant_type: "refresh_token",
        client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
      });
      return { access_token: r.access_token, refresh_token: r.refresh_token || c.refresh_token, expires_at: exp(r.expires_in) };
    },
    async profile(t) {
      const r = await jsonFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${t.access_token}` },
      });
      const ch = r.items?.[0];
      return { name: ch?.snippet?.title || "YouTube", extra: { channel_id: ch?.id } };
    },
  },

  tiktok: {
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    scopes: ["user.info.basic", "video.publish", "video.upload"],
    scopeSep: ",",
    clientIdParam: "client_key",
    async exchange(code, redirect_uri) {
      const r = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
        code, redirect_uri, grant_type: "authorization_code",
        client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"),
      });
      if (r.error) throw new Error(r.error_description || r.error);
      return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp(r.expires_in), open_id: r.open_id };
    },
    async refresh(c) {
      const r = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
        refresh_token: c.refresh_token, grant_type: "refresh_token",
        client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"),
      });
      if (r.error) throw new Error(r.error_description || r.error);
      return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp(r.expires_in) };
    },
    async profile(t) {
      const r = await jsonFetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
        headers: { Authorization: `Bearer ${t.access_token}` },
      });
      return { name: r.data?.user?.display_name || "TikTok" };
    },
  },

  linkedin: {
    env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    scopes: ["openid", "profile", "w_member_social"],
    async exchange(code, redirect_uri) {
      const r = await postForm("https://www.linkedin.com/oauth/v2/accessToken", {
        code, redirect_uri, grant_type: "authorization_code",
        client_id: env("LINKEDIN_CLIENT_ID"), client_secret: env("LINKEDIN_CLIENT_SECRET"),
      });
      return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp(r.expires_in) };
    },
    async refresh(c) {
      if (!c.refresh_token) throw new Error("Token LinkedIn đã hết hạn — hãy kết nối lại");
      const r = await postForm("https://www.linkedin.com/oauth/v2/accessToken", {
        refresh_token: c.refresh_token, grant_type: "refresh_token",
        client_id: env("LINKEDIN_CLIENT_ID"), client_secret: env("LINKEDIN_CLIENT_SECRET"),
      });
      return { access_token: r.access_token, refresh_token: r.refresh_token || c.refresh_token, expires_at: exp(r.expires_in) };
    },
    async profile(t) {
      const r = await jsonFetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } });
      return { name: r.name || "LinkedIn", extra: { author: `urn:li:person:${r.sub}` } };
    },
  },

  x: {
    env: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"],
    pkce: true,
    async exchange(code, redirect_uri, verifier) {
      const r = await postForm(
        "https://api.x.com/2/oauth2/token",
        { code, redirect_uri, grant_type: "authorization_code", code_verifier: verifier, client_id: env("X_CLIENT_ID") },
        { Authorization: basic(env("X_CLIENT_ID"), env("X_CLIENT_SECRET")) },
      );
      return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp(r.expires_in) };
    },
    async refresh(c) {
      const r = await postForm(
        "https://api.x.com/2/oauth2/token",
        { refresh_token: c.refresh_token, grant_type: "refresh_token", client_id: env("X_CLIENT_ID") },
        { Authorization: basic(env("X_CLIENT_ID"), env("X_CLIENT_SECRET")) },
      );
      return { access_token: r.access_token, refresh_token: r.refresh_token || c.refresh_token, expires_at: exp(r.expires_in) };
    },
    async profile(t) {
      const r = await jsonFetch("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${t.access_token}` } });
      return { name: "@" + r.data?.username };
    },
  },
};

export const oauthConfigured = (platform: string) => {
  const p = providers[platform];
  return !!p && !!env(p.env[0]) && !!env(p.env[1]);
};

export const redirectUri = (platform: string) => `${(process.env.APP_URL || "").replace(/\/$/, "")}/api/oauth/${platform}/callback`;

export function buildAuthorizeUrl(platform: string, state: string, verifier?: string) {
  const p = providers[platform];
  const u = new URL(p.authorizeUrl);
  u.searchParams.set(p.clientIdParam || "client_id", env(p.env[0]));
  u.searchParams.set("redirect_uri", redirectUri(platform));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", p.scopes.join(p.scopeSep || " "));
  u.searchParams.set("state", state);
  for (const [k, v] of Object.entries(p.extraAuthParams || {})) u.searchParams.set(k, v);
  if (p.pkce && verifier) {
    u.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    u.searchParams.set("code_challenge_method", "S256");
  }
  return u.toString();
}

/** Trả về token còn hạn; refresh nếu sắp hết hạn và gọi onUpdate để lưu lại */
export async function ensureFreshToken(platform: string, creds: Credentials, onUpdate: (c: Credentials) => Promise<void>) {
  const p = providers[platform];
  if (!p || !creds.expires_at || creds.expires_at - 60_000 > Date.now()) return creds.access_token as string;
  if (!p.refresh) return creds.access_token as string;
  const t = await p.refresh(creds);
  const next = { ...creds, ...t };
  await onUpdate(next);
  return next.access_token as string;
}
