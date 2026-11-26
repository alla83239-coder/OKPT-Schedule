-- Shared multi-user scheduling model for OKPT.
-- Run once in Supabase SQL Editor. The app uses Supabase Auth + RLS.
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  app_role text not null default 'viewer' check (app_role in ('admin','scheduler','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns text language sql stable security definer
set search_path = public
as $$
  select app_role from public.user_profiles
  where user_id = auth.uid() and is_active = true
$$;

create or replace function public.can_edit_schedule()
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin','scheduler'), false)
$$;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.student_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  department_id uuid references public.departments(id),
  specialty text,
  course_no smallint check (course_no between 1 and 6),
  subgroup_count smallint not null default 1 check (subgroup_count between 1 and 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  department_id uuid references public.departments(id),
  employment_type text not null default 'full_time' check (employment_type in ('full_time','part_time','external')),
  weekly_load_limit numeric(6,2),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.disciplines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  discipline_type text,
  created_at timestamptz not null default now()
);
create table if not exists public.teacher_qualifications (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  discipline_id uuid not null references public.disciplines(id) on delete cascade,
  primary key (teacher_id, discipline_id)
);
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  building text,
  capacity integer check (capacity is null or capacity > 0),
  room_type text,
  equipment text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.time_slots (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 6),
  monday_variant text not null default 'all' check (monday_variant in ('all','first_third','second_fourth')),
  lesson_no smallint not null,
  starts_at time not null,
  ends_at time not null,
  slot_label text,
  check (ends_at > starts_at),
  unique (weekday,monday_variant,lesson_no)
);

-- Repeating weekly pattern. Each row is one lesson occurrence in the base timetable.
create table if not exists public.base_schedule (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.student_groups(id),
  subgroup_code text not null default 'all',
  weekday smallint not null check (weekday between 1 and 6),
  monday_variant text not null default 'all' check (monday_variant in ('all','first_third','second_fourth')),
  lesson_no smallint not null,
  discipline_id uuid not null references public.disciplines(id),
  teacher_id uuid not null references public.teachers(id),
  room_id uuid references public.rooms(id),
  valid_from date,
  valid_to date,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Date-specific exceptions. A changed lesson points to its base row; an added lesson has no base row.
create table if not exists public.weekly_changes (
  id uuid primary key default gen_random_uuid(),
  lesson_date date not null,
  base_schedule_id uuid references public.base_schedule(id) on delete set null,
  change_type text not null check (change_type in ('cancel','move','replace_teacher','replace_room','modify','extra')),
  group_id uuid not null references public.student_groups(id),
  subgroup_code text not null default 'all',
  discipline_id uuid not null references public.disciplines(id),
  teacher_id uuid references public.teachers(id),
  room_id uuid references public.rooms(id),
  time_slot_id uuid references public.time_slots(id),
  reason text,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create table if not exists public.schedule_audit (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_base_schedule_group on public.base_schedule(group_id,weekday,lesson_no) where is_active;
create index if not exists idx_base_schedule_teacher on public.base_schedule(teacher_id,weekday,lesson_no) where is_active;
create index if not exists idx_weekly_changes_date on public.weekly_changes(lesson_date,status);
create index if not exists idx_weekly_changes_group on public.weekly_changes(group_id,lesson_date);

-- Every exposed table is protected. Signed-in users may read; scheduler/admin may edit.
do $$
declare t text;
begin
  foreach t in array array['user_profiles','departments','student_groups','teachers','disciplines','teacher_qualifications','rooms','time_slots','base_schedule','weekly_changes','schedule_audit']
  loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

drop policy if exists "profiles read self or admin" on public.user_profiles;
create policy "profiles read self or admin" on public.user_profiles for select to authenticated
using (user_id = auth.uid() or public.is_app_admin());
drop policy if exists "admins manage profiles" on public.user_profiles;
create policy "admins manage profiles" on public.user_profiles for all to authenticated
using (public.is_app_admin()) with check (public.is_app_admin());

do $$
declare t text;
begin
  foreach t in array array['departments','student_groups','teachers','disciplines','teacher_qualifications','rooms','time_slots','base_schedule','weekly_changes']
  loop
    execute format('drop policy if exists "authenticated read %1$s" on public.%1$I',t);
    execute format('create policy "authenticated read %1$s" on public.%1$I for select to authenticated using (true)',t);
    execute format('drop policy if exists "staff write %1$s" on public.%1$I',t);
    execute format('create policy "staff write %1$s" on public.%1$I for all to authenticated using (public.can_edit_schedule()) with check (public.can_edit_schedule())',t);
  end loop;
end $$;

drop policy if exists "admin read audit" on public.schedule_audit;
create policy "admin read audit" on public.schedule_audit for select to authenticated
using (public.is_app_admin());
drop policy if exists "staff append audit" on public.schedule_audit;
create policy "staff append audit" on public.schedule_audit for insert to authenticated
with check (public.can_edit_schedule());

-- New accounts receive viewer rights; an administrator explicitly promotes staff.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.user_profiles(user_id,full_name,app_role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'viewer')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_okpt on auth.users;
create trigger on_auth_user_created_okpt after insert on auth.users
for each row execute procedure public.handle_new_user();
