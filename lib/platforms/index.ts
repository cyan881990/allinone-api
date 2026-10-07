import { bluesky, mastodon } from "./fediverse";
import { discord, slack, telegram } from "./messaging";
import { facebook, instagram, threads } from "./meta";
import { linkedin, tiktok, x, youtube } from "./oauth-platforms";
import type { PlatformDef } from "./types";

export const PLATFORMS: PlatformDef[] = [
  tiktok, youtube, instagram, facebook, threads, x, linkedin,
  bluesky, mastodon, telegram, discord, slack,
];

export const PLATFORM_MAP: Record<string, PlatformDef> = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));

export const getPlatform = (id: string) => PLATFORM_MAP[id];

/** Thông tin an toàn để gửi xuống client (không có hàm) */
export function platformMeta(p: PlatformDef) {
  return { id: p.id, name: p.name, color: p.color, auth: p.auth, fields: p.fields || [], supports: p.supports, note: p.note };
}
export type PlatformMeta = ReturnType<typeof platformMeta>;
