"use client";

import { useActionState, useState } from "react";
import { authAction, type AuthState } from "./actions";

export function AuthForm({ initialMode }: { initialMode: "signin" | "signup" }) {
  const [mode, setMode] = useState(initialMode);
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, {});

  return (
    <form action={action} className="space-y-4">
      <h1 className="text-xl font-bold">{mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}</h1>
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="field-label" htmlFor="password">Mật khẩu</label>
        <input id="password" name="password" type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="input" />
      </div>
      {state.error && <p className="text-sm text-err" role="alert">{state.error}</p>}
      {state.message && <p className="text-sm text-ok" role="status">{state.message}</p>}
      <button className="btn btn-signal w-full" disabled={pending}>
        {pending ? "Đang xử lý…" : mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "signup" ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <button type="button" className="font-semibold text-ink underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </p>
    </form>
  );
}
