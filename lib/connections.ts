import "server-only";
import { encryptJSON } from "./crypto";
import { admin } from "./supabase/admin";

export function slugify(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "acc"
  );
}

/** Label duy nhất trong 1 API remote, vd "tiktok-shop-a", "tiktok-shop-a-2" */
export async function uniqueLabel(remoteApiId: string, wanted: string) {
  const base = slugify(wanted);
  const { data } = await admin().from("connections").select("label").eq("remote_api_id", remoteApiId).like("label", `${base}%`);
  const taken = new Set((data || []).map((r) => r.label));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function insertConnection(args: {
  remoteApiId: string;
  ownerId: string;
  platform: string;
  label?: string;
  displayName?: string;
  credentials: Record<string, unknown>;
}) {
  const label = await uniqueLabel(args.remoteApiId, args.label || `${args.platform}-${args.displayName || "acc"}`);
  const { data, error } = await admin()
    .from("connections")
    .insert({
      remote_api_id: args.remoteApiId,
      owner_id: args.ownerId,
      platform: args.platform,
      label,
      display_name: args.displayName || null,
      credentials: encryptJSON(args.credentials),
    })
    .select("id, label")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getOwnedRemote(remoteId: string, ownerId: string) {
  const { data } = await admin()
    .from("remote_apis")
    .select("id, owner_id, name, description, key_prefix, active, created_at, last_used_at")
    .eq("id", remoteId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data;
}
