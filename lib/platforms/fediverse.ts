import { caption, download, images, jsonFetch, need, postJSON, sleep } from "./http";
import { PlatformError, type PlatformDef } from "./types";

/* ---------------- Bluesky ---------------- */
async function bskySession(c: Record<string, any>) {
  const service = (c.service || "https://bsky.social").replace(/\/$/, "");
  const s = await postJSON(`${service}/xrpc/com.atproto.server.createSession`, {
    identifier: c.identifier,
    password: c.app_password,
  });
  return { service, did: s.did as string, jwt: s.accessJwt as string, handle: s.handle as string };
}

/** Tạo facet cho link để link bấm được (offset tính theo byte UTF-8) */
function linkFacets(text: string) {
  const enc = new TextEncoder();
  const facets: any[] = [];
  const re = /https?:\/\/[^\s)]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = enc.encode(text.slice(0, m.index)).length;
    const end = start + enc.encode(m[0]).length;
    facets.push({ index: { byteStart: start, byteEnd: end }, features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }] });
  }
  return facets;
}

export const bluesky: PlatformDef = {
  id: "bluesky",
  name: "Bluesky",
  color: "#1185FE",
  auth: "token",
  supports: { text: true, image: true, video: false, multiImage: true },
  fields: [
    { key: "identifier", label: "Handle", placeholder: "ten.bsky.social" },
    { key: "app_password", label: "App password", type: "password", help: "Settings → Privacy and security → App passwords" },
    { key: "service", label: "PDS (tuỳ chọn)", placeholder: "https://bsky.social", optional: true },
  ],
  async verify(c) {
    need(c, "identifier", "app_password");
    return "@" + (await bskySession(c)).handle;
  },
  async publish(input, { credentials: c }) {
    const s = await bskySession(c);
    const text = caption(input, 300);
    const record: any = { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString() };
    const facets = linkFacets(text);
    if (facets.length) record.facets = facets;

    const imgs = images(input).slice(0, 4);
    if (imgs.length) {
      const uploaded = [];
      for (const img of imgs) {
        const f = await download(img.url);
        if (f.size > 1_000_000) throw new PlatformError("Bluesky giới hạn ảnh ≤ 1MB");
        const r = await jsonFetch(`${s.service}/xrpc/com.atproto.repo.uploadBlob`, {
          method: "POST",
          headers: { Authorization: `Bearer ${s.jwt}`, "Content-Type": f.type },
          body: new Uint8Array(f.buf),
        });
        uploaded.push({ alt: input.title || "", image: r.blob });
      }
      record.embed = { $type: "app.bsky.embed.images", images: uploaded };
    }
    const r = await postJSON(
      `${s.service}/xrpc/com.atproto.repo.createRecord`,
      { repo: s.did, collection: "app.bsky.feed.post", record },
      { Authorization: `Bearer ${s.jwt}` },
    );
    const rkey = String(r.uri).split("/").pop();
    return { id: r.uri, url: `https://bsky.app/profile/${s.handle}/post/${rkey}` };
  },
};

/* ---------------- Mastodon ---------------- */
export const mastodon: PlatformDef = {
  id: "mastodon",
  name: "Mastodon",
  color: "#6364FF",
  auth: "token",
  supports: { text: true, image: true, video: true, multiImage: true },
  fields: [
    { key: "instance_url", label: "Instance", type: "url", placeholder: "https://mastodon.social" },
    { key: "access_token", label: "Access token", type: "password", help: "Preferences → Development → New application (scope write:statuses write:media)" },
  ],
  async verify(c) {
    need(c, "instance_url", "access_token");
    const base = c.instance_url.replace(/\/$/, "");
    const r = await jsonFetch(`${base}/api/v1/accounts/verify_credentials`, { headers: { Authorization: `Bearer ${c.access_token}` } });
    return "@" + r.acct;
  },
  async publish(input, { credentials: c }) {
    const base = c.instance_url.replace(/\/$/, "");
    const auth = { Authorization: `Bearer ${c.access_token}` };
    const media_ids: string[] = [];
    for (const m of input.media.slice(0, 4)) {
      const f = await download(m.url);
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(f.buf)], { type: f.type }), m.type === "image" ? "image" : "video");
      let att = await jsonFetch(`${base}/api/v2/media`, { method: "POST", headers: auth, body: fd });
      for (let i = 0; !att.url && i < 60; i++) {
        await sleep(2000);
        att = await jsonFetch(`${base}/api/v1/media/${att.id}`, { headers: auth });
      }
      media_ids.push(att.id);
    }
    const r = await postJSON(`${base}/api/v1/statuses`, { status: caption(input, 500), media_ids }, auth);
    return { id: r.id, url: r.url };
  },
};
