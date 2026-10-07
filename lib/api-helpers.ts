import "server-only";
import { NextResponse } from "next/server";
import { randomToken } from "./crypto";
import { authenticateApiKey, type RemoteApi } from "./dispatch";
import { admin } from "./supabase/admin";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: CORS });
export const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => json({ success: false, error, ...extra }, status);
export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });

export async function withApi(req: Request): Promise<RemoteApi | NextResponse> {
  const api = await authenticateApiKey(req.headers.get("authorization"));
  return api ?? fail("API key không hợp lệ. Gửi header: Authorization: Apikey aio_...", 401);
}

/** Đọc body JSON hoặc multipart/form-data (giống upload-post: -F 'platform[]=tiktok' -F 'video=@file.mp4') */
export async function readBody(req: Request, api: RemoteApi): Promise<Record<string, any>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return req.json();
  if (!ct.includes("multipart/form-data") && !ct.includes("application/x-www-form-urlencoded")) return req.json();

  const form = await req.formData();
  const body: Record<string, any> = { media: [] as { url: string; type: string }[] };
  for (const [rawKey, value] of form.entries()) {
    const key = rawKey.replace(/\[\]$/, "");
    if (typeof value !== "string") {
      const kind = key === "video" || value.type.startsWith("video/") ? "video" : "image";
      body.media.push({ url: await storeUpload(api, value), type: kind });
      continue;
    }
    if (key === "platform" || key === "platforms") (body.platforms ||= []).push(value);
    else if (key === "media" || key === "image_url" || key === "video_url")
      body.media.push({ url: value, type: key === "video_url" ? "video" : key === "image_url" ? "image" : undefined });
    else if (key === "options") {
      try { body.options = JSON.parse(value); } catch { /* bỏ qua */ }
    } else if (key === "async") body.async = value === "true" || value === "1";
    else body[key] = value;
  }
  return body;
}

async function storeUpload(api: RemoteApi, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${api.owner_id}/${api.id}/${Date.now()}-${randomToken(6)}.${ext}`;
  const { error } = await admin().storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Lưu file thất bại: ${error.message}`);
  return admin().storage.from("media").getPublicUrl(path).data.publicUrl;
}
