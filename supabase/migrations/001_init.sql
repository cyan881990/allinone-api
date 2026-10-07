-- AllInOne API — schema
-- remote_apis : mỗi "API remote" = 1 endpoint có API key riêng
-- connections : các "API con" (tài khoản mạng xã hội) thuộc 1 API remote
-- posts       : lịch sử / hàng đợi mỗi lần gọi API

create extension if not exists pgcrypto;

create table if not exists public.remote_apis (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  key_prefix    text not null,
  key_hash      text not null unique,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists remote_apis_owner_idx on public.remote_apis(owner_id);

create table if not exists public.connections (
  id             uuid primary key default gen_random_uuid(),
  remote_api_id  uuid not null references public.remote_apis(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  platform       text not null,
  label          text not null,          -- tên ngắn duy nhất trong 1 API remote, dùng khi gọi API
  display_name   text,
  credentials    text not null,          -- JSON đã mã hoá AES-256-GCM
  enabled        boolean not null default true,
  status         text not null default 'ok',   -- ok | error
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (remote_api_id, label)
);
create index if not exists connections_remote_idx on public.connections(remote_api_id);

create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  remote_api_id  uuid not null references public.remote_apis(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  payload        jsonb not null,
  targets        text[] not null default '{}',
  status         text not null default 'processing', -- scheduled | processing | success | partial | failed | cancelled
  scheduled_at   timestamptz,
  results        jsonb not null default '[]'::jsonb,
  source         text not null default 'api',         -- api | dashboard
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index if not exists posts_remote_idx on public.posts(remote_api_id, created_at desc);
create index if not exists posts_scheduled_idx on public.posts(scheduled_at) where status = 'scheduled';

-- ---------- RLS: mỗi user chỉ thấy dữ liệu của mình ----------
alter table public.remote_apis enable row level security;
alter table public.connections enable row level security;
alter table public.posts       enable row level security;

create policy "own remote_apis" on public.remote_apis
  for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own connections" on public.connections
  for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own posts" on public.posts
  for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- Cột credentials không bao giờ được đọc/ghi bằng key phía client (chỉ service role)
revoke all on public.connections from anon, authenticated;
grant select (id, remote_api_id, owner_id, platform, label, display_name, enabled, status, last_error, created_at, updated_at)
  on public.connections to authenticated;
grant update (display_name, enabled) on public.connections to authenticated;
grant delete on public.connections to authenticated;
-- Thêm API con chỉ đi qua server (service role) vì cần mã hoá credentials.

-- Không cho client tự ghi key_hash
revoke insert, update on public.remote_apis from anon, authenticated;
grant update (name, description, active) on public.remote_apis to authenticated;

-- ---------- Storage: file upload qua multipart được lưu tại bucket công khai "media" ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
