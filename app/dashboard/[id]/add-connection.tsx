"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PlatformGuideView } from "@/components/platform-guide";
import type { PlatformMeta } from "@/lib/platforms";
import { addTokenConnection, type ConnState } from "../actions";
import { InstagramOAuth, type IgOAuthConfig } from "./instagram-oauth";

export function AddConnection({
  remoteId,
  platforms,
  appUrl,
  igOAuth,
}: {
  remoteId: string;
  platforms: PlatformMeta[];
  appUrl: string;
  igOAuth: IgOAuthConfig;
}) {
  const [picked, setPicked] = useState<PlatformMeta | null>(null);
  const [mode, setMode] = useState<"oauth" | "token">("oauth");
  const [state, action, pending] = useActionState<ConnState, FormData>(addTokenConnection, {});
  const pick = (p: PlatformMeta | null) => {
    setPicked(p);
    setMode("oauth");
  };
  const oauth = picked?.oauth && mode === "oauth";
  const guide = oauth ? picked?.oauth : picked?.guide;

  return (
    <div className="panel h-fit p-5">
      <h2 className="font-bold">Nối API con</h2>
      {!picked ? (
        <>
          <p className="mt-1 text-sm text-muted">Chọn nền tảng, làm theo hướng dẫn lấy token rồi dán vào.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {platforms.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm font-medium hover:border-ink"
              >
                <span className="h-4 w-1.5 rounded-full" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
          {state.ok && <p className="mt-3 text-sm text-ok" role="status">{state.ok}</p>}
          <p className="mt-4 text-[13px] text-muted">
            Xem hướng dẫn của mọi nền tảng tại <Link href="/dashboard/docs#lay-token" className="underline">Tài liệu API</Link>.
          </p>
        </>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-4 w-1.5 rounded-full" style={{ background: picked.color }} />
              {picked.name}
            </span>
            <button type="button" className="text-sm text-muted underline" onClick={() => pick(null)}>Chọn nền tảng khác</button>
          </div>

          {picked.oauth && (
            <div className="grid grid-cols-2 rounded-md border border-line bg-paper p-0.5 text-[13px]" role="tablist" aria-label="Cách kết nối">
              {([
                ["oauth", `Đăng nhập ${picked.name}`],
                ["token", "Dán token"],
              ] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded px-2 py-1.5 font-medium ${mode === m ? "bg-panel shadow-[0_0_0_1px_var(--color-line)]" : "text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {guide && (
            <details key={mode} open={!oauth || undefined} className="rounded-md border border-line bg-paper/60 px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
              <summary className="cursor-pointer select-none text-sm font-semibold">
                {oauth ? `Thiết lập app ${picked.name} (làm một lần)` : `Cách lấy token ${picked.name}`}
              </summary>
              <div className="mt-2">
                <PlatformGuideView guide={guide} appUrl={appUrl} compact />
              </div>
            </details>
          )}

          {oauth ? (
            <InstagramOAuth remoteId={remoteId} config={igOAuth} />
          ) : (
          <form action={action} className="space-y-3">
            <input type="hidden" name="remote_id" value={remoteId} />
            <input type="hidden" name="platform" value={picked.id} />
            {picked.fields.map((f) => (
              <div key={f.key}>
                <label className="field-label" htmlFor={f.key}>{f.label}{f.optional && <span className="font-normal text-muted"> (tuỳ chọn)</span>}</label>
                <input id={f.key} name={f.key} type={f.type === "password" ? "password" : "text"} placeholder={f.placeholder} required={!f.optional} className="input" autoComplete="off" spellCheck={false} />
                {f.help && <p className="hint">{f.help}</p>}
              </div>
            ))}
            <div>
              <label className="field-label" htmlFor="label">Label <span className="font-normal text-muted">(tuỳ chọn)</span></label>
              <input id="label" name="label" className="input" placeholder={`vd: ${picked.id}-shop-a`} />
              <p className="hint">Tên dùng trong trường platforms khi gọi API. Bỏ trống để tự đặt.</p>
            </div>
            {picked.note && <p className="hint">{picked.note}</p>}
            {state.error && <p className="text-sm text-err" role="alert">{state.error}</p>}
            {state.ok && <p className="text-sm text-ok" role="status">{state.ok}</p>}
            <button className="btn btn-signal w-full" disabled={pending}>{pending ? "Đang kiểm tra token…" : `Nối ${picked.name}`}</button>
            <p className="hint text-center">Token được kiểm tra với {picked.name} trước khi lưu, rồi mã hoá AES-256.</p>
          </form>
          )}
        </div>
      )}
    </div>
  );
}
