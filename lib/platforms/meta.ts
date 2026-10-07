import { caption, images, jsonFetch, need, postForm, sleep, videos } from "./http";
import { PlatformError, type PlatformDef } from "./types";

const V = () => process.env.META_GRAPH_VERSION || "v23.0";
const graph = (host = "graph.facebook.com") => `https://${host}/${V()}`;

/* ---------------- Facebook Page ---------------- */
export const facebook: PlatformDef = {
  id: "facebook",
  name: "Facebook Page",
  color: "#0866FF",
  auth: "token",
  supports: { text: true, image: true, video: true, multiImage: true },
  note: "Dùng Page Access Token dài hạn (quyền pages_manage_posts, pages_read_engagement).",
  fields: [
    { key: "page_id", label: "Page ID", placeholder: "1234567890" },
    { key: "page_access_token", label: "Page access token", type: "password" },
  ],
  async verify(c) {
    need(c, "page_id", "page_access_token");
    const r = await jsonFetch(`${graph()}/${c.page_id}?fields=name&access_token=${c.page_access_token}`);
    return r.name;
  },
  async publish(input, { credentials: c }) {
    const base = `${graph()}/${c.page_id}`;
    const token = c.page_access_token;
    const vid = videos(input)[0];
    const imgs = images(input);
    let id: string;
    if (vid) {
      const r = await postForm(`${base}/videos`, { file_url: vid.url, description: caption(input), title: input.title, access_token: token });
      id = r.id;
    } else if (imgs.length === 1) {
      const r = await postForm(`${base}/photos`, { url: imgs[0].url, caption: caption(input), access_token: token });
      id = r.post_id || r.id;
    } else if (imgs.length > 1) {
      const ids: string[] = [];
      for (const img of imgs.slice(0, 10)) {
        const r = await postForm(`${base}/photos`, { url: img.url, published: "false", access_token: token });
        ids.push(r.id);
      }
      const body: Record<string, string> = { message: input.text || "", access_token: token };
      ids.forEach((pid, i) => (body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: pid })));
      if (input.link) body.message += `\n\n${input.link}`;
      id = (await postForm(`${base}/feed`, body)).id;
    } else {
      id = (await postForm(`${base}/feed`, { message: input.text, link: input.link, access_token: token })).id;
    }
    return { id, url: `https://www.facebook.com/${id}` };
  },
};

/* ---------------- Instagram (Business/Creator) ---------------- */
async function waitContainer(host: string, id: string, token: string) {
  for (let i = 0; i < 60; i++) {
    const r = await jsonFetch(`${graph(host)}/${id}?fields=status_code,status&access_token=${token}`);
    if (r.status_code === "FINISHED") return;
    if (r.status_code === "ERROR" || r.status_code === "EXPIRED") throw new PlatformError(`Instagram xử lý media lỗi: ${r.status}`);
    await sleep(3000);
  }
  throw new PlatformError("Instagram xử lý media quá lâu");
}

export const instagram: PlatformDef = {
  id: "instagram",
  name: "Instagram",
  color: "#E1306C",
  auth: "token",
  supports: { text: false, image: true, video: true, multiImage: true },
  note: "Tài khoản Business/Creator. Media phải là URL công khai. Video được đăng dạng Reels.",
  fields: [
    { key: "ig_user_id", label: "Instagram User ID", placeholder: "1784..." },
    { key: "access_token", label: "Access token", type: "password", help: "Quyền instagram_basic + instagram_content_publish" },
    { key: "host", label: "API host (tuỳ chọn)", placeholder: "graph.facebook.com hoặc graph.instagram.com", optional: true },
  ],
  async verify(c) {
    need(c, "ig_user_id", "access_token");
    const r = await jsonFetch(`${graph(c.host || undefined)}/${c.ig_user_id}?fields=username&access_token=${c.access_token}`);
    return "@" + r.username;
  },
  async publish(input, { credentials: c, options }) {
    const host = c.host || "graph.facebook.com";
    const base = `${graph(host)}/${c.ig_user_id}`;
    const token = c.access_token;
    const cap = caption(input, 2200);
    if (input.media.length === 0) throw new PlatformError("Instagram cần ít nhất 1 ảnh hoặc video");

    let creation: string;
    if (input.media.length === 1) {
      const m = input.media[0];
      const params: Record<string, string> =
        m.type === "image"
          ? { image_url: m.url, caption: cap, access_token: token }
          : { media_type: options.story ? "STORIES" : "REELS", video_url: m.url, caption: cap, access_token: token };
      if (options.story && m.type === "image") params.media_type = "STORIES";
      creation = (await postForm(`${base}/media`, params)).id;
      await waitContainer(host, creation, token);
    } else {
      const children: string[] = [];
      for (const m of input.media.slice(0, 10)) {
        const p: Record<string, string> = { is_carousel_item: "true", access_token: token };
        if (m.type === "image") p.image_url = m.url;
        else Object.assign(p, { media_type: "VIDEO", video_url: m.url });
        const id = (await postForm(`${base}/media`, p)).id;
        if (m.type === "video") await waitContainer(host, id, token);
        children.push(id);
      }
      creation = (await postForm(`${base}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: cap, access_token: token })).id;
      await waitContainer(host, creation, token);
    }
    const pub = await postForm(`${base}/media_publish`, { creation_id: creation, access_token: token });
    let url: string | undefined;
    try {
      url = (await jsonFetch(`${graph(host)}/${pub.id}?fields=permalink&access_token=${token}`)).permalink;
    } catch {}
    return { id: pub.id, url };
  },
};

/* ---------------- Threads ---------------- */
export const threads: PlatformDef = {
  id: "threads",
  name: "Threads",
  color: "#111111",
  auth: "token",
  supports: { text: true, image: true, video: true },
  note: "Token Threads API (threads_basic, threads_content_publish).",
  fields: [
    { key: "threads_user_id", label: "Threads User ID", placeholder: "me hoặc ID số" },
    { key: "access_token", label: "Access token", type: "password" },
  ],
  async verify(c) {
    need(c, "access_token");
    const r = await jsonFetch(`https://graph.threads.net/v1.0/${c.threads_user_id || "me"}?fields=id,username&access_token=${c.access_token}`);
    return "@" + r.username;
  },
  async publish(input, { credentials: c }) {
    const base = `https://graph.threads.net/v1.0/${c.threads_user_id || "me"}`;
    const token = c.access_token;
    const m = input.media[0];
    const params: Record<string, string> = { text: caption(input, 500), access_token: token, media_type: "TEXT" };
    if (m?.type === "image") Object.assign(params, { media_type: "IMAGE", image_url: m.url });
    if (m?.type === "video") Object.assign(params, { media_type: "VIDEO", video_url: m.url });
    const creation = (await postForm(`${base}/threads`, params)).id;
    for (let i = 0; i < 60; i++) {
      const s = await jsonFetch(`https://graph.threads.net/v1.0/${creation}?fields=status,error_message&access_token=${token}`);
      if (s.status === "FINISHED" || !s.status) break;
      if (s.status === "ERROR") throw new PlatformError(`Threads lỗi: ${s.error_message}`);
      await sleep(m ? 3000 : 1000);
    }
    const pub = await postForm(`${base}/threads_publish`, { creation_id: creation, access_token: token });
    let url: string | undefined;
    try {
      url = (await jsonFetch(`https://graph.threads.net/v1.0/${pub.id}?fields=permalink&access_token=${token}`)).permalink;
    } catch {}
    return { id: pub.id, url };
  },
};
