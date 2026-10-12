import Link from "next/link";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Kết nối tài khoản — AllInOne API", robots: { index: false } };

export default async function OAuthResultPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ok = sp.status === "ok";
  const user = await getUser().catch(() => null);

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="panel w-full max-w-md space-y-4 p-6">
        <div className="flex items-center gap-2.5">
          <span className={`lamp ${ok ? "lamp-ok" : "lamp-err"}`} />
          <h1 className="text-xl font-bold">{ok ? (sp.updated ? "Đã làm mới kết nối Instagram" : "Đã kết nối Instagram") : "Chưa kết nối được"}</h1>
        </div>

        {ok ? (
          <div className="space-y-2 text-[15px]">
            <p>
              Tài khoản <b>{sp.account}</b> {sp.updated ? "đã được cấp token mới" : "đã được nối"}
              {sp.remote ? <> vào API remote <b>{sp.remote}</b></> : null}.
            </p>
            {sp.label && (
              <p className="text-sm text-muted">
                Label dùng khi gọi API: <code className="inline">{sp.label}</code>
              </p>
            )}
            <p className="text-sm text-muted">Token có hạn 60 ngày và được tự gia hạn mỗi khi đăng bài.</p>
          </div>
        ) : (
          <p className="text-sm text-err" role="alert">{sp.message || "Có lỗi xảy ra."}</p>
        )}

        {user ? (
          <Link href={sp.remote_id ? `/dashboard/${sp.remote_id}` : "/dashboard"} className="btn btn-signal w-full">
            Về bảng điều khiển
          </Link>
        ) : (
          <p className="text-sm text-muted">{ok ? "Bạn có thể đóng trang này." : "Hãy báo người đã gửi URL cho bạn để tạo URL mới."}</p>
        )}
      </div>
    </main>
  );
}
