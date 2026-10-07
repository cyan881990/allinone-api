import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnedRemote } from "@/lib/connections";
import { oauthConfigured } from "@/lib/oauth";
import { PLATFORMS, PLATFORM_MAP, platformMeta } from "@/lib/platforms";
import { admin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
import { cancelPost } from "../actions";
import { AddConnection } from "./add-connection";
import { ApiSnippet } from "./api-snippet";
import { Console } from "./console";
import { PatchBay } from "./patch-bay";
import { RemoteControls } from "./remote-controls";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { text: string; cls: string }> = {
  success: { text: "Thành công", cls: "text-ok" },
  partial: { text: "Một phần", cls: "text-signal-ink" },
  failed: { text: "Thất bại", cls: "text-err" },
  scheduled: { text: "Đã hẹn giờ", cls: "text-ink" },
  processing: { text: "Đang chạy", cls: "text-muted" },
  cancelled: { text: "Đã huỷ", cls: "text-muted" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

export default async function RemotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const remote = await getOwnedRemote(id, user.id);
  if (!remote) notFound();

  const db = admin();
  const [{ data: conns }, { data: posts }] = await Promise.all([
    db
      .from("connections")
      .select("id, platform, label, display_name, enabled, status, last_error, created_at")
      .eq("remote_api_id", id)
      .order("created_at"),
    db
      .from("posts")
      .select("id, status, targets, scheduled_at, results, payload, source, created_at")
      .eq("remote_api_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const metas = PLATFORMS.map((p) => ({ ...platformMeta(p), oauthReady: p.auth === "oauth" ? oauthConfigured(p.id) : true }));
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const connections = (conns || []).map((c) => ({ ...c, color: PLATFORM_MAP[c.platform]?.color || "#888", platformName: PLATFORM_MAP[c.platform]?.name || c.platform }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">Tất cả API remote</Link>
        <RemoteControls remote={remote} />
      </div>

      {sp.error && <p className="rounded-lg border border-[#efc2c2] bg-[#fdf1f1] px-4 py-3 text-sm text-err" role="alert">{sp.error}</p>}
      {sp.connected && <p className="rounded-lg border border-[#b9e2d1] bg-[#effaf5] px-4 py-3 text-sm text-ok" role="status">Đã kết nối {sp.connected}.</p>}

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="text-lg font-bold">API con</h2>
          <p className="text-sm text-muted">Gọi theo label (một tài khoản) hoặc theo tên nền tảng (mọi tài khoản của nền tảng đó).</p>
          <PatchBay remoteName={remote.name} connections={connections} />
        </div>
        <AddConnection remoteId={id} platforms={metas} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Console remoteId={id} connections={connections.filter((c) => c.enabled)} />
        <ApiSnippet appUrl={appUrl} keyPrefix={remote.key_prefix} labels={connections.map((c) => c.label)} platforms={[...new Set(connections.map((c) => c.platform))]} />
      </section>

      <section>
        <h2 className="text-lg font-bold">Lịch sử gọi API</h2>
        {!posts?.length ? (
          <p className="panel mt-3 p-6 text-sm text-muted">Chưa có lần gọi nào. Thử gửi một bài ở khung đăng thử phía trên.</p>
        ) : (
          <ul className="panel mt-3 divide-y divide-line">
            {posts.map((p) => {
              const s = STATUS[p.status] || { text: p.status, cls: "" };
              const results = (p.results?.results || []) as any[];
              return (
                <li key={p.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`font-semibold ${s.cls}`}>{s.text}</span>
                      <span className="ml-2 text-sm text-muted">
                        {fmt(p.created_at)} · {p.source === "api" ? "qua API" : "từ dashboard"}
                        {p.scheduled_at && ` · hẹn ${fmt(p.scheduled_at)}`}
                      </span>
                      <p className="mt-1 truncate text-sm">{p.payload?.text || p.payload?.title || (p.payload?.media?.[0]?.url ?? "")}</p>
                    </div>
                    {p.status === "scheduled" && (
                      <form action={cancelPost.bind(null, p.id)}>
                        <button className="btn btn-danger !py-1 text-[13px]">Huỷ hẹn giờ</button>
                      </form>
                    )}
                  </div>
                  {results.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {results.map((r) => (
                        <li key={r.connection_id} className="flex max-w-full items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[13px]" title={r.error || ""}>
                          <span className={`lamp ${r.ok ? "lamp-ok" : "lamp-err"}`} />
                          {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="underline">{r.label}</a> : r.label}
                          {!r.ok && <span className="truncate text-err">— {r.error}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
