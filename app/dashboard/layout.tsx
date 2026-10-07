import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <nav className="flex items-center gap-5">
            <Link href="/dashboard" className="font-extrabold tracking-tight">AllInOne API</Link>
            <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink">API remote</Link>
            <Link href="/dashboard/docs" className="text-sm font-medium text-muted hover:text-ink">Tài liệu API</Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.email?.split("@")[0]}</span>
            <form action="/auth/signout" method="post">
              <button className="btn btn-ghost !py-1.5">Đăng xuất</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
