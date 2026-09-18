-- DartsScheduler: jednom pokrenuti u Supabase SQL Editoru.
create extension if not exists pgcrypto;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  address text not null default '', is_featured boolean not null default false,
  contact_name text not null default '', phone text not null default '',
  email text not null default '', map_url text not null default '',
  note text not null default '', created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  club_name text not null default '',
  default_venue_id uuid references public.venues(id) on delete set null,
  contact_name text not null default '', phone text not null default '',
  email text not null default '', note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(), match_date date not null,
  match_time time, home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid not null references public.teams(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  league text not null default '', round_name text not null default '',
  note text not null default '', created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table if not exists public.editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.venues enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.editors enable row level security;

revoke all on public.venues, public.teams, public.matches, public.editors from anon, authenticated;
grant select on public.venues, public.teams, public.matches to anon, authenticated;
grant insert, update, delete on public.venues, public.teams, public.matches to authenticated;
grant select on public.editors to authenticated;

create policy "public read venues" on public.venues for select to anon, authenticated using (true);
create policy "public read teams" on public.teams for select to anon, authenticated using (true);
create policy "public read matches" on public.matches for select to anon, authenticated using (true);
create policy "editor reads own role" on public.editors for select to authenticated using (user_id = auth.uid());

create policy "editors write venues" on public.venues for all to authenticated
  using (exists (select 1 from public.editors e where e.user_id = auth.uid()))
  with check (exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "editors write teams" on public.teams for all to authenticated
  using (exists (select 1 from public.editors e where e.user_id = auth.uid()))
  with check (exists (select 1 from public.editors e where e.user_id = auth.uid()));
create policy "editors write matches" on public.matches for all to authenticated
  using (exists (select 1 from public.editors e where e.user_id = auth.uid()))
  with check (exists (select 1 from public.editors e where e.user_id = auth.uid()));

-- Nakon prve prijave urednika kopirajte njegov UUID iz Authentication > Users:
-- insert into public.editors (user_id) values ('UUID-UREDNIKA');

