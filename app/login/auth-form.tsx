"use client";

import { useActionState } from "react";
import { authAction, type AuthState } from "./actions";

export function AuthForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, {});

  return (
    <form action={action} className="space-y-4">
      <h1 className="text-xl font-bold">Đăng nhập</h1>
      <div>
        <label className="field-label" htmlFor="username">Tên đăng nhập</label>
        <input id="username" name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} className="input" />
      </div>
      <div>
        <label className="field-label" htmlFor="password">Mật khẩu</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {state.error && <p className="text-sm text-err" role="alert">{state.error}</p>}
      <button className="btn btn-signal w-full" disabled={pending}>{pending ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
  );
}
