import { caption, download, images, jsonFetch, postJSON, sleep, videos } from "./http";
import { PlatformError, type PlatformDef } from "./types";

/* ---------------- YouTube ---------------- */
export const youtube: PlatformDef = {
  id: "youtube",
  name: "YouTube",
  color: "#FF0000",
  auth: "oauth",
  supports: { text: false, image: false, video: true },
  note: "Cần 1 video. Tuỳ chọn: options.youtube = { privacy: public|unlisted|private, tags: [], category_id }",
  async publish(input, { accessToken, options }) {
    const vid = videos(input)[0];
    if (!vid) throw new PlatformError("YouTube cần 1 video");
    const token = await accessToken();
    const file = await download(vid.url);
    const meta = {
      snippet: {
        title: (input.title || input.text || "Untitled").slice(0, 100),
        description: caption(input, 5000),
        tags: (options.tags as string[]) || undefined,
        categoryId: (options.category_id as string) || "22",
      },
      status: { privacyStatus: (options.privacy as string) || "public", selfDeclaredMadeForKids: false },
    };
    const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type.startsWith("video/") ? file.type : "video/*",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify(meta),
    });
    if (!init.ok) throw new PlatformError(`YouTube init HTTP ${init.status}: ${await init.text()}`);
    const location = init.headers.get("location");
    if (!location) throw new PlatformError("YouTube không trả upload URL");
    const r = await jsonFetch(location, {
      method: "PUT",
      headers: { "Content-Length": String(file.size), "Content-Type": file.type },
      body: new Uint8Array(file.buf),
    });
    return { id: r.id, url: `https://www.youtube.com/watch?v=${r.id}` };
  },
};

/* ---------------- TikTok ---------------- */
export const tiktok: PlatformDef = {
  id: "tiktok",
  name: "TikTok",
  color: "#000000",
  auth: "oauth",
  supports: { text: false, image: true, video: true, multiImage: true },
  note: "App chưa được TikTok duyệt chỉ đăng được ở chế độ riêng tư (SELF_ONLY). Ảnh cần domain đã xác minh (PULL_FROM_URL).",
  async publish(input, { accessToken, options }) {
    const token = await accessToken();
    const H = { Authorization: `Bearer ${token}` };
    const creator = await postJSON("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {}, H);
    const allowed: string[] = creator.data?.privacy_level_options || ["SELF_ONLY"];
    const wanted = (options.privacy_level as string) || "PUBLIC_TO_EVERYONE";
    const privacy_level = allowed.includes(wanted) ? wanted : allowed.includes("SELF_ONLY") ? "SELF_ONLY" : allowed[0];
    const title = caption(input, 2200);

    const vid = videos(input)[0];
    let publishId: string;
    if (vid) {
      const f = await download(vid.url);
      const MAX = 64 * 1024 * 1024;
      const chunk = f.size <= MAX ? f.size : 10 * 1024 * 1024;
      const count = f.size <= MAX ? 1 : Math.floor(f.size / chunk);
      const init = await postJSON(
        "https://open.tiktokapis.com/v2/post/publish/video/init/",
        {
          post_info: { title, privacy_level, disable_comment: false, disable_duet: false, disable_stitch: false },
          source_info: { source: "FILE_UPLOAD", video_size: f.size, chunk_size: chunk, total_chunk_count: count },
        },
        H,
      );
      publishId = init.data.publish_id;
      for (let i = 0; i < count; i++) {
        const start = i * chunk;
        const end = i === count - 1 ? f.size : start + chunk;
        const res = await fetch(init.data.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(end - start),
            "Content-Range": `bytes ${start}-${end - 1}/${f.size}`,
          },
          body: new Uint8Array(f.buf.subarray(start, end)),
        });
        if (!res.ok && res.status !== 206) throw new PlatformError(`TikTok upload HTTP ${res.status}: ${await res.text()}`);
      }
    } else {
      const imgs = images(input);
      if (!imgs.length) throw new PlatformError("TikTok cần video hoặc ảnh");
      const init = await postJSON(
        "https://open.tiktokapis.com/v2/post/publish/content/init/",
        {
          post_info: { title: (input.title || "").slice(0, 90), description: title, privacy_level },
          source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: imgs.slice(0, 35).map((i) => i.url) },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        },
        H,
      );
      publishId = init.data.publish_id;
    }

    for (let i = 0; i < 40; i++) {
      await sleep(3000);
      const s = await postJSON("https://open.tiktokapis.com/v2/post/publish/status/fetch/", { publish_id: publishId }, H);
      const st = s.data?.status;
      if (st === "PUBLISH_COMPLETE") {
        const pid = s.data?.publicaly_available_post_id?.[0];
        return { id: String(pid || publishId), raw: { privacy_level } };
      }
      if (st === "FAILED") throw new PlatformError(`TikTok: ${s.data?.fail_reason}`);
    }
    return { id: publishId, raw: { privacy_level, note: "Đang xử lý trên TikTok" } };
  },
};

/* ---------------- LinkedIn ---------------- */
export const linkedin: PlatformDef = {
  id: "linkedin",
  name: "LinkedIn",
  color: "#0A66C2",
  auth: "oauth",
  supports: { text: true, image: true, video: false },
  async publish(input, { accessToken, credentials }) {
    const token = await accessToken();
    const H = {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202606",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    const author = credentials.author;
    if (videos(input).length) throw new PlatformError("LinkedIn: bản này chưa hỗ trợ video");
    const body: any = {
      author,
      commentary: caption(input, 3000),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    const img = images(input)[0];
    if (img) {
      const init = await postJSON("https://api.linkedin.com/rest/images?action=initializeUpload", { initializeUploadRequest: { owner: author } }, H);
      const f = await download(img.url);
      const up = await fetch(init.value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: new Uint8Array(f.buf) });
      if (!up.ok) throw new PlatformError(`LinkedIn upload ảnh HTTP ${up.status}`);
      body.content = { media: { id: init.value.image, altText: input.title || "" } };
    }
    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new PlatformError(`LinkedIn HTTP ${res.status}: ${await res.text()}`);
    const id = res.headers.get("x-restli-id") || undefined;
    return { id, url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined };
  },
};

/* ---------------- X (Twitter) ---------------- */
export const x: PlatformDef = {
  id: "x",
  name: "X (Twitter)",
  color: "#000000",
  auth: "oauth",
  supports: { text: true, image: true, video: false, multiImage: true },
  note: "Gói X API phải cho phép ghi tweet. Bản này hỗ trợ text + tối đa 4 ảnh.",
  async publish(input, { accessToken }) {
    const token = await accessToken();
    const H = { Authorization: `Bearer ${token}` };
    const media_ids: string[] = [];
    for (const img of images(input).slice(0, 4)) {
      const f = await download(img.url);
      const fd = new FormData();
      fd.append("media", new Blob([new Uint8Array(f.buf)], { type: f.type }), "image");
      fd.append("media_category", "tweet_image");
      const r = await jsonFetch("https://api.x.com/2/media/upload", { method: "POST", headers: H, body: fd });
      media_ids.push(r.data?.id || r.media_id_string);
    }
    if (videos(input).length && !media_ids.length && !input.text) throw new PlatformError("X: bản này chưa hỗ trợ video");
    const r = await postJSON("https://api.x.com/2/tweets", { text: caption(input, 280), ...(media_ids.length ? { media: { media_ids } } : {}) }, H);
    return { id: r.data.id, url: `https://x.com/i/status/${r.data.id}` };
  },
};
