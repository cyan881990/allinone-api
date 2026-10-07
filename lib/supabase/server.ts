import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth-config";

/** Supabase client gắn với phiên đăng nhập (cookie) — chỉ dùng cho xác thực người dùng. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* gọi từ Server Component: bỏ qua, proxy sẽ làm mới cookie */
          }
        },
      },
    },
  );
}

export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // Chế độ một người dùng: phiên của bất kỳ tài khoản nào khác đều bị bỏ qua
  return data.user && isAdminEmail(data.user.email) ? data.user : null;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
