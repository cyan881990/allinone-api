"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

export async function authAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const mode = form.get("mode") === "signup" ? "signup" : "signin";
  if (!email || password.length < 6) return { error: "Nhập email và mật khẩu tối thiểu 6 ký tự." };

  const supabase = await createClient();
  if (mode === "signup") {
    const origin = process.env.APP_URL || (await headers()).get("origin") || "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return { error: error.message };
    if (!data.session) return { message: "Đã gửi email xác nhận. Mở link trong email để kích hoạt tài khoản." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message === "Invalid login credentials" ? "Sai email hoặc mật khẩu." : error.message };
  }
  redirect("/dashboard");
}
