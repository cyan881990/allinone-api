import { caption, images, jsonFetch, need, postJSON, videos } from "./http";
import { PlatformError, type PlatformDef } from "./types";

/* ---------------- Telegram ---------------- */
export const telegram: PlatformDef = {
  id: "telegram",
  name: "Telegram",
  color: "#229ED9",
  auth: "token",
  supports: { text: true, image: true, video: true, multiImage: true },
  fields: [
    { key: "bot_token", label: "Bot token", type: "password", placeholder: "123456:ABC-...", help: "Tạo bot với @BotFather" },
    { key: "chat_id", label: "Chat ID / @channel", placeholder: "@mychannel hoặc -100123...", help: "Thêm bot làm admin của kênh/nhóm" },
  ],
  async verify(c) {
    need(c, "bot_token", "chat_id");
    const r = await jsonFetch(`https://api.telegram.org/bot${c.bot_token}/getChat?chat_id=${encodeURIComponent(c.chat_id)}`);
    return r.result?.title || r.result?.username || String(c.chat_id);
  },
  async publish(input, { credentials: c }) {
    const api = (m: string, body: unknown) => postJSON(`https://api.telegram.org/bot${c.bot_token}/${m}`, body);
    const text = caption(input, 4096);
    const media = input.media;
    let r: any;
    if (media.length === 0) {
      if (!text) throw new PlatformError("Bài đăng trống");
      r = await api("sendMessage", { chat_id: c.chat_id, text });
    } else if (media.length === 1) {
      const m = media[0];
      const cap = caption(input, 1024);
      r = m.type === "image"
        ? await api("sendPhoto", { chat_id: c.chat_id, photo: m.url, caption: cap })
        : await api("sendVideo", { chat_id: c.chat_id, video: m.url, caption: cap });
    } else {
      r = await api("sendMediaGroup", {
        chat_id: c.chat_id,
        media: media.slice(0, 10).map((m, i) => ({
          type: m.type === "image" ? "photo" : "video",
          media: m.url,
          ...(i === 0 ? { caption: caption(input, 1024) } : {}),
        })),
      });
    }
    const msg = Array.isArray(r.result) ? r.result[0] : r.result;
    const uname = msg?.chat?.username;
    return { id: String(msg?.message_id), url: uname ? `https://t.me/${uname}/${msg.message_id}` : undefined };
  },
};

/* ---------------- Discord (webhook) ---------------- */
export const discord: PlatformDef = {
  id: "discord",
  name: "Discord",
  color: "#5865F2",
  auth: "token",
  supports: { text: true, image: true, video: true, multiImage: true },
  fields: [
    { key: "webhook_url", label: "Webhook URL", type: "url", placeholder: "https://discord.com/api/webhooks/...", help: "Kênh → Edit → Integrations → Webhooks" },
  ],
  async verify(c) {
    need(c, "webhook_url");
    const r = await jsonFetch(c.webhook_url);
    return r.name ? `${r.name} (#${r.channel_id})` : undefined;
  },
  async publish(input, { credentials: c }) {
    const vids = videos(input).map((v) => v.url);
    const content = [caption(input), ...vids].filter(Boolean).join("\n").slice(0, 2000);
    const embeds = images(input).slice(0, 10).map((m) => ({ image: { url: m.url } }));
    const r = await postJSON(`${c.webhook_url}${c.webhook_url.includes("?") ? "&" : "?"}wait=true`, {
      content: content || undefined,
      embeds: embeds.length ? embeds : undefined,
    });
    return { id: r.id };
  },
};

/* ---------------- Slack (incoming webhook) ---------------- */
export const slack: PlatformDef = {
  id: "slack",
  name: "Slack",
  color: "#4A154B",
  auth: "token",
  supports: { text: true, image: true, video: true },
  fields: [{ key: "webhook_url", label: "Incoming Webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/..." }],
  async verify(c) {
    need(c, "webhook_url");
    if (!/^https:\/\/hooks\.slack\.com\//.test(c.webhook_url)) throw new PlatformError("Webhook URL không hợp lệ");
    return "Slack webhook";
  },
  async publish(input, { credentials: c }) {
    const text = [caption(input), ...videos(input).map((v) => v.url)].filter(Boolean).join("\n");
    const blocks: any[] = [];
    if (text) blocks.push({ type: "section", text: { type: "mrkdwn", text: text.slice(0, 3000) } });
    for (const img of images(input).slice(0, 5)) blocks.push({ type: "image", image_url: img.url, alt_text: input.title || "image" });
    const res = await fetch(c.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text || "(image)", blocks }),
    });
    if (!res.ok) throw new PlatformError(`Slack HTTP ${res.status}: ${await res.text()}`);
    return {};
  },
};
