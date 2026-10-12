"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { CopyButton } from "@/components/copy";
import { createInstagramAuthUrl, getOAuthStatus, type IgAuthState, type OAuthStatus } from "../actions";

export type IgOAuthConfig = { redirectUri: string; envReady: boolean };

const WARN = {
  app: "Instagram không nhận App ID này — URL sẽ báo \"Invalid platform app\". Hãy dùng Instagram app ID (xem mục bên dưới).",
  secret: "App Secret không khớp với App ID — đăng nhập được nhưng bước lấy token sẽ lỗi. Kiểm tra lại Instagram app secret.",
  redirect: "Redirect URI chưa được khai báo trong app Meta — Instagram sẽ từ chối. Dán Redirect URI ở trên vào Business login settings.",
} as const;

/** Các lỗi thường gặp khi mở URL xác thực Instagram */
function Troubleshoot({ open = false }: { open?: boolean }) {
  const rows: [string, React.ReactNode][] = [
    [
      "Invalid platform app",
      <>
        App ID sai loại. Trong app Meta mở <b>Instagram → API setup with Instagram login</b>, dùng <b>Instagram app ID</b> và <b>Instagram app secret</b> ở đầu trang —
        không dùng App ID/App Secret ở Settings → Basic. Nếu không thấy trang này, app chưa có use case Instagram API with Instagram login.
      </>,
    ],
    ["Invalid redirect_uri", <>Chưa thêm Redirect URI (ô phía trên) vào Business login settings → OAuth redirect URIs, hoặc dán sai một ký tự.</>],
    ["Insufficient developer role", <>App đang ở Development: thêm tài khoản làm Instagram Tester trong App roles và chấp nhận lời mời tại instagram.com/accounts/manage_access.</>],
    ["Error validating client secret", <>App Secret sai — dùng Instagram app secret, không phải App Secret của Facebook.</>],
  ];
  return (
    <details open={open || undefined} className="rounded-md border border-line px-3 py-2 text-[13px] [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer select-none font-semibold">Instagram báo lỗi?</summary>
      <dl className="mt-2 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-[12px] font-medium">{k}</dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

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
          <>
            <p className="rounded-md border border-[#efc2c2] bg-[#fdf1f1] px-3 py-2 text-sm text-err" role="alert">
              {status?.status === "expired" ? "URL đã hết hạn. Hãy tạo URL mới." : status?.error}
            </p>
            <Troubleshoot open />
          </>
        ) : (
          <>
            {active.warning && (
              <div className="rounded-md border border-[#efc2c2] bg-[#fdf1f1] px-3 py-2 text-sm" role="alert">
                <p className="font-semibold text-err">{WARN[active.warning.problem]}</p>
                {active.warning.message && <p className="mt-1 text-[12.5px] text-muted">Instagram trả về: {active.warning.message}</p>}
              </div>
            )}
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
            <Troubleshoot />
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
