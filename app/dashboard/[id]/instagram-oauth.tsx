"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { CopyButton } from "@/components/copy";
import { createInstagramAuthUrl, getOAuthStatus, type IgAuthState, type OAuthStatus } from "../actions";

export type IgOAuthConfig = { redirectUri: string; envReady: boolean };

/** Tạo URL xác thực Instagram, mở/gửi URL, rồi tự theo dõi đến khi API con được tạo */
export function InstagramOAuth({ remoteId, config }: { remoteId: string; config: IgOAuthConfig }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<IgAuthState, FormData>(createInstagramAuthUrl, {});
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const active = state.state && state.state !== dismissed ? state : null;

  useEffect(() => {
    if (!active?.state) return;
    setStatus({ status: "pending" });
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const s = await getOAuthStatus(active.state!);
      if (stop) return;
      setStatus(s);
      if (s.status === "done") router.refresh();
      if (s.status === "pending" || s.status === "processing") setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [active?.state, router]);

  const reset = () => {
    setDismissed(state.state || null);
    setStatus(null);
  };

  if (active?.url) {
    const done = status?.status === "done";
    const failed = status?.status === "error" || status?.status === "expired";
    return (
      <div className="space-y-3">
        {done ? (
          <div className="rounded-md border border-[#b9e2d1] bg-[#effaf5] px-3 py-3 text-sm" role="status">
            <p className="font-semibold text-ok">Đã kết nối {status.account}</p>
            <p className="mt-0.5 text-muted">
              Label: <code className="inline">{status.label}</code>
            </p>
          </div>
        ) : failed ? (
          <p className="rounded-md border border-[#efc2c2] bg-[#fdf1f1] px-3 py-2 text-sm text-err" role="alert">
            {status?.status === "expired" ? "URL đã hết hạn. Hãy tạo URL mới." : status?.error}
          </p>
        ) : (
          <>
            <p className="text-sm">
              Mở URL dưới đây, đăng nhập Instagram và bấm <b>Cho phép</b>. Có thể gửi URL cho chủ tài khoản để họ tự cấp quyền.
            </p>
            <pre className="code !mt-0 whitespace-pre-wrap break-all !px-3 !py-2.5 !text-[12px]">{active.url}</pre>
            <div className="flex gap-2">
              <a href={active.url} target="_blank" rel="noreferrer" className="btn btn-signal flex-1">
                Mở trang đăng nhập Instagram
              </a>
              <CopyButton text={active.url} label="Sao chép URL" />
            </div>
            <p className="flex items-center gap-2 text-[13px] text-muted" role="status" aria-live="polite">
              <span className="lamp lamp-off animate-pulse" />
              {status?.status === "processing" ? "Đang lấy token…" : "Đang chờ cấp quyền…"} URL dùng một lần, hết hạn lúc{" "}
              {new Date(active.expiresAt!).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.
            </p>
          </>
        )}
        <button type="button" className="btn btn-ghost w-full" onClick={reset}>
          {done ? "Kết nối thêm tài khoản khác" : "Tạo URL mới"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="remote_id" value={remoteId} />
      <div>
        <p className="field-label">Redirect URI cần khai báo trong app Meta</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md bg-paper px-2.5 py-1.5 font-mono text-[12px]">{config.redirectUri}</code>
          <CopyButton text={config.redirectUri} className="btn btn-ghost !px-2.5 !py-1 text-[13px]" label="Sao chép" />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="ig_app_id">
          Instagram App ID{config.envReady && <span className="font-normal text-muted"> (tuỳ chọn)</span>}
        </label>
        <input id="ig_app_id" name="app_id" inputMode="numeric" className="input" placeholder="vd: 1234567890123456" required={!config.envReady} autoComplete="off" />
      </div>
      <div>
        <label className="field-label" htmlFor="ig_app_secret">
          Instagram App Secret{config.envReady && <span className="font-normal text-muted"> (tuỳ chọn)</span>}
        </label>
        <input id="ig_app_secret" name="app_secret" type="password" className="input" required={!config.envReady} autoComplete="off" />
        {config.envReady && <p className="hint">Bỏ trống để dùng app Instagram đã cấu hình sẵn trên server.</p>}
      </div>
      <div>
        <label className="field-label" htmlFor="ig_label">
          Label <span className="font-normal text-muted">(tuỳ chọn)</span>
        </label>
        <input id="ig_label" name="label" className="input" placeholder="vd: instagram-shop-a" />
        <p className="hint">Bỏ trống để đặt theo username Instagram.</p>
      </div>
      {state.error && (
        <p className="text-sm text-err" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-signal w-full" disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo URL xác thực"}
      </button>
    </form>
  );
}
