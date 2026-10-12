export const metadata = { title: "Yêu cầu xoá dữ liệu — AllInOne API", robots: { index: false } };

export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="panel w-full max-w-md space-y-3 p-6 text-[15px]">
        <h1 className="text-xl font-bold">Yêu cầu xoá dữ liệu</h1>
        {code && (
          <p>
            Mã xác nhận: <code className="inline">{code}</code>
          </p>
        )}
        <p>Web app này chỉ lưu ID tài khoản Instagram và token truy cập (đã mã hoá) để đăng bài theo yêu cầu của chủ web app.</p>
        <p>Khi bạn gỡ quyền của app trong Instagram, token mất hiệu lực ngay và không thể dùng để đăng bài nữa. Chủ web app sẽ gỡ kết nối khỏi hệ thống.</p>
      </div>
    </main>
  );
}
