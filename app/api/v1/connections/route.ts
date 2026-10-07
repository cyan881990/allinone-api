import { NextResponse } from "next/server";
import { json, preflight, withApi } from "@/lib/api-helpers";
import { admin } from "@/lib/supabase/admin";

export const OPTIONS = preflight;

/** GET /api/v1/connections — danh sách API con của API remote này */
export async function GET(req: Request) {
  const api = await withApi(req);
  if (api instanceof NextResponse) return api;
  const { data } = await admin()
    .from("connections")
    .select("id, platform, label, display_name, enabled, status, last_error, created_at")
    .eq("remote_api_id", api.id)
    .order("created_at");
  return json({ success: true, remote_api: { id: api.id, name: api.name }, connections: data || [] });
}
