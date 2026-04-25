create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_username_idx
  on public.users (username);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  content text default ''::text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notes_set_updated_at on public.notes;
drop trigger if exists users_set_updated_at on public.users;

create trigger notes_set_updated_at
before update on public.notes
for each row
execute function public.update_updated_at_column();

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.update_updated_at_column();

alter table public.notes enable row level security;
alter table public.users enable row level security;

drop policy if exists "Service role can manage notes" on public.notes;
create policy "Service role can manage notes"
on public.notes
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage users" on public.users;
create policy "Service role can manage users"
on public.users
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
