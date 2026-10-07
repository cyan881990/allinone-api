import { NextResponse } from "next/server";
import { json, preflight, withApi } from "@/lib/api-helpers";
import { admin } from "@/lib/supabase/admin";

export const OPTIONS = preflight;

/** GET /api/v1/posts?limit=20&status=scheduled — lịch sử của API remote này */
export async function GET(req: Request) {
  const api = await withApi(req);
  if (api instanceof NextResponse) return api;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  let q = admin()
    .from("posts")
    .select("id, status, targets, scheduled_at, results, payload, source, created_at, completed_at")
    .eq("remote_api_id", api.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const status = url.searchParams.get("status");
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return json({ success: false, error: error.message }, 500);
  return json({ success: true, posts: data });
}
