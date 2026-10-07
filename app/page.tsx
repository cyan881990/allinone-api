import Link from "next/link";
import { PLATFORMS } from "@/lib/platforms";
import { getUser } from "@/lib/supabase/server";

const SAMPLE = `curl -X POST https://your-app.vercel.app/api/v1/post \\
  -H "Authorization: Apikey aio_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Ra mắt bộ sưu tập thu 2026",
    "media": [{ "url": "https://cdn.shop.vn/teaser.mp4" }],
    "platforms": ["tiktok", "youtube", "facebook"]
  }'`;

export default async function Home() {
  const user = await getUser().catch(() => null);
  const shown = PLATFORMS.slice(0, 8);

  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-lg font-extrabold tracking-tight">AllInOne API</span>
        <Link href={user ? "/dashboard" : "/login"} className="btn btn-ghost">
          {user ? "Vào bảng điều khiển" : "Đăng nhập"}
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div>
          <h1 className="max-w-[16ch] text-[2.6rem] font-extrabold leading-[1.08] tracking-tight sm:text-[3.4rem]">
            Một lệnh gọi. Mọi mạng xã hội của bạn.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[17px] text-muted">
            Tạo một API remote, nối vào đó các tài khoản TikTok, YouTube, Facebook, Telegram… rồi đăng lên tất cả, hoặc chỉ những
            kênh bạn chọn, bằng đúng một request.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? "/dashboard" : "/login?mode=signup"} className="btn btn-signal">
              Tạo API remote đầu tiên
            </Link>
            <a href="#api" className="btn btn-ghost">Xem cách gọi API</a>
          </div>
        </div>

        <FanOut names={shown.map((p) => ({ name: p.name, color: p.color }))} />
      </section>

      <section id="api" className="border-t border-line bg-panel">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Chọn API con ngay trong request</h2>
            <p className="mt-3 max-w-[52ch] text-muted">
              Trường <code className="inline">platforms</code> nhận tên nền tảng (đăng lên mọi tài khoản của nền tảng đó) hoặc label của
              một API con cụ thể như <code className="inline">tiktok-shop-a</code>. Bỏ trống để đăng lên tất cả API con đang bật.
            </p>
            <ul className="mt-6 space-y-2 text-[14.5px]">
              <li>Mỗi API remote có API key riêng, cấp lại bất cứ lúc nào.</li>
              <li>Token được mã hoá AES-256 và tự làm mới với nền tảng OAuth.</li>
              <li>Hẹn giờ bằng <code className="inline">scheduled_at</code>, xem kết quả từng kênh trong lịch sử.</li>
            </ul>
          </div>
          <pre className="code">{SAMPLE}</pre>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-bold tracking-tight">Nền tảng hỗ trợ</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-sm font-medium">
              <span className="lamp" style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">AllInOne API</footer>
    </main>
  );
}

/** Sơ đồ: 1 request toả ra nhiều API con */
function FanOut({ names }: { names: { name: string; color: string }[] }) {
  const rowH = 46;
  const h = names.length * rowH;
  return (
    <div className="panel relative overflow-hidden p-5" aria-hidden>
      <div className="flex items-stretch gap-0">
        <div className="flex w-[38%] items-center">
          <div className="w-full rounded-lg bg-ink p-4 text-white">
            <div className="text-[13px] text-[#9fb0cf]">POST /api/v1/post</div>
            <div className="mt-1 font-semibold">API remote “Shop thời trang”</div>
          </div>
        </div>
        <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-[18%]" style={{ height: h }}>
          {names.map((_, i) => {
            const y = i * rowH + rowH / 2;
            return <path key={i} d={`M0 ${h / 2} C 55 ${h / 2}, 45 ${y}, 100 ${y}`} fill="none" stroke="#9aa5b8" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        <ul className="flex-1">
          {names.map((n) => (
            <li key={n.name} className="flex items-center gap-2.5 text-sm font-medium" style={{ height: rowH }}>
              <span className="lamp lamp-ok" />
              <span className="truncate whitespace-nowrap rounded-md border border-line px-2.5 py-1" style={{ borderLeft: `3px solid ${n.color}` }}>
                {n.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
