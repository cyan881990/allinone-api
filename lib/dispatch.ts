import "server-only";
import { decryptJSON, encryptJSON, sha256 } from "./crypto";
import { ensureFreshToken } from "./oauth";
import { getPlatform } from "./platforms";
import type { MediaItem, PostInput } from "./platforms/types";
import { admin } from "./supabase/admin";

export type RemoteApi = { id: string; owner_id: string; name: string; active: boolean };

export type ConnectionRow = {
  id: string;
  remote_api_id: string;
  owner_id: string;
  platform: string;
  label: string;
  display_name: string | null;
  credentials: string;
  enabled: boolean;
};

export type TargetResult = {
  connection_id: string;
  label: string;
  platform: string;
  ok: boolean;
  id?: string;
  url?: string;
  error?: string;
  ms: number;
};

/* ---------- Xác thực API key ---------- */
export async function authenticateApiKey(header: string | null): Promise<RemoteApi | null> {
  if (!header) return null;
  const raw = header.replace(/^(Apikey|Bearer)\s+/i, "").trim();
  if (!raw.startsWith("aio_")) return null;
  const { data } = await admin().from("remote_apis").select("id, owner_id, name, active").eq("key_hash", sha256(raw)).maybeSingle();
  if (!data || !data.active) return null;
  void admin().from("remote_apis").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return data as RemoteApi;
}

/* ---------- Chuẩn hoá payload ---------- */
export type PostRequest = PostInput & { platforms?: string[]; scheduled_at?: string; async?: boolean };

const guessType = (url: string): "image" | "video" =>
  /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(url) ? "video" : "image";

export function normalizeRequest(body: any): { ok: true; value: PostRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body phải là JSON object" };
  const media: MediaItem[] = [];
  const pushUrl = (url: unknown, type?: unknown) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) return;
    media.push({ url, type: type === "video" || type === "image" ? type : guessType(url) });
  };
  if (Array.isArray(body.media)) for (const m of body.media) typeof m === "string" ? pushUrl(m) : pushUrl(m?.url, m?.type);
  if (body.image_url) [].concat(body.image_url).forEach((u) => pushUrl(u, "image"));
  if (body.video_url) [].concat(body.video_url).forEach((u) => pushUrl(u, "video"));

  const platforms = body.platforms ?? body.platform ?? body["platform[]"];
  const value: PostRequest = {
    text: typeof body.text === "string" ? body.text : typeof body.caption === "string" ? body.caption : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    link: typeof body.link === "string" ? body.link : undefined,
    media,
    options: body.options && typeof body.options === "object" ? body.options : {},
    platforms: platforms === undefined ? undefined : ([] as string[]).concat(platforms).map(String),
    scheduled_at: typeof body.scheduled_at === "string" ? body.scheduled_at : undefined,
    async: body.async === true,
  };
  if (!value.text && !value.media.length && !value.link) return { ok: false, error: "Cần ít nhất text, link hoặc media" };
  if (value.scheduled_at && isNaN(Date.parse(value.scheduled_at))) return { ok: false, error: "scheduled_at phải là ISO 8601" };
  return { ok: true, value };
}

/* ---------- Chọn API con ---------- */
/** targets: tên nền tảng ("tiktok") = mọi API con nền tảng đó; hoặc label/ID của 1 API con cụ thể. Rỗng = tất cả. */
export function resolveTargets(conns: ConnectionRow[], targets?: string[]) {
  const enabled = conns.filter((c) => c.enabled);
  if (!targets || targets.length === 0 || targets.includes("all")) return { selected: enabled, unknown: [] as string[] };
  const picked = new Map<string, ConnectionRow>();
  const unknown: string[] = [];
  for (const t of targets) {
    const key = t.trim().toLowerCase();
    const matches = enabled.filter((c) => c.platform === key || c.label.toLowerCase() === key || c.id === t);
    if (!matches.length) unknown.push(t);
    matches.forEach((m) => picked.set(m.id, m));
  }
  return { selected: [...picked.values()], unknown };
}

/* ---------- Gọi 1 API con ---------- */
async function publishOne(conn: ConnectionRow, input: PostInput): Promise<TargetResult> {
  const t0 = Date.now();
  const base = { connection_id: conn.id, label: conn.label, platform: conn.platform };
  const def = getPlatform(conn.platform);
  try {
    if (!def) throw new Error(`Nền tảng không hỗ trợ: ${conn.platform}`);
    let creds = decryptJSON<Record<string, any>>(conn.credentials);
    const save = async (next: Record<string, any>) => {
      creds = next;
      await admin().from("connections").update({ credentials: encryptJSON(next), updated_at: new Date().toISOString() }).eq("id", conn.id);
    };
    const r = await def.publish(input, {
      credentials: creds,
      accessToken: () => ensureFreshToken(conn.platform, creds, save),
      options: { ...(input.options[conn.platform] || {}), ...(input.options[conn.label] || {}) },
    });
    await admin().from("connections").update({ status: "ok", last_error: null }).eq("id", conn.id);
    return { ...base, ok: true, id: r.id, url: r.url, ms: Date.now() - t0 };
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 1000);
    await admin().from("connections").update({ status: "error", last_error: error }).eq("id", conn.id);
    return { ...base, ok: false, error, ms: Date.now() - t0 };
  }
}

/* ---------- Thực thi 1 post (song song tới các API con đã chọn) ---------- */
export async function executePost(postId: string) {
  const db = admin();
  const { data: post } = await db.from("posts").select("*").eq("id", postId).single();
  if (!post) throw new Error("Không tìm thấy post");
  const { data: conns } = await db.from("connections").select("*").eq("remote_api_id", post.remote_api_id);
  const { selected, unknown } = resolveTargets((conns || []) as ConnectionRow[], post.targets);

  const p = post.payload as PostRequest;
  const input: PostInput = { text: p.text, title: p.title, link: p.link, media: p.media || [], options: p.options || {} };

  const results = await Promise.all(selected.map((c) => publishOne(c, input)));
  const okCount = results.filter((r) => r.ok).length;
  const status = results.length === 0 ? "failed" : okCount === results.length ? "success" : okCount === 0 ? "failed" : "partial";
  const final = { results, unknown_targets: unknown };
  await db.from("posts").update({ status, results: final, completed_at: new Date().toISOString() }).eq("id", postId);
  return { id: postId, status, ...final };
}

/** Tạo bản ghi post; trả về id và trạng thái ban đầu */
export async function createPost(api: RemoteApi, req: PostRequest, source: "api" | "dashboard") {
  const scheduled = req.scheduled_at && Date.parse(req.scheduled_at) > Date.now() + 30_000;
  const { platforms, scheduled_at, async: _a, ...payload } = req;
  const { data, error } = await admin()
    .from("posts")
    .insert({
      remote_api_id: api.id,
      owner_id: api.owner_id,
      payload,
      targets: platforms || [],
      status: scheduled ? "scheduled" : "processing",
      scheduled_at: scheduled ? new Date(scheduled_at!).toISOString() : null,
      source,
    })
    .select("id, status, scheduled_at")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; status: string; scheduled_at: string | null };
}

/** Lấy các post đến hạn (UPDATE nguyên tử để không chạy trùng) rồi thực thi */
export async function runDueScheduled() {
  const { data } = await admin()
    .from("posts")
    .update({ status: "processing" })
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .select("id");
  return Promise.all((data || []).map((row) => executePost(row.id)));
}
