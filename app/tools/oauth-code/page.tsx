import Link from "next/link";
import { CopyButton } from "@/components/copy";

export const metadata = { title: "Mã OAuth — AllInOne API", robots: { index: false } };

/**
 * Trang đích (redirect URI) khi tự lấy token: hiện code nền tảng trả về để người dùng copy.
 * Không lưu, không gửi code đi đâu cả.
 */
export default async function OAuthCodePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const code = sp.code;
  const error = sp.error_description || sp.error;

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="panel w-full max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-bold">Mã xác thực</h1>
        {code ? (
          <>
            <p className="text-sm text-muted">Copy mã dưới đây và dùng ngay cho bước đổi token (mã chỉ dùng được một lần, hết hạn sau vài phút).</p>
            <code className="block break-all rounded-md bg-paper px-3 py-2 font-mono text-[13px]">{code}</code>
            <CopyButton text={code} label="Sao chép mã" className="btn btn-signal w-full" />
            {sp.state && <p className="text-[13px] text-muted">state: <span className="font-mono">{sp.state}</span></p>}
          </>
        ) : error ? (
          <p className="text-sm text-err" role="alert">Nền tảng trả về lỗi: {error}</p>
        ) : (
          <p className="text-sm text-muted">Chưa có mã. Trang này dùng làm Redirect URI khi bạn tự lấy token theo hướng dẫn trong phần Nối API con.</p>
        )}
        <Link href="/dashboard" className="text-sm underline">Về bảng điều khiển</Link>
      </div>
    </main>
  );
}
