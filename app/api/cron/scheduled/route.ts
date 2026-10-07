import { NextResponse } from "next/server";
import { runDueScheduled } from "@/lib/dispatch";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Chạy các bài hẹn giờ đã đến hạn. Gọi bởi Vercel Cron hoặc cron ngoài với header Authorization: Bearer CRON_SECRET */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const qs = new URL(req.url).searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runDueScheduled();
  return NextResponse.json({ ran: results.length, results });
}
