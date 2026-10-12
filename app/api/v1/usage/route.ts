import { NextResponse } from "next/server";
import { json, preflight, withApi } from "@/lib/api-helpers";
import { admin } from "@/lib/supabase/admin";
import { limitFor, usageStats } from "@/lib/usage";

export const OPTIONS = preflight;

/**
 * GET /api/v1/usage — thống kê và tình trạng giới hạn của API remote này.
 *
 * ?live=1  đọc thêm quota thật từ nền tảng (hiện Instagram và Threads có hỗ trợ).
 *          Mỗi API con tốn thêm 1 lượt gọi nên mặc định tắt.
 */
export async function GET(req: Request) {
  const api = await withApi(req);
  if (api instanceof NextResponse) return api;

  const live = ["1", "true", "yes"].includes((new URL(req.url).searchParams.get("live") || "").toLowerCase());

  const { data: conns } = await admin()
    .from("connections")
    .select("id, platform, label, display_name, enabled, credentials")
    // credentials chỉ dùng cho ?live=1, không bao giờ lọt vào phản hồi.
    .eq("remote_api_id", api.id)
    .order("created_at");

  const [stats, limits] = await Promise.all([
    usageStats(api.id),
    Promise.all((conns || []).map((c) => limitFor(c, { remote: live }))),
  ]);

  const rows = (conns || []).map((c, i) => {
    const l = limits[i];
    return {
      connection_id: c.id,
      label: c.label,
      platform: c.platform,
      display_name: c.display_name,
      enabled: c.enabled,
      limit: l
        ? {
            kind: l.kind,
            used: l.used,
            max: l.max,
            remaining: l.remaining,
            percent: l.percent,
            window_minutes: l.windowMinutes,
            count_window_minutes: l.countMinutes,
            resets_at: l.resetsAt,
            tracked: l.tracked,
            enforced: l.enforce,
            description: l.text,
            docs: l.docs,
            reported_by_platform: l.reported ?? null,
          }
        : null,
    };
  });

  return json({
    success: true,
    remote_api: { id: api.id, name: api.name },
    tracking: stats.available,
    stats: {
      last_24h: stats.last24h,
      last_7d: stats.last7d,
      last_30d: stats.last30d,
      ok: stats.ok,
      failed: stats.failed,
      success_rate: stats.successRate,
      avg_ms: stats.avgMs,
      by_platform: stats.byPlatform,
      daily: stats.daily,
      top_errors: stats.topErrors,
    },
    connections: rows,
  });
}
