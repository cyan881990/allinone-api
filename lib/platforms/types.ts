export type MediaItem = { url: string; type: "image" | "video" };

/** Payload chuẩn hoá mà mọi API con nhận được */
export type PostInput = {
  text?: string;
  title?: string;
  link?: string;
  media: MediaItem[];
  /** Tuỳ chọn riêng theo nền tảng, vd { youtube: { privacy: "unlisted" } } */
  options: Record<string, Record<string, unknown>>;
};

export type Credentials = Record<string, any>;

export type PublishContext = {
  credentials: Credentials;
  /** Lấy access token (tự refresh với nền tảng OAuth) */
  accessToken: () => Promise<string>;
  options: Record<string, unknown>;
};

export type PublishResult = { id?: string; url?: string; raw?: unknown };

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "password" | "url";
  placeholder?: string;
  help?: string;
  optional?: boolean;
};

export type PlatformDef = {
  id: string;
  name: string;
  color: string;
  /** Mọi API con đều kết nối bằng key/token người dùng tự dán */
  auth: "token";
  fields?: FieldDef[];
  supports: { text: boolean; image: boolean; video: boolean; multiImage?: boolean };
  note?: string;
  /** Kiểm tra credentials khi thêm, trả về tên hiển thị */
  verify?: (creds: Credentials) => Promise<string | undefined>;
  publish: (input: PostInput, ctx: PublishContext) => Promise<PublishResult>;
};

export class PlatformError extends Error {
  constructor(message: string, public detail?: unknown) {
    super(message);
  }
}
