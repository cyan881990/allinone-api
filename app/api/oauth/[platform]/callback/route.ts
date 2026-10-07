import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOwnedRemote, insertConnection } from "@/lib/connections";
import { providers, redirectUri } from "@/lib/oauth";
import { getUser } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ platform: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { platform } = await params;
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get(`oauth_${platform}`)?.value;
  jar.delete(`oauth_${platform}`);

  let saved: { state: string; verifier?: string; remote: string; label?: string } | null = null;
  try { saved = raw ? JSON.parse(raw) : null; } catch {}

  const back = new URL(`/dashboard/${saved?.remote || ""}`, url.origin);
  const bail = (msg: string) => {
    back.searchParams.set("error", msg);
    return NextResponse.redirect(back);
  };

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));
  if (url.searchParams.get("error")) return bail(url.searchParams.get("error_description") || url.searchParams.get("error")!);
  if (!saved || saved.state !== url.searchParams.get("state")) return bail("Phiên OAuth không hợp lệ hoặc đã hết hạn, thử lại");
  if (!(await getOwnedRemote(saved.remote, user.id))) return bail("Không tìm thấy API remote");

  const p = providers[platform];
  try {
    const tokens = await p.exchange(url.searchParams.get("code") || "", redirectUri(platform), saved.verifier);
    const prof = await p.profile(tokens);
    const conn = await insertConnection({
      remoteApiId: saved.remote,
      ownerId: user.id,
      platform,
      label: saved.label || `${platform}-${prof.name}`,
      displayName: prof.name,
      credentials: { ...tokens, ...(prof.extra || {}) },
    });
    back.searchParams.set("connected", conn.label);
    return NextResponse.redirect(back);
  } catch (e: any) {
    return bail(`Kết nối ${platform} thất bại: ${e?.message || e}`);
  }
}
