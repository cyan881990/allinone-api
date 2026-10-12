import { NextResponse } from "next/server";
import { insertConnection } from "@/lib/connections";
import { decryptJSON, encryptJSON } from "@/lib/crypto";
import { igExchangeCode, igLongLived, igMe } from "@/lib/instagram-oauth";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Redirect URI của "Đăng nhập Instagram". Không cần đăng nhập web app:
 * state ngẫu nhiên (dùng 1 lần, hết hạn 30 phút) chứng minh URL do chủ web app tạo,
 * nên có thể gửi URL cho chủ tài khoản Instagram tự cấp quyền.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const denied = url.searchParams.get("error_description") || url.searchParams.get("error_reason") || url.searchParams.get("error");

  const result = (params: Record<string, string>) => {
    const r = new URL("/tools/oauth-result", url.origin);
    r.searchParams.set("platform", "instagram");
    for (const [k, v] of Object.entries(params)) r.searchParams.set(k, v);
    return NextResponse.redirect(r, { status: 303 });
  };

  if (!state) return result({ status: "error", message: "Thiếu state — hãy mở đúng URL xác thực được tạo trong bảng điều khiển." });

  const db = admin();
  // Giữ chỗ nguyên tử: chỉ một lần gọi được xử lý state này
  const { data: rows } = await db
    .from("oauth_states")
    .update({ status: "processing" })
    .eq("id", state)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("*");
  const row = rows?.[0];
  if (!row) return result({ status: "error", message: "URL xác thực đã được dùng hoặc đã hết hạn (30 phút). Hãy tạo URL mới trong bảng điều khiển." });

  const fail = async (message: string) => {
    await db.from("oauth_states").update({ status: "error", result: { error: message } }).eq("id", state);
    return result({ status: "error", message });
  };

  if (denied) return fail(`Instagram từ chối: ${denied}`);
  if (!code) return fail("Instagram không trả mã xác thực (code).");

  try {
    const { app_id, app_secret, label } = decryptJSON<{ app_id: string; app_secret: string; label?: string }>(row.payload);
    const short = await igExchangeCode(app_id, app_secret, code);
    const long = await igLongLived(app_secret, short.access_token);
    const me = await igMe(long.access_token);
    const account = me.username ? `@${me.username}` : me.user_id;

    const credentials = {
      ig_user_id: me.user_id,
      access_token: long.access_token,
      host: "graph.instagram.com",
      expires_at: Date.now() + long.expires_in * 1000,
      token_issued_at: Date.now(),
      app_id,
      app_secret,
      auth: "instagram_login",
    };

    // Tài khoản này đã có trong API remote → cập nhật token thay vì tạo trùng
    const { data: existing } = await db
      .from("connections")
      .select("id, label, credentials")
      .eq("remote_api_id", row.remote_api_id)
      .eq("platform", "instagram");
    const same = (existing || []).find((c) => {
      try {
        return decryptJSON<{ ig_user_id?: string }>(c.credentials).ig_user_id === me.user_id;
      } catch {
        return false;
      }
    });

    let finalLabel: string;
    if (same) {
      await db
        .from("connections")
        .update({ credentials: encryptJSON(credentials), display_name: account, enabled: true, status: "ok", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", same.id);
      finalLabel = same.label;
    } else {
      const conn = await insertConnection({
        remoteApiId: row.remote_api_id,
        ownerId: row.owner_id,
        platform: "instagram",
        label: label || `instagram-${me.username || me.user_id}`,
        displayName: account,
        credentials,
      });
      finalLabel = conn.label;
    }

    await db.from("oauth_states").update({ status: "done", result: { label: finalLabel, account, updated: !!same } }).eq("id", state);
    const { data: remote } = await db.from("remote_apis").select("name").eq("id", row.remote_api_id).maybeSingle();
    return result({ status: "ok", account, label: finalLabel, remote: remote?.name || "", remote_id: row.remote_api_id, updated: same ? "1" : "" });
  } catch (e: any) {
    return fail(`Lấy token thất bại: ${String(e?.message || e).slice(0, 400)}`);
  }
}
