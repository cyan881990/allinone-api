import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOwnedRemote } from "@/lib/connections";
import { randomToken } from "@/lib/crypto";
import { buildAuthorizeUrl, oauthConfigured, providers } from "@/lib/oauth";
import { getUser } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ platform: string }> };

/** GET /api/oauth/:platform/start?remote=<id>&label=<tuỳ chọn> */
export async function GET(req: Request, { params }: Ctx) {
  const { platform } = await params;
  const url = new URL(req.url);
  const remote = url.searchParams.get("remote") || "";
  const back = new URL(`/dashboard/${remote}`, url.origin);

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));
  if (!providers[platform]) return NextResponse.json({ error: "Nền tảng không dùng OAuth" }, { status: 400 });
  if (!(await getOwnedRemote(remote, user.id))) return NextResponse.json({ error: "Không tìm thấy API remote" }, { status: 404 });
  if (!oauthConfigured(platform)) {
    back.searchParams.set("error", `Chưa cấu hình ${providers[platform].env.join(" / ")} trong biến môi trường`);
    return NextResponse.redirect(back);
  }

  const state = randomToken(16);
  const verifier = providers[platform].pkce ? randomToken(48) : undefined;
  (await cookies()).set(`oauth_${platform}`, JSON.stringify({ state, verifier, remote, label: url.searchParams.get("label") || "" }), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(buildAuthorizeUrl(platform, state, verifier));
}
