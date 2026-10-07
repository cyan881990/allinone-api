import { NextResponse } from "next/server";
import { fail, json, preflight, withApi } from "@/lib/api-helpers";
import { admin } from "@/lib/supabase/admin";

export const OPTIONS = preflight;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/posts/:id — trạng thái và kết quả từng API con */
export async function GET(req: Request, { params }: Ctx) {
  const api = await withApi(req);
  if (api instanceof NextResponse) return api;
  const { id } = await params;
  const { data } = await admin()
    .from("posts")
    .select("id, status, targets, scheduled_at, results, payload, source, created_at, completed_at")
    .eq("id", id)
    .eq("remote_api_id", api.id)
    .maybeSingle();
  if (!data) return fail("Không tìm thấy post", 404);
  return json({ success: true, post: data });
}

/** DELETE /api/v1/posts/:id — huỷ bài đã hẹn giờ */
export async function DELETE(req: Request, { params }: Ctx) {
  const api = await withApi(req);
  if (api instanceof NextResponse) return api;
  const { id } = await params;
  const { data } = await admin()
    .from("posts")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("remote_api_id", api.id)
    .eq("status", "scheduled")
    .select("id");
  if (!data?.length) return fail("Chỉ huỷ được bài đang ở trạng thái scheduled", 409);
  return json({ success: true, id, status: "cancelled" });
}
