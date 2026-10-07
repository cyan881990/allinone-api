"use client";

import { useActionState, useState } from "react";
import type { PlatformMeta } from "@/lib/platforms";
import { addTokenConnection, type ConnState } from "../actions";

type Meta = PlatformMeta & { oauthReady: boolean };

export function AddConnection({ remoteId, platforms }: { remoteId: string; platforms: Meta[] }) {
  const [picked, setPicked] = useState<Meta | null>(null);
  const [state, action, pending] = useActionState<ConnState, FormData>(addTokenConnection, {});

  return (
    <div className="panel h-fit p-5">
      <h2 className="font-bold">Nối API con</h2>
      {!picked ? (
        <>
          <p className="mt-1 text-sm text-muted">Chọn nền tảng cần nối.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {platforms.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPicked(p)}
                className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm font-medium hover:border-ink"
              >
                <span className="h-4 w-1.5 rounded-full" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
          {state.ok && <p className="mt-3 text-sm text-ok" role="status">{state.ok}</p>}
        </>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-4 w-1.5 rounded-full" style={{ background: picked.color }} />
              {picked.name}
            </span>
            <button type="button" className="text-sm text-muted underline" onClick={() => setPicked(null)}>Chọn nền tảng khác</button>
          </div>
          {picked.note && <p className="hint !mt-0">{picked.note}</p>}

          {picked.auth === "oauth" ? (
            <OAuthConnect remoteId={remoteId} p={picked} />
          ) : (
            <form action={action} className="space-y-3">
              <input type="hidden" name="remote_id" value={remoteId} />
              <input type="hidden" name="platform" value={picked.id} />
              {picked.fields.map((f) => (
                <div key={f.key}>
                  <label className="field-label" htmlFor={f.key}>{f.label}</label>
                  <input id={f.key} name={f.key} type={f.type === "password" ? "password" : "text"} placeholder={f.placeholder} required={!f.optional} className="input" autoComplete="off" />
                  {f.help && <p className="hint">{f.help}</p>}
                </div>
              ))}
              <LabelField />
              {state.error && <p className="text-sm text-err" role="alert">{state.error}</p>}
              {state.ok && <p className="text-sm text-ok" role="status">{state.ok}</p>}
              <button className="btn btn-signal w-full" disabled={pending}>{pending ? "Đang xác thực…" : `Nối ${picked.name}`}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function LabelField({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  return (
    <div>
      <label className="field-label" htmlFor="label">Label (tuỳ chọn)</label>
      <input id="label" name="label" className="input" placeholder="vd: tiktok-shop-a" value={value} onChange={onChange && ((e) => onChange(e.target.value))} />
      <p className="hint">Tên dùng trong trường platforms khi gọi API. Bỏ trống để tự đặt.</p>
    </div>
  );
}

function OAuthConnect({ remoteId, p }: { remoteId: string; p: Meta }) {
  const [label, setLabel] = useState("");
  if (!p.oauthReady) {
    return (
      <p className="rounded-md bg-paper p-3 text-sm">
        Nền tảng này cần app OAuth riêng. Điền client ID/secret của {p.name} vào biến môi trường rồi deploy lại (xem README).
      </p>
    );
  }
  const href = `/api/oauth/${p.id}/start?remote=${remoteId}${label ? `&label=${encodeURIComponent(label)}` : ""}`;
  return (
    <div className="space-y-3">
      <LabelField value={label} onChange={setLabel} />
      <a href={href} className="btn btn-signal w-full">Đăng nhập {p.name} để kết nối</a>
      <p className="hint">Bạn sẽ được chuyển sang trang của {p.name} để cấp quyền, rồi quay lại đây.</p>
    </div>
  );
}
