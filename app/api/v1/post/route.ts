import { after, NextResponse } from "next/server";
import { fail, json, preflight, readBody, withApi } from "@/lib/api-helpers";
import { createPost, executePost, normalizeRequest, resolveTargets, type ConnectionRow } from "@/lib/dispatch";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export const OPTIONS = preflight;

/**
 * POST /api/v1/post
 * Authorization: Apikey aio_xxx
 * { "text": "...", "media": [{"url":"https://...mp4","type":"video"}], "platforms": ["tiktok","youtube"], "scheduled_at": "...", "async": false }
 */
export async function POST(req: Request) {
  const api = await withApi(req);
  if (api instanceof NextResponse) return api;

  let body: Record<string, any>;
  try {
    body = await readBody(req, api);
  } catch (e: any) {
    return fail(e?.message || "Body không hợp lệ");
  }
  const parsed = normalizeRequest(body);
  if (!parsed.ok) return fail(parsed.error);
  const request = parsed.value;

  const { data: conns } = await admin()
    .from("connections")
    .select("id, platform, label, enabled")
    .eq("remote_api_id", api.id);
  const { selected, unknown } = resolveTargets((conns || []) as ConnectionRow[], request.platforms);
  if (selected.length === 0) {
    return fail("Không có API con nào khớp/đang bật", 422, {
      unknown_targets: unknown,
      available: (conns || []).filter((c) => c.enabled).map((c) => ({ label: c.label, platform: c.platform })),
    });
  }

  const post = await createPost(api, request, "api");
  const targets = selected.map((c) => ({ label: c.label, platform: c.platform }));

  if (post.status === "scheduled") {
    return json({ success: true, post_id: post.id, status: "scheduled", scheduled_at: post.scheduled_at, targets }, 202);
  }
  if (request.async) {
    after(() => executePost(post.id).then(() => {}));
    return json({ success: true, post_id: post.id, status: "processing", targets, poll: `/api/v1/posts/${post.id}` }, 202);
  }
  const result = await executePost(post.id);
  return json({ success: result.status !== "failed", post_id: post.id, ...result });
}
