import { NextResponse } from "next/server";
import { randomToken } from "@/lib/crypto";

/**
 * Data deletion request callback của Meta. Meta yêu cầu trả về
 * { url: trang theo dõi yêu cầu, confirmation_code }.
 */
export async function POST(req: Request) {
  const code = randomToken(9);
  const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  return NextResponse.json({ url: `${base}/tools/data-deletion?code=${code}`, confirmation_code: code });
}
