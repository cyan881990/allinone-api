"use client";

import { useActionState, useEffect, useState } from "react";
import { sendFromConsole, type SendState } from "../actions";
import type { ConnView } from "./patch-bay";

function tzOffset() {
  const m = -new Date().getTimezoneOffset();
  const s = m >= 0 ? "+" : "-";
  const a = Math.abs(m);
  return `${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

export function Console({ remoteId, connections }: { remoteId: string; connections: ConnView[] }) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendFromConsole, {});
  const [tz, setTz] = useState("+07:00");
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => setTz(tzOffset()), []);

  const result = state.result as any;

  return (
    <form action={action} className="panel space-y-4 p-5">
      <h2 className="font-bold">Đăng thử</h2>
      <input type="hidden" name="remote_id" value={remoteId} />
      <input type="hidden" name="tz" value={tz} />

      {connections.length === 0 ? (
        <p className="text-sm text-muted">Nối và bật ít nhất một API con để đăng thử.</p>
      ) : (
        <fieldset>
          <legend className="field-label">Gửi tới</legend>
          <div className="flex flex-wrap gap-2">
            {connections.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-paper">
                <input type="checkbox" name="targets" value={c.label} defaultChecked className="accent-[#1a2238]" />
                <span className="h-3.5 w-1 rounded-full" style={{ background: c.color }} />
                <span className="font-mono">{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label className="field-label" htmlFor="text">Nội dung</label>
        <textarea id="text" name="text" rows={3} className="input" placeholder="Caption / nội dung bài đăng" />
      </div>
      <div>
        <label className="field-label" htmlFor="media">URL ảnh/video công khai</label>
        <textarea id="media" name="media" rows={2} className="input font-mono text-[13px]" placeholder={"https://.../video.mp4\nhttps://.../anh.jpg"} />
        <p className="hint">Mỗi dòng một URL. Đuôi .mp4/.mov được hiểu là video.</p>
      </div>

      <button type="button" className="text-sm font-semibold underline" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
        {advanced ? "Ẩn tuỳ chọn thêm" : "Tiêu đề, link, hẹn giờ, options"}
      </button>
      {advanced && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="title">Tiêu đề (YouTube…)</label>
            <input id="title" name="title" className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="link">Link</label>
            <input id="link" name="link" className="input" placeholder="https://" />
          </div>
          <div>
            <label className="field-label" htmlFor="scheduled_at">Hẹn giờ ({tz})</label>
            <input id="scheduled_at" name="scheduled_at" type="datetime-local" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="options">Options (JSON)</label>
            <textarea id="options" name="options" rows={2} className="input font-mono text-[13px]" placeholder='{"youtube":{"privacy":"unlisted"}}' />
          </div>
        </div>
      )}

      {state.error && <p className="text-sm text-err" role="alert">{state.error}</p>}
      <button className="btn btn-signal w-full" disabled={pending || connections.length === 0}>{pending ? "Đang gửi tới các API con…" : "Đăng bài"}</button>

      {result && (
        <div className="rounded-md bg-paper p-3 text-sm" role="status">
          {result.status === "scheduled" ? (
            <p>Đã hẹn giờ. Bài sẽ được đăng khi cron chạy đến thời điểm đã chọn.</p>
          ) : (
            <ul className="space-y-1.5">
              {(result.results || []).map((r: any) => (
                <li key={r.connection_id} className="flex items-start gap-2">
                  <span className={`lamp mt-1.5 ${r.ok ? "lamp-ok" : "lamp-err"}`} />
                  <span className="min-w-0">
                    <span className="font-mono">{r.label}</span>{" "}
                    {r.ok ? (r.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer">xem bài</a> : "đã đăng") : <span className="text-err">{r.error}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
