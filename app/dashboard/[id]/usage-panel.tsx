import { windowLabel } from "@/lib/platforms/limits";
import type { ConnLimit, UsageStats } from "@/lib/usage";

type Props = {
  stats: UsageStats;
  limits: (ConnLimit & { platformName: string; color: string; displayName: string | null })[];
};

const vn = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

const dayLabel = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

/** Ngưỡng cảnh báo: xanh < 70% ≤ vàng < 90% ≤ đỏ */
function tone(percent: number | null) {
  if (percent === null) return { bar: "var(--color-line)", text: "text-muted" };
  if (percent >= 90) return { bar: "var(--color-err)", text: "text-err" };
  if (percent >= 70) return { bar: "var(--color-signal)", text: "text-signal-ink" };
  return { bar: "var(--color-ok)", text: "text-ok" };
}

export function UsagePanel({ stats, limits }: Props) {
  if (!stats.available) {
    return (
      <section>
        <h2 className="text-lg font-bold">Thống kê &amp; giới hạn</h2>
        <div className="panel mt-3 p-6">
          <p className="font-semibold">Chưa bật theo dõi</p>
          <p className="mt-1 text-sm text-muted">
            Cần chạy migration <code className="inline">supabase/migrations/003_usage_events.sql</code> trên Supabase để
            bắt đầu đếm lượt gọi. Sau khi chạy, lịch sử cũ được dựng lại tự động và số liệu hiện ngay tại đây.
          </p>
        </div>
      </section>
    );
  }

  const maxDay = Math.max(1, ...stats.daily.map((d) => d.ok + d.failed));
  const near = limits.filter((l) => l.percent !== null && l.percent >= 70);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Thống kê &amp; giới hạn</h2>
        <p className="text-sm text-muted">30 ngày gần nhất · giờ Việt Nam</p>
      </div>

      {near.length > 0 && (
        <p className="mt-3 rounded-lg border border-[#f0dca8] bg-[#fdf7e8] px-4 py-3 text-sm text-signal-ink" role="status">
          Sắp chạm giới hạn: {near.map((l) => `${l.label} (${l.used}/${l.max})`).join(", ")}. Khi chạm trần, bài gửi thêm
          bị dừng ngay tại AllInOne API thay vì gọi lên nền tảng.
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="24 giờ qua" value={stats.last24h} unit="lượt" />
        <Tile label="7 ngày" value={stats.last7d} unit="lượt" />
        <Tile label="30 ngày" value={stats.last30d} unit="lượt" />
        <Tile
          label="Tỉ lệ thành công"
          value={stats.successRate === null ? "—" : `${stats.successRate}%`}
          sub={`${stats.ok} thành công · ${stats.failed} lỗi`}
        />
        <Tile label="Thời gian trung bình" value={stats.avgMs === null ? "—" : (stats.avgMs / 1000).toFixed(1)} unit="giây" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="panel p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Lượt đăng 14 ngày</h3>
            <ul className="flex gap-3 text-[13px] text-muted">
              <li className="flex items-center gap-1.5"><span className="lamp lamp-ok" />Thành công</li>
              <li className="flex items-center gap-1.5"><span className="lamp lamp-err" />Lỗi</li>
            </ul>
          </div>

          {stats.last30d === 0 ? (
            <p className="mt-4 text-sm text-muted">Chưa có lượt gọi nào trong 30 ngày qua.</p>
          ) : (
            <ol className="mt-4 flex h-44 items-end gap-1.5">
              {stats.daily.map((d) => {
                const total = d.ok + d.failed;
                const h = total === 0 ? 0 : Math.max(6, Math.round((total / maxDay) * 150));
                return (
                  <li key={d.date} className="group relative flex flex-1 flex-col items-center justify-end gap-1.5">
                    <div
                      className="relative hidden -translate-y-1 rounded-md bg-ink px-2 py-1 text-[12px] whitespace-nowrap text-white group-hover:block"
                      role="tooltip"
                    >
                      {dayLabel(d.date)}: {d.ok} thành công{d.failed > 0 && `, ${d.failed} lỗi`}
                    </div>
                    {total === 0 ? (
                      <span
                        className="block w-full max-w-10 rounded-full bg-line"
                        style={{ height: 3 }}
                        title={`${dayLabel(d.date)}: không có lượt nào`}
                      />
                    ) : (
                      <div
                        className="flex w-full max-w-10 flex-col justify-end gap-[2px] overflow-hidden rounded-t-[4px]"
                        style={{ height: h }}
                        title={`${dayLabel(d.date)}: ${d.ok} thành công, ${d.failed} lỗi`}
                      >
                        {d.failed > 0 && (
                          <span
                            className="block w-full rounded-t-[4px]"
                            style={{ background: "var(--color-err)", flexGrow: d.failed, minHeight: 3 }}
                          />
                        )}
                        {d.ok > 0 && (
                          <span
                            className={`block w-full ${d.failed === 0 ? "rounded-t-[4px]" : ""}`}
                            style={{ background: "var(--color-ok)", flexGrow: d.ok, minHeight: 3 }}
                          />
                        )}
                      </div>
                    )}
                    <span className="text-[11px] text-muted tabular-nums">{dayLabel(d.date)}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {stats.byPlatform.length > 0 && (
            <ul className="mt-5 divide-y divide-line border-t border-line pt-1 text-sm">
              {stats.byPlatform.map((p) => (
                <li key={p.platform} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="font-medium">{p.platform}</span>
                  <span className="text-muted">
                    {p.total} lượt · {p.ok} thành công
                    {p.failed > 0 && <span className="text-err"> · {p.failed} lỗi</span>}
                    {p.last24h > 0 && ` · ${p.last24h} trong 24 giờ`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <h3 className="font-semibold">Giới hạn từng API con</h3>
          <p className="hint">Đếm từ dữ liệu của AllInOne API. Bài đăng ngoài hệ thống này không được tính.</p>

          {limits.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Chưa nối API con nào.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {limits.map((l) => {
                const t = tone(l.percent);
                return (
                  <li key={l.connection_id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="min-w-0 truncate font-mono text-[13.5px] font-medium" title={l.displayName || undefined}>
                        {l.label}
                      </span>
                      <span className={`shrink-0 text-[13px] tabular-nums ${t.text}`}>
                        {l.max === null ? `${l.used} lượt` : `${l.used}/${l.max}`}
                        <span className="text-muted"> / {windowLabel(l.countMinutes)}</span>
                      </span>
                    </div>

                    {/* Số liệu đã có dạng chữ ngay trên, thanh này chỉ để nhìn nhanh. */}
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e1e6ee]" aria-hidden>
                      <div className="h-full rounded-full" style={{ width: `${l.percent ?? 0}%`, background: t.bar }} />
                    </div>

                    <p className="hint">
                      {l.kind === "unknown" ? "Nền tảng không công bố trần cụ thể. " : ""}
                      {l.text}
                    </p>
                    {l.reported && (
                      <p className="hint">
                        {l.reported.source} báo: {l.reported.used}/{l.reported.max}.
                      </p>
                    )}
                    {l.resetsAt && l.percent !== null && l.percent >= 70 && (
                      <p className="hint">Có thêm chỗ trống từ {vn(l.resetsAt)}.</p>
                    )}
                    <a href={l.docs} target="_blank" rel="noreferrer" className="hint underline">
                      Tài liệu giới hạn của {l.platformName}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {stats.topErrors.length > 0 && (
        <div className="panel mt-6 p-5">
          <h3 className="font-semibold">Lỗi hay gặp</h3>
          <ul className="mt-3 divide-y divide-line text-sm">
            {stats.topErrors.map((e) => (
              <li key={e.error} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 flex-1 truncate" title={e.error}>{e.error}</span>
                <span className="shrink-0 tabular-nums text-muted">{e.count} lần</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, unit, sub }: { label: string; value: number | string; unit?: string; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-muted">{unit}</span>}
      </p>
      {sub && <p className="hint">{sub}</p>}
    </div>
  );
}
