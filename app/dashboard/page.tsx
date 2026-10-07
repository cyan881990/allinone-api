import Link from "next/link";
import { admin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
import { PLATFORM_MAP } from "@/lib/platforms";
import { CreateRemote } from "./create-remote";

export const dynamic = "force-dynamic";

function ago(iso: string | null) {
  if (!iso) return "chưa gọi lần nào";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const db = admin();
  const [{ data: remotes }, { data: conns }] = await Promise.all([
    db.from("remote_apis").select("id, name, description, key_prefix, active, last_used_at, created_at").eq("owner_id", user.id).order("created_at"),
    db.from("connections").select("remote_api_id, platform, enabled, status").eq("owner_id", user.id),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">API remote của bạn</h1>
        <p className="mt-1 text-muted">Mỗi API remote có API key riêng và gom một nhóm API con, ví dụ mỗi khách hàng hoặc mỗi thương hiệu một API remote.</p>

        {!remotes?.length ? (
          <div className="panel mt-6 p-8 text-center">
            <p className="font-semibold">Chưa có API remote nào</p>
            <p className="mt-1 text-sm text-muted">Tạo API remote đầu tiên ở khung bên cạnh, sau đó nối các tài khoản mạng xã hội vào.</p>
          </div>
        ) : (
          <ul className="panel mt-6 divide-y divide-line">
            {remotes.map((r) => {
              const mine = (conns || []).filter((c) => c.remote_api_id === r.id);
              const errs = mine.filter((c) => c.status === "error" && c.enabled).length;
              return (
                <li key={r.id}>
                  <Link href={`/dashboard/${r.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-paper/60">
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <span className={`lamp ${r.active ? "lamp-ok" : "lamp-off"}`} />
                        {r.name}
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted">
                        <span className="font-mono">{r.key_prefix}…</span> · {ago(r.last_used_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {mine.length === 0 && <span className="text-sm text-muted">Chưa có API con</span>}
                      {mine.slice(0, 8).map((c, i) => (
                        <span key={i} className="h-6 w-1.5 rounded-full" style={{ background: PLATFORM_MAP[c.platform]?.color || "#999", opacity: c.enabled ? 1 : 0.3 }} title={c.platform} />
                      ))}
                    </div>
                    <div className="w-32 text-right text-sm">
                      {mine.length} API con
                      {errs > 0 && <div className="text-err">{errs} lỗi</div>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside>
        <CreateRemote />
      </aside>
    </div>
  );
}
