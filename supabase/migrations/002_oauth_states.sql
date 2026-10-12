-- Phiên xác thực OAuth (vd "Đăng nhập Instagram").
-- Mỗi URL xác thực có một state ngẫu nhiên; chỉ dùng được một lần và hết hạn sau 30 phút.
-- Nhờ lưu ở DB (không phải cookie), URL có thể mở trên thiết bị khác hoặc gửi cho chủ tài khoản.

create table if not exists public.oauth_states (
  id             text primary key,                 -- state
  owner_id       uuid not null references auth.users(id) on delete cascade,
  remote_api_id  uuid not null references public.remote_apis(id) on delete cascade,
  platform       text not null,
  payload        text not null,                    -- JSON đã mã hoá: app_id, app_secret, label
  status         text not null default 'pending',  -- pending | processing | done | error
  result         jsonb,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null
);
create index if not exists oauth_states_owner_idx on public.oauth_states(owner_id);
create index if not exists oauth_states_remote_idx on public.oauth_states(remote_api_id);

-- Chỉ server (service role) truy cập
alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from anon, authenticated;
