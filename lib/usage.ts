import "server-only";
import { decryptJSON } from "./crypto";
import { jsonFetch } from "./platforms/http";
import { buildStatus, countMinutesOf, getLimitRule, windowStart, type LimitRule, type LimitStatus } from "./platforms/limits";
import { admin } from "./supabase/admin";

/**
 * Bảng usage_events do migration 003 tạo. Nếu dự án chưa chạy migration đó,
 * mọi thứ ở đây phải im lặng bỏ qua thay vì làm hỏng việc đăng bài.
 *
 * Trạng thái "thiếu bảng" chỉ nhớ trong 5 phút: sau khi chạy migration, tiến trình
 * đang chạy phải tự nhận ra mà không cần deploy lại. PGRST205 (schema cache chưa
 * kịp nạp) thì không nhớ chút nào vì nó hết sau vài giây.
 */
let missingUntil = 0;
const MISSING_TTL = 5 * 60_000;
const tableMissing = () => Date.now() < missingUntil;

function noteError(e: any): boolean {
  if (e?.code === "PGRST205") return true; // schema cache chưa nạp, thử lại ngay lần sau
  const missing =
    e?.code === "42P01" ||
    (/usage_events/i.test(e?.message || "") && /does not exist|could not find/i.test(e?.message || ""));
  if (missing) missingUntil = Date.now() + MISSING_TTL;
  return missing;
}

/** Dòng pending quá hạn này coi như tiến trình đã chết, không tính vào giới hạn nữa. */
const STALE_PENDING_MS = 30 * 60_000;

type Row = { state: string; created_at: string };

/** Các lượt của 1 API con trong cửa sổ, đã bỏ dòng pending treo. */
async function windowRows(connectionId: string, since: string): Promise<Row[] | null> {
  if (tableMissing()) return null;
  try {
    const { data, error } = await admin()
      .from("usage_events")
      .select("state, created_at")
      .eq("connection_id", connectionId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) {
      noteError(error);
      return null;
    }
    const staleBefore = Date.now() - STALE_PENDING_MS;
    return (data || []).filter((r) => r.state !== "pending" || Date.parse(r.created_at) >= staleBefore);
  } catch {
    return null;
  }
}

/**
 * Lượt nào tính vào giới hạn.
 * - Giới hạn theo tần suất gọi (kind "rate"): mọi lượt đều tính, kể cả lượt lỗi —
 *   gọi hỏng vẫn tiêu một lượt của nền tảng.
 * - Trần số bài đã đăng (kind "hard"): chỉ tính bài thành công, cộng bài đang chạy.
 */
function countable(rule: LimitRule, rows: Row[]): Row[] {
  if (rule.kind === "rate") return rows;
  return rows.filter((r) => r.state === "ok" || r.state === "pending");
}

/* ---------- Đặt chỗ: ghi dòng pending trước khi gọi nền tảng ---------- */

export type UsageTarget = {
  id: string;
  label: string;
  platform: string;
  owner_id: string;
  remote_api_id: string;
};

/** Ghi một lượt ở trạng thái pending. Trả về id dòng, hoặc null nếu không theo dõi được. */
export async function reserveUsage(conn: UsageTarget, postId: string | null): Promise<number | null> {
  if (tableMissing()) return null;
  try {
    const { data, error } = await admin()
      .from("usage_events")
      .insert({
        owner_id: conn.owner_id,
        remote_api_id: conn.remote_api_id,
        connection_id: conn.id,
        post_id: postId,
        platform: conn.platform,
        label: conn.label,
        state: "pending",
      })
      .select("id")
      .single();
    if (error) {
      noteError(error);
      return null;
    }
    return (data as { id: number }).id;
  } catch {
    return null;
  }
}

/** Huỷ chỗ đã đặt (khi bị chặn vì chạm trần, chưa hề gọi nền tảng). */
export async function releaseUsage(id: number | null) {
  if (id === null) return;
  try {
    await admin().from("usage_events").delete().eq("id", id);
  } catch {
    /* dòng treo sẽ tự bị bỏ qua sau STALE_PENDING_MS */
  }
}

/** Chốt kết quả của một lượt đã đặt chỗ. */
export async function settleUsage(id: number | null, r: { ok: boolean; ms: number; error?: string }) {
  if (id === null) return;
  try {
    await admin()
      .from("usage_events")
      .update({ state: r.ok ? "ok" : "failed", ms: r.ms, error: r.error ? String(r.error).slice(0, 1000) : null })
      .eq("id", id);
  } catch {
    /* thống kê hỏng thì cũng không được chặn việc đăng bài */
  }
}

/**
 * Kiểm tra sau khi đã đặt chỗ: dòng vừa ghi nằm trong số đếm, nên hai request chạy
 * song song đều thấy nhau. Trả chuỗi lỗi nếu vượt trần, null nếu còn chỗ.
 */
export async function overLimitMessage(conn: UsageTarget): Promise<string | null> {
  const rule = getLimitRule(conn.platform);
  if (!rule?.enforce || !rule.max) return null;

  const rows = await windowRows(conn.id, windowStart(rule));
  if (!rows) return null; // chưa theo dõi được thì không chặn

  const used = countable(rule, rows).length;
  if (used <= rule.max) return null;

  const when = freeSlotAt(rule, countable(rule, rows), used - rule.max);
  const label = when
    ? new Date(when).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" })
    : "sau khi hết cửa sổ";
  return `Đã chạm giới hạn của ${conn.platform}: ${used - 1}/${rule.max}. ${rule.text} Thử lại sau ${label} (giờ VN).`;
}

/** Thời điểm có đủ `needed` chỗ trống: lúc lượt thứ `needed` tính từ cũ nhất hết hạn. */
function freeSlotAt(rule: LimitRule, rows: Row[], needed: number): string | null {
  const nth = rows[Math.max(0, needed - 1)];
  if (!nth) return null;
  return new Date(Date.parse(nth.created_at) + countMinutesOf(rule) * 60_000).toISOString();
}

/* ---------- Quota đọc thẳng từ nền tảng ---------- */

const V = () => process.env.META_GRAPH_VERSION || "v26.0";

/** Không để một nền tảng treo làm treo cả trang. */
const withTimeout = (ms: number) => AbortSignal.timeout(ms);

/** Instagram và Threads có endpoint trả đúng số bài đã đăng trong 24 giờ. */
async function fetchReportedQuota(
  platform: string,
  credentials: Record<string, any>,
): Promise<LimitStatus["reported"] | undefined> {
  try {
    if (platform === "instagram") {
      const host = credentials.host || "graph.facebook.com";
      const r = await jsonFetch(
        `https://${host}/${V()}/${credentials.ig_user_id}/content_publishing_limit?fields=quota_usage,config&access_token=${credentials.access_token}`,
        { signal: withTimeout(8000) },
      );
      const row = r?.data?.[0];
      if (!row) return undefined;
      return { used: Number(row.quota_usage ?? 0), max: Number(row.config?.quota_total ?? 100), source: "Instagram" };
    }
    if (platform === "threads") {
      const id = credentials.threads_user_id || "me";
      const r = await jsonFetch(
        `https://graph.threads.net/v1.0/${id}/threads_publishing_limit?fields=quota_usage,config&access_token=${credentials.access_token}`,
        { signal: withTimeout(8000) },
      );
      const row = r?.data?.[0];
      if (!row) return undefined;
      return { used: Number(row.quota_usage ?? 0), max: Number(row.config?.quota_total ?? 250), source: "Threads" };
    }
  } catch {
    /* đọc được thì tốt, không đọc được thì dùng số đếm nội bộ */
  }
  return undefined;
}

/* ---------- Tình trạng giới hạn của 1 API con ---------- */

export type ConnLimit = LimitStatus & { connection_id: string; label: string; tracked: boolean };

export async function limitFor(
  conn: { id: string; label: string; platform: string; enabled?: boolean; credentials?: string },
  opts: { remote?: boolean } = {},
): Promise<ConnLimit | null> {
  const rule = getLimitRule(conn.platform);
  if (!rule) return null;

  const rows = await windowRows(conn.id, windowStart(rule));
  const counted = rows ? countable(rule, rows) : [];
  const used = counted.length;

  let reported: LimitStatus["reported"] | undefined;
  if (opts.remote && rule.remoteQuota && conn.credentials && conn.enabled !== false) {
    try {
      reported = await fetchReportedQuota(conn.platform, decryptJSON<Record<string, any>>(conn.credentials));
    } catch {
      /* credentials hỏng là chuyện của luồng đăng bài, không phải của thống kê */
    }
  }

  return {
    ...buildStatus(rule, used, counted[0]?.created_at ?? null, reported),
    connection_id: conn.id,
    label: conn.label,
    tracked: rows !== null,
  };
}

/* ---------- Thống kê tổng hợp ---------- */

export type UsageStats = {
  ok: number;
  failed: number;
  successRate: number | null;
  last24h: number;
  last7d: number;
  last30d: number;
  avgMs: number | null;
  byPlatform: { platform: string; total: number; ok: number; failed: number; last24h: number }[];
  /** Số bài theo từng ngày trong 14 ngày gần nhất (giờ Việt Nam), cũ → mới. */
  daily: { date: string; ok: number; failed: number }[];
  /** Lỗi hay gặp nhất, để biết nên sửa gì. */
  topErrors: { error: string; count: number }[];
  available: boolean;
};

const EMPTY: UsageStats = {
  ok: 0, failed: 0, successRate: null, last24h: 0, last7d: 0, last30d: 0, avgMs: null,
  byPlatform: [], daily: [], topErrors: [], available: false,
};

/** Khoá ngày theo giờ Việt Nam (UTC+7) để biểu đồ khớp với nhãn thời gian trên trang. */
const ICT_OFFSET = 7 * 3600_000;
const dayKeyICT = (ms: number) => new Date(ms + ICT_OFFSET).toISOString().slice(0, 10);

/** Đếm số lượt trong khoảng, không kéo dữ liệu về. */
async function countSince(remoteApiId: string, sinceMs: number): Promise<number> {
  const { count, error } = await admin()
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("remote_api_id", remoteApiId)
    .neq("state", "pending")
    .gte("created_at", new Date(sinceMs).toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Thống kê của 1 API remote: tổng số đếm bằng count, chi tiết lấy trong 14 ngày. */
export async function usageStats(remoteApiId: string): Promise<UsageStats> {
  if (tableMissing()) return EMPTY;
  const now = Date.now();
  const d14 = now - 14 * 24 * 3600_000;

  try {
    const [last24h, last7d, last30d, detail] = await Promise.all([
      countSince(remoteApiId, now - 24 * 3600_000),
      countSince(remoteApiId, now - 7 * 24 * 3600_000),
      countSince(remoteApiId, now - 30 * 24 * 3600_000),
      admin()
        .from("usage_events")
        .select("platform, state, ms, error, created_at")
        .eq("remote_api_id", remoteApiId)
        .neq("state", "pending")
        .gte("created_at", new Date(d14).toISOString())
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    if (detail.error) throw detail.error;
    const rows = detail.data || [];
    const h24 = now - 24 * 3600_000;

    const byPlatform = new Map<string, { platform: string; total: number; ok: number; failed: number; last24h: number }>();
    const daily = new Map<string, { date: string; ok: number; failed: number }>();
    const errors = new Map<string, number>();
    let ok = 0, msSum = 0, msCount = 0;

    for (let i = 13; i >= 0; i--) {
      const d = dayKeyICT(now - i * 24 * 3600_000);
      daily.set(d, { date: d, ok: 0, failed: 0 });
    }

    for (const r of rows) {
      const isOk = r.state === "ok";
      const p = byPlatform.get(r.platform) || { platform: r.platform, total: 0, ok: 0, failed: 0, last24h: 0 };
      p.total++;
      isOk ? p.ok++ : p.failed++;
      if (Date.parse(r.created_at) >= h24) p.last24h++;
      byPlatform.set(r.platform, p);

      if (isOk) ok++;
      if (typeof r.ms === "number") { msSum += r.ms; msCount++; }

      const d = daily.get(dayKeyICT(Date.parse(r.created_at)));
      if (d) isOk ? d.ok++ : d.failed++;

      if (!isOk && r.error) {
        const key = String(r.error).slice(0, 120);
        errors.set(key, (errors.get(key) || 0) + 1);
      }
    }

    return {
      ok,
      failed: rows.length - ok,
      successRate: rows.length ? Math.round((ok / rows.length) * 100) : null,
      last24h,
      last7d,
      last30d,
      avgMs: msCount ? Math.round(msSum / msCount) : null,
      byPlatform: [...byPlatform.values()].sort((a, b) => b.total - a.total),
      daily: [...daily.values()],
      topErrors: [...errors.entries()].map(([error, count]) => ({ error, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      available: true,
    };
  } catch (e) {
    noteError(e);
    return EMPTY;
  }
}
