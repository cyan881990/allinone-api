import { NextResponse } from "next/server";
import { json, preflight, withApi } from "@/lib/api-helpers";

export const OPTIONS = preflight;

/** GET /api/v1/me — kiểm tra API key */
export async function GET(req: Request) {
  const api = await withApi(req);
  if (api instanceof NextResponse) return api;
  return json({ success: true, remote_api: { id: api.id, name: api.name } });
}
