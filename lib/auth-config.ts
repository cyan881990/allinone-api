/** Chế độ một người dùng: chỉ tài khoản admin được dùng web app. */
const DOMAIN = "allinone.local";

export const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
export const ADMIN_EMAIL = `${ADMIN_USERNAME}@${DOMAIN}`;

/** "admin" → "admin@allinone.local"; nếu nhập email đầy đủ thì giữ nguyên */
export function usernameToEmail(u: string) {
  const v = u.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${DOMAIN}`;
}

export const isAdminEmail = (email?: string | null) => (email || "").toLowerCase() === ADMIN_EMAIL;
