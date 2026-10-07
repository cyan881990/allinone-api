"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnedRemote, insertConnection } from "@/lib/connections";
import { decryptJSON, generateApiKey } from "@/lib/crypto";
import { createPost, executePost, normalizeRequest, type RemoteApi } from "@/lib/dispatch";
import { getPlatform } from "@/lib/platforms";
import { admin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

export type KeyState = { error?: string; key?: string; id?: string };

/* ---------- API remote ---------- */
export async function createRemoteApi(_: KeyState, form: FormData): Promise<KeyState> {
  const user = await requireUser();
  const name = String(form.get("name") || "").trim();
  if (!name) return { error: "Đặt tên cho API remote." };
  const k = generateApiKey();
  const { data, error } = await admin()
    .from("remote_apis")
    .insert({ owner_id: user.id, name, description: String(form.get("description") || "") || null, key_prefix: k.prefix, key_hash: k.hash })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { key: k.raw, id: data.id };
}

export async function rotateKey(remoteId: string): Promise<KeyState> {
  const user = await requireUser();
  if (!(await getOwnedRemote(remoteId, user.id))) return { error: "Không tìm thấy API remote" };
  const k = generateApiKey();
  const { error } = await admin().from("remote_apis").update({ key_prefix: k.prefix, key_hash: k.hash }).eq("id", remoteId).eq("owner_id", user.id);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/${remoteId}`);
  return { key: k.raw, id: remoteId };
}

export async function updateRemote(remoteId: string, form: FormData) {
  const user = await requireUser();
  await admin()
    .from("remote_apis")
    .update({
      name: String(form.get("name") || "").trim() || "API remote",
      description: String(form.get("description") || "") || null,
    })
    .eq("id", remoteId)
    .eq("owner_id", user.id);
  revalidatePath(`/dashboard/${remoteId}`);
}

export async function setRemoteActive(remoteId: string, active: boolean) {
  const user = await requireUser();
  await admin().from("remote_apis").update({ active }).eq("id", remoteId).eq("owner_id", user.id);
  revalidatePath(`/dashboard/${remoteId}`);
}

export async function deleteRemote(remoteId: string) {
  const user = await requireUser();
  await admin().from("remote_apis").delete().eq("id", remoteId).eq("owner_id", user.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/* ---------- API con ---------- */
export type ConnState = { error?: string; ok?: string };

export async function addTokenConnection(_: ConnState, form: FormData): Promise<ConnState> {
  const user = await requireUser();
  const remoteId = String(form.get("remote_id"));
  const platform = String(form.get("platform"));
  const def = getPlatform(platform);
  if (!def || def.auth !== "token") return { error: "Nền tảng không hợp lệ" };
  if (!(await getOwnedRemote(remoteId, user.id))) return { error: "Không tìm thấy API remote" };

  const creds: Record<string, string> = {};
  for (const f of def.fields || []) {
    const v = String(form.get(f.key) || "").trim();
    if (!v && !f.optional) return { error: `Thiếu "${f.label}"` };
    if (v) creds[f.key] = v;
  }
  let displayName: string | undefined;
  try {
    displayName = await def.verify?.(creds);
  } catch (e: any) {
    return { error: `Không xác thực được với ${def.name}: ${e?.message || e}` };
  }
  try {
    const conn = await insertConnection({
      remoteApiId: remoteId,
      ownerId: user.id,
      platform,
      label: String(form.get("label") || "").trim() || `${platform}-${displayName || "acc"}`,
      displayName,
      credentials: creds,
    });
    revalidatePath(`/dashboard/${remoteId}`);
    return { ok: `Đã thêm ${conn.label}` };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}

async function ownedConnection(connId: string, ownerId: string) {
  const { data } = await admin().from("connections").select("*").eq("id", connId).eq("owner_id", ownerId).maybeSingle();
  return data;
}

export async function setConnectionEnabled(connId: string, enabled: boolean) {
  const user = await requireUser();
  const c = await ownedConnection(connId, user.id);
  if (!c) return;
  await admin().from("connections").update({ enabled }).eq("id", connId);
  revalidatePath(`/dashboard/${c.remote_api_id}`);
}

export async function deleteConnection(connId: string) {
  const user = await requireUser();
  const c = await ownedConnection(connId, user.id);
  if (!c) return;
  await admin().from("connections").delete().eq("id", connId);
  revalidatePath(`/dashboard/${c.remote_api_id}`);
}

export async function checkConnection(connId: string): Promise<ConnState> {
  const user = await requireUser();
  const c = await ownedConnection(connId, user.id);
  if (!c) return { error: "Không tìm thấy" };
  const def = getPlatform(c.platform);
  try {
    if (def?.verify) {
      const name = await def.verify(decryptJSON(c.credentials));
      await admin().from("connections").update({ status: "ok", last_error: null, display_name: name || c.display_name }).eq("id", connId);
      revalidatePath(`/dashboard/${c.remote_api_id}`);
      return { ok: `Kết nối tốt: ${name || c.label}` };
    }
    return { ok: "Nền tảng OAuth: token được kiểm tra khi đăng bài" };
  } catch (e: any) {
    const msg = String(e?.message || e);
    await admin().from("connections").update({ status: "error", last_error: msg }).eq("id", connId);
    revalidatePath(`/dashboard/${c.remote_api_id}`);
    return { error: msg };
  }
}

/* ---------- Console thử đăng bài ---------- */
export type SendState = { error?: string; result?: Awaited<ReturnType<typeof executePost>> | { id: string; status: string } };

export async function sendFromConsole(_: SendState, form: FormData): Promise<SendState> {
  const user = await requireUser();
  const remoteId = String(form.get("remote_id"));
  const remote = await getOwnedRemote(remoteId, user.id);
  if (!remote) return { error: "Không tìm thấy API remote" };
  const mediaLines = String(form.get("media") || "").split(/\s+/).filter(Boolean);
  let options = {};
  const rawOpts = String(form.get("options") || "").trim();
  if (rawOpts) {
    try { options = JSON.parse(rawOpts); } catch { return { error: "Options phải là JSON hợp lệ" }; }
  }
  const scheduledLocal = String(form.get("scheduled_at") || "");
  const parsed = normalizeRequest({
    text: String(form.get("text") || ""),
    title: String(form.get("title") || "") || undefined,
    link: String(form.get("link") || "") || undefined,
    media: mediaLines,
    platforms: form.getAll("targets").map(String),
    options,
    scheduled_at: scheduledLocal ? new Date(scheduledLocal + String(form.get("tz") || "")).toISOString() : undefined,
  });
  if (!parsed.ok) return { error: parsed.error };
  if (!parsed.value.platforms?.length) return { error: "Chọn ít nhất 1 API con" };

  const post = await createPost(remote as RemoteApi, parsed.value, "dashboard");
  revalidatePath(`/dashboard/${remoteId}`);
  if (post.status === "scheduled") return { result: { id: post.id, status: "scheduled" } };
  const result = await executePost(post.id);
  revalidatePath(`/dashboard/${remoteId}`);
  return { result };
}

export async function cancelPost(postId: string) {
  const user = await requireUser();
  const { data } = await admin()
    .from("posts")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("owner_id", user.id)
    .eq("status", "scheduled")
    .select("remote_api_id");
  if (data?.[0]) revalidatePath(`/dashboard/${data[0].remote_api_id}`);
}
