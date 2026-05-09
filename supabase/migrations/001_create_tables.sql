-- NTU Water Risk Map | Initial schema
-- 在 Supabase SQL Editor 執行整份檔案即可。

-- 1. 啟用 pgcrypto 以使用 gen_random_uuid()
create extension if not exists "pgcrypto";

-- 2. reports 主表
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (
    category in ('flooding', 'standing_water', 'facility_leak', 'poor_drainage', 'other')
  ),
  severity text not null check (severity in ('low', 'medium', 'high')),
  location_name text,
  latitude double precision not null,
  longitude double precision not null,
  image_url text,
  reporter_name text,
  status text not null default 'active' check (
    status in ('active', 'reviewing', 'resolved', 'rejected')
  ),
  upvote_count integer not null default 0,
  resolved_count integer not null default 0,
  admin_note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_reports_created_at on public.reports (created_at desc);
create index if not exists idx_reports_status on public.reports (status);
create index if not exists idx_reports_severity on public.reports (severity);
create index if not exists idx_reports_category on public.reports (category);
create index if not exists idx_reports_location on public.reports (latitude, longitude);

-- 3. report_confirmations 表
create table if not exists public.report_confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  type text not null check (type in ('still_exists', 'resolved')),
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_report_confirmations_report_id
  on public.report_confirmations (report_id);
create index if not exists idx_report_confirmations_type
  on public.report_confirmations (type);

-- 4. updated_at 自動更新 trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_reports_set_updated_at on public.reports;
create trigger trg_reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

-- 5. 啟用 Row Level Security 並設定基本政策（依需求調整）
alter table public.reports enable row level security;
alter table public.report_confirmations enable row level security;

-- 任何人皆可讀取 reports / confirmations
drop policy if exists "Public read reports" on public.reports;
create policy "Public read reports"
  on public.reports for select
  using (true);

drop policy if exists "Public read confirmations" on public.report_confirmations;
create policy "Public read confirmations"
  on public.report_confirmations for select
  using (true);

-- 任何人（含匿名）可新增回報
drop policy if exists "Anyone can insert reports" on public.reports;
create policy "Anyone can insert reports"
  on public.reports for insert
  with check (true);

drop policy if exists "Anyone can insert confirmations" on public.report_confirmations;
create policy "Anyone can insert confirmations"
  on public.report_confirmations for insert
  with check (true);

-- 預設不開放公開更新或刪除；後續若有 service-role key 才能透過 admin API 操作。
-- 若想讓 anon 可以增加 upvote_count / resolved_count，可使用 SECURITY DEFINER 函式：
create or replace function public.add_report_confirmation(
  p_report_id uuid,
  p_type text
) returns public.reports
language plpgsql security definer
as $$
declare
  v_report public.reports;
begin
  if p_type not in ('still_exists', 'resolved') then
    raise exception 'invalid type';
  end if;

  insert into public.report_confirmations (report_id, type)
  values (p_report_id, p_type);

  if p_type = 'still_exists' then
    update public.reports
      set upvote_count = upvote_count + 1,
          updated_at = now()
      where id = p_report_id
      returning * into v_report;
  else
    update public.reports
      set resolved_count = resolved_count + 1,
          updated_at = now()
      where id = p_report_id
      returning * into v_report;
  end if;

  return v_report;
end;
$$;

grant execute on function public.add_report_confirmation(uuid, text) to anon, authenticated;

-- 6. Storage：請手動到 Supabase Studio 建立 bucket `report-images`，並設為 public read。
--    或使用以下 SQL（需 storage schema 權限）：
-- insert into storage.buckets (id, name, public) values ('report-images', 'report-images', true)
-- on conflict (id) do nothing;
