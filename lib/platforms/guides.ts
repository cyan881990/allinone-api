/**
 * Hướng dẫn lấy key/token cho từng API con.
 * Dữ liệu thuần (không import code server) để dùng được cả ở client và trang tài liệu.
 * {APP_URL} được thay bằng URL của web app khi hiển thị.
 */
export type GuideLink = { label: string; url: string };
/** Một bước: chuỗi, hoặc chuỗi kèm đoạn code/link mẫu hiển thị riêng để copy */
export type GuideStep = string | { text: string; code: string };
export type PlatformGuide = {
  /** Mất bao lâu, cần gì — một câu */
  summary: string;
  steps: GuideStep[];
  links: GuideLink[];
  /** Lưu ý về hết hạn / giới hạn */
  caveats?: string[];
};

export const GUIDES: Record<string, PlatformGuide> = {
  telegram: {
    summary: "Khoảng 2 phút. Cần tài khoản Telegram và quyền admin của kênh hoặc nhóm.",
    steps: [
      "Trong Telegram, mở chat với @BotFather, gửi lệnh /newbot, đặt tên và username (phải kết thúc bằng \"bot\"). BotFather trả về Bot token dạng 123456789:ABC…",
      "Thêm bot vào kênh/nhóm muốn đăng, cấp quyền admin có quyền đăng tin.",
      {
        text: "Chat ID: kênh công khai dùng luôn @tenkenh. Kênh/nhóm riêng tư: gửi một tin bất kỳ vào đó, thay BOT_TOKEN rồi mở link sau, lấy giá trị chat.id (dạng -100…).",
        code: "https://api.telegram.org/botBOT_TOKEN/getUpdates",
      },
    ],
    links: [
      { label: "Tạo bot với BotFather", url: "https://core.telegram.org/bots/tutorial#obtain-your-bot-token" },
      { label: "Telegram Bot API", url: "https://core.telegram.org/bots/api" },
    ],
  },
  discord: {
    summary: "Khoảng 1 phút. Cần quyền Manage Webhooks trong server.",
    steps: [
      "Mở Server Settings → Integrations → Webhooks → New Webhook.",
      "Đặt tên, chọn kênh sẽ nhận bài, bấm Copy Webhook URL.",
      "Dán URL vào ô Webhook URL.",
    ],
    links: [{ label: "Discord: Intro to Webhooks", url: "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" }],
  },
  slack: {
    summary: "Khoảng 3 phút. Cần quyền cài app vào workspace.",
    steps: [
      "Vào api.slack.com/apps → Create New App → From scratch, chọn workspace.",
      "Trong app, mở Incoming Webhooks → bật Activate Incoming Webhooks.",
      "Bấm Add New Webhook to Workspace, chọn kênh, Allow → copy Webhook URL (https://hooks.slack.com/services/…).",
    ],
    links: [
      { label: "Slack: Sending messages using incoming webhooks", url: "https://api.slack.com/messaging/webhooks" },
      { label: "Danh sách app Slack của bạn", url: "https://api.slack.com/apps" },
    ],
  },
  bluesky: {
    summary: "Khoảng 1 phút. Dùng App password, không dùng mật khẩu chính.",
    steps: [
      "Trên bsky.app, mở Settings → Privacy and security → App passwords → Add App Password.",
      "Đặt tên (vd \"AllInOne\"), bấm Create → copy mật khẩu dạng xxxx-xxxx-xxxx-xxxx (chỉ hiện một lần).",
      "Handle là tên tài khoản của bạn, vd ten.bsky.social. Ô PDS để trống nếu bạn dùng bsky.social.",
    ],
    links: [{ label: "Trang App passwords", url: "https://bsky.app/settings/app-passwords" }],
    caveats: ["Bluesky giới hạn mỗi ảnh tối đa 1MB, tối đa 4 ảnh, chưa hỗ trợ video trong bản này."],
  },
  mastodon: {
    summary: "Khoảng 2 phút trên chính instance Mastodon của bạn.",
    steps: [
      "Đăng nhập instance (vd mastodon.social) → Preferences → Development → New application.",
      "Đặt tên app; ở Scopes chỉ tick write:statuses và write:media (bỏ các scope khác) → Submit.",
      "Mở app vừa tạo, copy dòng \"Your access token\". Instance là URL gốc, vd https://mastodon.social.",
    ],
    links: [{ label: "Mastodon: Obtaining client app access", url: "https://docs.joinmastodon.org/client/token/" }],
  },
  facebook: {
    summary: "Khoảng 10 phút. Cần là admin của Fanpage và có tài khoản Meta for Developers.",
    steps: [
      "Vào developers.facebook.com → My Apps → Create App, chọn loại Business (hoặc use case quản lý Page). App ở chế độ Development là đủ để đăng lên Page của chính bạn.",
      "Mở Graph API Explorer, chọn app vừa tạo, User Token, thêm quyền pages_show_list, pages_read_engagement, pages_manage_posts → Generate Access Token và đồng ý.",
      "Mở Access Token Debugger, dán token vừa tạo → bấm Extend Access Token để có user token dài hạn (60 ngày).",
      "Quay lại Graph API Explorer, dán token dài hạn, gọi GET me/accounts. Lấy id (Page ID) và access_token của đúng Page. Page token lấy từ user token dài hạn sẽ không hết hạn.",
    ],
    links: [
      { label: "Graph API Explorer", url: "https://developers.facebook.com/tools/explorer/" },
      { label: "Access Token Debugger", url: "https://developers.facebook.com/tools/debug/accesstoken/" },
      { label: "Meta: Long-lived access tokens", url: "https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived" },
      { label: "Meta Pages API: Getting started", url: "https://developers.facebook.com/docs/pages-api/getting-started" },
    ],
    caveats: ["Đổi mật khẩu Facebook hoặc gỡ quyền app sẽ làm token mất hiệu lực, khi đó cần lấy lại."],
  },
  instagram: {
    summary: "Khoảng 10 phút. Tài khoản Instagram phải là Business/Creator và được liên kết với một Fanpage.",
    steps: [
      "Chuyển Instagram sang tài khoản chuyên nghiệp (Business hoặc Creator) và liên kết với Fanpage trong Meta Business Suite.",
      "Dùng cùng app Meta như phần Facebook. Trong Graph API Explorer thêm các quyền instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement → Generate Access Token, rồi Extend sang token dài hạn trong Access Token Debugger.",
      "Gọi GET me/accounts?fields=name,instagram_business_account → giá trị instagram_business_account.id chính là Instagram User ID.",
      "Dán Instagram User ID và token dài hạn. Ô API host để trống (graph.facebook.com). Nếu bạn dùng \"Instagram API with Instagram Login\" thì điền graph.instagram.com.",
    ],
    links: [
      { label: "Meta: Instagram content publishing", url: "https://developers.facebook.com/docs/instagram-platform/content-publishing/" },
      { label: "Graph API Explorer", url: "https://developers.facebook.com/tools/explorer/" },
      { label: "Access Token Debugger", url: "https://developers.facebook.com/tools/debug/accesstoken/" },
    ],
    caveats: [
      "Ảnh/video phải là URL công khai; Instagram tự tải về từ URL đó.",
      "User token dài hạn hết hạn sau 60 ngày; tạo lại và cập nhật API con trước khi hết hạn.",
    ],
  },
  threads: {
    summary: "Khoảng 10 phút. Cần app Meta có use case Threads API.",
    steps: [
      "Tại developers.facebook.com tạo app với use case \"Access the Threads API\", bật quyền threads_basic và threads_content_publish.",
      "App roles → Roles → thêm tài khoản Threads của bạn làm Threads Tester. Trong app Threads: Settings → Account → Website permissions → Invites → chấp nhận lời mời.",
      "Trong phần cài đặt Threads API của app, dùng User Token Generator để tạo token cho tài khoản tester.",
      {
        text: "Đổi sang token dài hạn (60 ngày): thay APP_SECRET và TOKEN_NGAN_HAN rồi mở link sau trên trình duyệt, copy access_token trả về.",
        code: "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=APP_SECRET&access_token=TOKEN_NGAN_HAN",
      },
      "Ô Threads User ID có thể để \"me\".",
    ],
    links: [
      { label: "Threads API: Get started", url: "https://developers.facebook.com/docs/threads/get-started" },
      { label: "Threads API: Long-lived tokens", url: "https://developers.facebook.com/docs/threads/get-started/long-lived-tokens" },
    ],
    caveats: ["Token dài hạn hết hạn sau 60 ngày nếu không làm mới."],
  },
  youtube: {
    summary: "Khoảng 15 phút. Tạo OAuth client trên Google Cloud rồi lấy refresh token bằng OAuth Playground.",
    steps: [
      "Vào Google Cloud Console → tạo project → APIs & Services → Library → bật YouTube Data API v3.",
      "OAuth consent screen: chọn External, điền tên app và email. Thêm email Google sở hữu kênh vào Test users.",
      "Credentials → Create credentials → OAuth client ID → loại Web application. Ở Authorized redirect URIs thêm https://developers.google.com/oauthplayground → Create, copy Client ID và Client secret.",
      "Mở OAuth Playground → bánh răng góc phải → tick \"Use your own OAuth credentials\" → dán Client ID/Secret.",
      "Ô bên trái nhập 2 scope: https://www.googleapis.com/auth/youtube.upload và https://www.googleapis.com/auth/youtube.readonly → Authorize APIs → đăng nhập đúng tài khoản có kênh → Allow.",
      "Bấm Exchange authorization code for tokens → copy Refresh token. Dán Client ID, Client secret và Refresh token vào đây; app tự đổi access token mỗi lần đăng.",
    ],
    links: [
      { label: "Bật YouTube Data API v3", url: "https://console.cloud.google.com/apis/library/youtube.googleapis.com" },
      { label: "Google OAuth 2.0 Playground", url: "https://developers.google.com/oauthplayground" },
      { label: "YouTube: Upload a video", url: "https://developers.google.com/youtube/v3/guides/uploading_a_video" },
    ],
    caveats: [
      "Khi OAuth consent screen ở trạng thái Testing, refresh token hết hạn sau 7 ngày. Bấm Publish app (chuyển sang In production) để token không tự hết hạn.",
      "Dự án API chưa qua kiểm duyệt của Google có thể bị khoá video ở chế độ riêng tư cho đến khi được duyệt.",
    ],
  },
  tiktok: {
    summary: "Khoảng 20 phút. Tạo app trên TikTok for Developers, lấy authorization code rồi đổi lấy refresh token bằng một lệnh curl.",
    steps: [
      "Vào developers.tiktok.com → Manage apps → Connect an app. Thêm product Login Kit và Content Posting API (bật Direct Post). Bật scope user.info.basic, video.publish, video.upload.",
      "Trong Login Kit → Redirect URI (Web) thêm: {APP_URL}/tools/oauth-code — trang này của web app sẽ hiện mã code cho bạn copy.",
      "Copy Client key và Client secret của app.",
      {
        text: "Thay CLIENT_KEY rồi mở link sau trên trình duyệt → đăng nhập TikTok → Authorize → trang đích sẽ hiện code, bấm Sao chép mã.",
        code: "https://www.tiktok.com/v2/auth/authorize/?client_key=CLIENT_KEY&scope=user.info.basic,video.publish,video.upload&response_type=code&redirect_uri={APP_URL}/tools/oauth-code&state=aio",
      },
      {
        text: "Thay CLIENT_KEY, CLIENT_SECRET, CODE rồi chạy lệnh sau trong Terminal (macOS/Linux) hoặc Git Bash (Windows) → copy giá trị refresh_token trong kết quả.",
        code: 'curl -X POST https://open.tiktokapis.com/v2/oauth/token/ \\\n  -H "Content-Type: application/x-www-form-urlencoded" \\\n  -d "client_key=CLIENT_KEY" \\\n  -d "client_secret=CLIENT_SECRET" \\\n  --data-urlencode "code=CODE" \\\n  -d "grant_type=authorization_code" \\\n  --data-urlencode "redirect_uri={APP_URL}/tools/oauth-code"',
      },
      "Dán Client key, Client secret và Refresh token vào đây.",
    ],
    links: [
      { label: "TikTok: Content Posting API — Get started", url: "https://developers.tiktok.com/doc/content-posting-api-get-started" },
      { label: "TikTok: Manage user access tokens", url: "https://developers.tiktok.com/doc/oauth-user-access-token-management" },
      { label: "TikTok for Developers — Manage apps", url: "https://developers.tiktok.com/apps" },
    ],
    caveats: [
      "Code chỉ dùng được một lần và hết hạn sau vài phút — đổi ngay sau khi lấy.",
      "App chưa qua audit của TikTok chỉ đăng được ở chế độ riêng tư (SELF_ONLY); nếu app ở Sandbox, thêm tài khoản của bạn vào Target users.",
      "Refresh token hiệu lực 365 ngày.",
    ],
  },
  linkedin: {
    summary: "Khoảng 10 phút. Dùng công cụ OAuth Token Generator có sẵn của LinkedIn.",
    steps: [
      "Vào linkedin.com/developers → Create app (cần liên kết với một LinkedIn Page; có thể tạo Page mới nếu chưa có).",
      "Tab Products → Request access cho \"Share on LinkedIn\" và \"Sign In with LinkedIn using OpenID Connect\" (thường được cấp ngay).",
      "Mở OAuth Token Generator Tool → chọn app → tick scope openid, profile, w_member_social → Request access token → đăng nhập → copy Access token.",
    ],
    links: [
      { label: "LinkedIn OAuth Token Generator", url: "https://www.linkedin.com/developers/tools/oauth/token-generator" },
      { label: "LinkedIn Developer apps", url: "https://www.linkedin.com/developers/apps" },
      { label: "LinkedIn: Share on LinkedIn", url: "https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin" },
    ],
    caveats: ["Token hết hạn sau 60 ngày; khi đó tạo token mới, gỡ API con cũ và nối lại."],
  },
  x: {
    summary: "Khoảng 10 phút. Dùng 4 key OAuth 1.0a — không hết hạn.",
    steps: [
      "Vào Developer Portal của X, tạo Project và App (gói Free đủ để đăng bài với hạn mức thấp).",
      "Trong App → Settings → User authentication settings → Set up: App permissions chọn \"Read and write\", Type of App chọn Web App, điền Callback URL và Website URL bất kỳ của bạn → Save.",
      "Tab Keys and tokens: ở API Key and Secret bấm Regenerate → copy API Key và API Key Secret.",
      "Ở Access Token and Secret bấm Generate → copy Access Token và Access Token Secret. Kiểm tra dòng ghi chú phải là \"Read and Write\"; nếu là \"Read Only\" hãy Regenerate sau khi đã đổi quyền ở bước 2.",
    ],
    links: [
      { label: "X Developer Portal", url: "https://developer.x.com/en/portal/dashboard" },
      { label: "X: API key and secret (OAuth 1.0a)", url: "https://docs.x.com/resources/fundamentals/authentication/oauth-1-0a/api-key-and-secret" },
    ],
    caveats: ["Số bài đăng mỗi tháng phụ thuộc gói X API của bạn."],
  },
};

export const fillAppUrl = (s: string, appUrl: string) => s.replaceAll("{APP_URL}", appUrl || "https://your-app.vercel.app");
