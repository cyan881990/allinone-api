-- AllInOne API — thống kê & theo dõi giới hạn
-- usage_events: mỗi lần gọi tới 1 API con đẻ ra đúng 1 dòng.
-- Đây là nguồn đếm để so với giới hạn của từng nền tảng (vd Instagram 100 bài/24 giờ).
--
-- Dòng được tạo ở trạng thái 'pending' NGAY TRƯỚC khi gọi nền tảng rồi mới chuyển
-- thành 'ok'/'failed'. Nhờ vậy hai request chạy song song nhìn thấy nhau và không
-- cùng lúc lọt qua chỗ trống cuối cùng.

create table if not exists public.usage_events (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  remote_api_id  uuid not null references public.remote_apis(id) on delete cascade,
  connection_id  uuid references public.connections(id) on delete cascade,
  post_id        uuid references public.posts(id) on delete set null,
  platform       text not null,
  label          text,
  state          text not null default 'pending' check (state in ('pending', 'ok', 'failed')),
  error          text,
  ms             integer,
  created_at     timestamptz not null default now()
);

-- Đếm theo cửa sổ thời gian của 1 API con: truy vấn nóng nhất.
create index if not exists usage_events_conn_idx on public.usage_events(connection_id, created_at desc);
create index if not exists usage_events_remote_idx on public.usage_events(remote_api_id, created_at desc);
create index if not exists usage_events_owner_idx on public.usage_events(owner_id, created_at desc);

alter table public.usage_events enable row level security;
-- create policy không có IF NOT EXISTS, nên phải drop trước để file chạy lại được.
drop policy if exists "own usage_events" on public.usage_events;
create policy "own usage_events" on public.usage_events
  for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- Client chỉ được đọc; ghi do server (service role) làm.
revoke insert, update, delete on public.usage_events from anon, authenticated;

-- ---------- Backfill: dựng lại lịch sử từ posts.results đã có ----------
-- Chạy lại nhiều lần không nhân đôi dữ liệu: post nào đã có dòng thì bỏ qua cả post.
insert into public.usage_events (owner_id, remote_api_id, connection_id, post_id, platform, label, state, error, ms, created_at)
select
  p.owner_id,
  p.remote_api_id,
  c.id,
  p.id,
  coalesce(r->>'platform', 'unknown'),
  r->>'label',
  case when coalesce((r->>'ok')::boolean, false) then 'ok' else 'failed' end,
  left(r->>'error', 1000),
  nullif(r->>'ms', '')::integer,
  coalesce(p.completed_at, p.created_at)
from public.posts p
cross join lateral jsonb_array_elements(coalesce(p.results->'results', '[]'::jsonb)) as r
left join public.connections c on c.id::text = (r->>'connection_id')
where not exists (select 1 from public.usage_events u where u.post_id = p.id);
