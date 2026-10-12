/**
 * Giới hạn đăng bài của từng nền tảng.
 *
 * Mọi con số ở đây lấy từ tài liệu chính thức (xem `docs` của từng mục), không phải phỏng đoán.
 * Nền tảng nào không công bố số cụ thể thì để kind = "unknown": vẫn đếm lượt dùng
 * nhưng không chặn, vì chặn theo số tự nghĩ ra còn hại hơn.
 */

export type LimitKind =
  /** Có mức trần công bố rõ ràng cho số bài đăng trong một cửa sổ thời gian. */
  | "hard"
  /** Giới hạn tần suất gọi API trong cửa sổ ngắn (giây/phút), không phải trần bài/ngày. */
  | "rate"
  /** Nền tảng không công bố con số cụ thể. */
  | "unknown";

export type LimitRule = {
  platform: string;
  kind: LimitKind;
  /** Số lượt tối đa trong cửa sổ. Bỏ trống khi kind = "unknown". */
  max?: number;
  /** Độ dài cửa sổ tính bằng phút. */
  windowMinutes?: number;
  /**
   * Cửa sổ dùng để hiển thị số lượt đã dùng khi nền tảng không công bố trần.
   * Mặc định bằng windowMinutes; nền tảng kind = "unknown" thì lấy 24 giờ.
   */
  countMinutes?: number;
  /** Mô tả ngắn hiển thị cho người dùng. */
  text: string;
  /** Có chặn trước khi gọi API thật khi đã chạm trần hay không. */
  enforce: boolean;
  /** Nền tảng có endpoint trả quota thật (đọc được số liệu từ chính họ). */
  remoteQuota?: boolean;
  docs: string;
};

const RULES: LimitRule[] = [
  {
    platform: "instagram",
    kind: "hard",
    max: 100,
    windowMinutes: 24 * 60,
    text: "100 bài qua API trong 24 giờ (carousel tính là 1 bài).",
    enforce: true,
    remoteQuota: true,
    docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
  },
  {
    platform: "threads",
    kind: "hard",
    max: 250,
    windowMinutes: 24 * 60,
    text: "250 bài qua API trong 24 giờ (carousel tính là 1 bài).",
    enforce: true,
    remoteQuota: true,
    docs: "https://developers.facebook.com/documentation/threads/overview",
  },
  {
    platform: "youtube",
    kind: "hard",
    max: 100,
    windowMinutes: 24 * 60,
    text: "100 lượt tải video lên mỗi ngày (hạn mức riêng của videos.insert, reset lúc nửa đêm giờ Thái Bình Dương).",
    enforce: true,
    docs: "https://developers.google.com/youtube/v3/docs/videos/insert",
  },
  {
    platform: "x",
    kind: "rate",
    max: 100,
    windowMinutes: 15,
    text: "100 lượt đăng mỗi 15 phút cho một tài khoản. Gói trả phí còn có trần theo tháng, xem trong Developer Console.",
    enforce: true,
    docs: "https://docs.x.com/x-api/fundamentals/rate-limits",
  },
  {
    platform: "bluesky",
    kind: "rate",
    max: 1666,
    windowMinutes: 60,
    text: "5.000 điểm/giờ và 35.000 điểm/ngày, mỗi bài tốn 3 điểm — tức khoảng 1.666 bài/giờ, 11.666 bài/ngày.",
    enforce: true,
    docs: "https://bsky.network/docs/rate-limits",
  },
  {
    platform: "mastodon",
    kind: "rate",
    max: 300,
    windowMinutes: 5,
    text: "300 lượt gọi mỗi 5 phút cho một tài khoản (mức mặc định, mỗi máy chủ có thể đặt khác).",
    enforce: true,
    docs: "https://docs.joinmastodon.org/api/rate-limits/",
  },
  {
    platform: "tiktok",
    kind: "rate",
    max: 6,
    windowMinutes: 1,
    text: "6 lượt gọi mỗi phút cho một tài khoản. TikTok còn có trần theo ngày nhưng không công bố con số.",
    enforce: true,
    docs: "https://developers.tiktok.com/doc/content-posting-api-reference-direct-post",
  },
  {
    platform: "telegram",
    kind: "rate",
    max: 20,
    windowMinutes: 1,
    text: "20 tin nhắn mỗi phút vào cùng một nhóm; khoảng 30 tin/giây tính trên toàn bộ bot.",
    enforce: true,
    docs: "https://core.telegram.org/bots/faq",
  },
  {
    platform: "slack",
    kind: "rate",
    max: 60,
    windowMinutes: 1,
    text: "Khoảng 1 tin nhắn mỗi giây vào một kênh; cả workspace là vài trăm tin mỗi phút.",
    enforce: true,
    docs: "https://docs.slack.dev/reference/methods/chat.postMessage",
  },
  {
    platform: "facebook",
    kind: "unknown",
    text: "Không có trần số bài/ngày. Giới hạn tính theo lượt gọi: 4.800 × số người tương tác với Trang trong 24 giờ.",
    enforce: false,
    docs: "https://developers.facebook.com/docs/graph-api/overview/rate-limiting",
  },
  {
    platform: "linkedin",
    kind: "unknown",
    text: "LinkedIn không công bố con số. Hạn mức theo ngày của ứng dụng xem ở tab Analytics trong Developer Portal.",
    enforce: false,
    docs: "https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits",
  },
  {
    platform: "discord",
    kind: "unknown",
    text: "Bot gọi tối đa 50 lượt mỗi giây toàn cục; webhook còn giới hạn riêng theo từng route, không công bố con số.",
    enforce: false,
    docs: "https://docs.discord.com/developers/topics/rate-limits",
  },
];

export const LIMIT_RULES: Record<string, LimitRule> = Object.fromEntries(RULES.map((r) => [r.platform, r]));

export const getLimitRule = (platform: string): LimitRule | undefined => LIMIT_RULES[platform];

/** Cửa sổ dùng để đếm. Nền tảng không công bố trần vẫn được đếm theo 24 giờ. */
export const countMinutesOf = (rule: LimitRule) => rule.countMinutes ?? rule.windowMinutes ?? 24 * 60;

/** Mốc bắt đầu cửa sổ đang xét, dạng ISO. */
export function windowStart(rule: LimitRule, now = Date.now()): string {
  return new Date(now - countMinutesOf(rule) * 60_000).toISOString();
}

export type LimitStatus = {
  platform: string;
  kind: LimitKind;
  /** Số lượt đã dùng trong cửa sổ (đếm từ dữ liệu của chính AllInOne API). */
  used: number;
  max: number | null;
  remaining: number | null;
  /** Phần trăm đã dùng, 0–100. Null khi không biết trần. */
  percent: number | null;
  windowMinutes: number | null;
  /** Cửa sổ thực tế dùng để đếm (nền tảng không công bố trần thì vẫn là 24 giờ). */
  countMinutes: number;
  /** Thời điểm có thêm chỗ trống: lúc lượt dùng cần thiết trong cửa sổ hết hạn. */
  resetsAt: string | null;
  text: string;
  docs: string;
  enforce: boolean;
  /** Số liệu quota lấy trực tiếp từ nền tảng, nếu đọc được. */
  reported?: { used: number; max: number; source: string };
};

export function buildStatus(
  rule: LimitRule,
  used: number,
  oldestInWindow: string | null,
  reported?: LimitStatus["reported"],
): LimitStatus {
  const max = rule.max ?? null;
  const remaining = max === null ? null : Math.max(0, max - used);
  return {
    platform: rule.platform,
    kind: rule.kind,
    used,
    max,
    remaining,
    percent: max === null ? null : Math.min(100, Math.round((used / max) * 100)),
    windowMinutes: rule.windowMinutes ?? null,
    countMinutes: countMinutesOf(rule),
    resetsAt: oldestInWindow ? new Date(Date.parse(oldestInWindow) + countMinutesOf(rule) * 60_000).toISOString() : null,
    text: rule.text,
    docs: rule.docs,
    enforce: rule.enforce,
    reported,
  };
}

/** Mô tả cửa sổ bằng tiếng Việt: "24 giờ", "15 phút". */
export function windowLabel(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)} ngày`;
  if (minutes % 60 === 0) return `${minutes / 60} giờ`;
  return `${minutes} phút`;
}
