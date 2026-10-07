import { createHmac, randomBytes } from "node:crypto";

/** Ký request theo OAuth 1.0a (HMAC-SHA1) — dùng cho X với 4 key: API key/secret + Access token/secret. */
const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export type OAuth1Keys = { api_key: string; api_secret: string; access_token: string; access_token_secret: string };

export function oauth1Header(method: string, url: string, k: OAuth1Keys, fixed?: { nonce: string; timestamp: string }) {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: k.api_key,
    oauth_nonce: fixed?.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: fixed?.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: k.access_token,
    oauth_version: "1.0",
  };
  const params: [string, string][] = [...Object.entries(oauth), ...u.searchParams.entries()];
  const paramStr = params
    .map(([a, b]) => [enc(a), enc(b)] as const)
    .sort((x, y) => (x[0] === y[0] ? (x[1] < y[1] ? -1 : 1) : x[0] < y[0] ? -1 : 1))
    .map(([a, b]) => `${a}=${b}`)
    .join("&");
  const base = [method.toUpperCase(), enc(u.origin + u.pathname), enc(paramStr)].join("&");
  const signature = createHmac("sha1", `${enc(k.api_secret)}&${enc(k.access_token_secret)}`).update(base).digest("base64");
  return (
    "OAuth " +
    Object.entries({ ...oauth, oauth_signature: signature })
      .map(([a, b]) => `${enc(a)}="${enc(b)}"`)
      .join(", ")
  );
}
