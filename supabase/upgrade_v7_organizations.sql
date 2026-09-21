-- DartsScheduler v7: organizacije, administratori organizacija i rezervacije lokacija.
-- Pokrenuti jednom NAKON upgrade_v3_club_managers.sql i upgrade_v5_excel_import.sql.
-- Postojeći podaci automatski postaju dio organizacije PSGZ.
begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code text not null default 'HR',
  default_language text not null default 'hr',
  website text not null default '',
  logo_url text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.organizations(name,slug,country_code,default_language,website)
values('Pikado savez Grada Zagreba','psgz','HR','hr','https://psgz.hr/')
on conflict(slug) do update set name=excluded.name;

alter table public.seasons add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.competitions add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.clubs add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.venues add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.teams add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.matches add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.schedule_changes add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.seasons set organization_id=(select id from public.organizations where slug='psgz') where organization_id is null;
update public.competitions c set organization_id=s.organization_id from public.seasons s where c.season_id=s.id and c.organization_id is null;
update public.clubs set organization_id=(select id from public.organizations where slug='psgz') where organization_id is null;
update public.venues set organization_id=(select id from public.organizations where slug='psgz') where organization_id is null;
update public.teams set organization_id=(select id from public.organizations where slug='psgz') where organization_id is null;
update public.matches m set organization_id=coalesce(c.organization_id,(select id from public.organizations where slug='psgz'))
from public.competitions c where m.competition_id=c.id and m.organization_id is null;
update public.matches set organization_id=(select id from public.organizations where slug='psgz') where organization_id is null;
update public.schedule_changes sc set organization_id=m.organization_id from public.matches m where sc.match_id=m.id and sc.organization_id is null;

alter table public.seasons alter column organization_id set not null;
alter table public.competitions alter column organization_id set not null;
alter table public.clubs alter column organization_id set not null;
alter table public.venues alter column organization_id set not null;
alter table public.teams alter column organization_id set not null;
alter table public.matches alter column organization_id set not null;
alter table public.schedule_changes alter column organization_id set not null;

alter table public.seasons drop constraint if exists seasons_name_key;
alter table public.clubs drop constraint if exists clubs_name_key;
alter table public.venues drop constraint if exists venues_name_key;
alter table public.teams drop constraint if exists teams_name_key;
create unique index if not exists seasons_org_name_uq on public.seasons(organization_id,lower(name));
create unique index if not exists clubs_org_name_uq on public.clubs(organization_id,lower(name));
create unique index if not exists venues_org_name_uq on public.venues(organization_id,lower(name));
create unique index if not exists teams_org_name_uq on public.teams(organization_id,lower(name));
create index if not exists competitions_org_idx on public.competitions(organization_id);
create index if not exists matches_org_date_idx on public.matches(organization_id,match_date);

do $$
declare constraint_name text;
begin
  select conname into constraint_name from pg_constraint
  where conrelid='public.app_users'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%role%' limit 1;
  if constraint_name is not null then execute format('alter table public.app_users drop constraint %I',constraint_name); end if;
  update public.app_users set role='platform_admin' where role='admin';
  alter table public.app_users add constraint app_users_role_check
    check(role in ('platform_admin','organization_admin','club_manager','captain'));
end $$;

create table if not exists public.organization_admins (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null references public.app_users(email) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(organization_id,email)
);

create table if not exists public.venue_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  event_date date not null,
  start_time time,
  end_time time,
  title text not null,
  organizer text not null default '',
  note text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(end_time is null or start_time is null or end_time > start_time)
);
create index if not exists venue_bookings_org_date_idx on public.venue_bookings(organization_id,event_date);
create index if not exists venue_bookings_venue_date_idx on public.venue_bookings(venue_id,event_date);

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.app_users au where au.role='platform_admin'
    and (au.user_id=auth.uid() or lower(au.email)=lower(coalesce(auth.jwt()->>'email',''))));
$$;
create or replace function public.is_organization_admin(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_platform_admin() or exists(
    select 1 from public.organization_admins oa
    where oa.organization_id=target and lower(oa.email)=lower(coalesce(auth.jwt()->>'email',''))
  );
$$;
create or replace function public.is_any_organization_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_platform_admin() or exists(
    select 1 from public.organization_admins oa where lower(oa.email)=lower(coalesce(auth.jwt()->>'email',''))
  );
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path='' as $$ select public.is_platform_admin(); $$;
create or replace function public.current_organization_role(target uuid) returns text
language sql stable security definer set search_path='' as $$
  select case
    when public.is_platform_admin() then 'platform_admin'
    when public.is_organization_admin(target) then 'organization_admin'
    when exists(select 1 from public.club_managers cm join public.clubs c on c.id=cm.club_id where c.organization_id=target and lower(cm.email)=lower(coalesce(auth.jwt()->>'email',''))) then 'club_manager'
    when exists(select 1 from public.team_editors te join public.teams t on t.id=te.team_id where t.organization_id=target and lower(te.email)=lower(coalesce(auth.jwt()->>'email',''))) then 'captain'
    else 'viewer' end;
$$;
create or replace function public.current_app_role() returns text
language sql stable security definer set search_path='' as $$
  select case when public.is_platform_admin() then 'platform_admin'
    when public.is_any_organization_admin() then 'organization_admin'
    when exists(select 1 from public.club_managers cm where lower(cm.email)=lower(coalesce(auth.jwt()->>'email',''))) then 'club_manager'
    when exists(select 1 from public.team_editors te where lower(te.email)=lower(coalesce(auth.jwt()->>'email',''))) then 'captain'
    else 'viewer' end;
$$;
create or replace function public.can_manage_club(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_organization_admin((select organization_id from public.clubs where id=target)) or exists(
    select 1 from public.club_managers cm where cm.club_id=target and lower(cm.email)=lower(coalesce(auth.jwt()->>'email',''))
  );
$$;
create or replace function public.can_edit_team(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_organization_admin((select organization_id from public.teams where id=target))
    or exists(select 1 from public.team_editors te where te.team_id=target and lower(te.email)=lower(coalesce(auth.jwt()->>'email','')))
    or exists(select 1 from public.teams t join public.club_managers cm on cm.club_id=t.club_id where t.id=target and lower(cm.email)=lower(coalesce(auth.jwt()->>'email','')));
$$;
create or replace function public.can_edit_venue(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_organization_admin((select organization_id from public.venues where id=target)) or exists(
    select 1 from public.club_venues cv join public.club_managers cm on cm.club_id=cv.club_id
    where cv.venue_id=target and lower(cm.email)=lower(coalesce(auth.jwt()->>'email',''))
  );
$$;
create or replace function public.can_edit_match(home_id uuid,away_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.can_edit_team(home_id) or public.can_edit_team(away_id);
$$;

create or replace function public.protect_last_organization_admin() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from public.organization_admins where organization_id=old.organization_id) <= 1 then
    raise exception 'Organizacija mora imati najmanje jednog administratora.';
  end if;
  return old;
end $$;
drop trigger if exists protect_last_organization_admin on public.organization_admins;
create trigger protect_last_organization_admin before delete on public.organization_admins
for each row execute function public.protect_last_organization_admin();

create or replace function public.log_schedule_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.match_date is distinct from new.match_date or old.match_time is distinct from new.match_time or old.venue_id is distinct from new.venue_id then
    insert into public.schedule_changes(match_id,organization_id,changed_by,old_date,new_date,old_time,new_time,old_venue_id,new_venue_id)
    values(new.id,new.organization_id,coalesce(auth.jwt()->>'email','administrator'),old.match_date,new.match_date,old.match_time,new.match_time,old.venue_id,new.venue_id);
  end if; new.updated_at=now(); return new;
end $$;

alter table public.organizations enable row level security;
alter table public.organization_admins enable row level security;
alter table public.venue_bookings enable row level security;
grant select on public.organizations,public.venue_bookings to anon,authenticated;
grant insert,update,delete on public.organizations,public.organization_admins,public.venue_bookings to authenticated;
grant select on public.organization_admins to authenticated;
grant execute on function public.is_platform_admin(),public.is_organization_admin(uuid),public.is_any_organization_admin(),public.current_organization_role(uuid) to authenticated;

create policy "public read organizations" on public.organizations for select using(true);
create policy "platform inserts organizations" on public.organizations for insert to authenticated with check(public.is_platform_admin());
create policy "admins update organizations" on public.organizations for update to authenticated using(public.is_organization_admin(id)) with check(public.is_organization_admin(id));
create policy "platform deletes organizations" on public.organizations for delete to authenticated using(public.is_platform_admin());
create policy "admins read organization admins" on public.organization_admins for select to authenticated
using(public.is_organization_admin(organization_id) or lower(email)=lower(coalesce(auth.jwt()->>'email','')));
create policy "admins write organization admins" on public.organization_admins for all to authenticated
using(public.is_organization_admin(organization_id)) with check(public.is_organization_admin(organization_id));
create policy "public read bookings" on public.venue_bookings for select using(true);
create policy "authorized insert bookings" on public.venue_bookings for insert to authenticated
with check(public.is_organization_admin(organization_id) or public.can_edit_venue(venue_id));
create policy "authorized update bookings" on public.venue_bookings for update to authenticated
using(public.is_organization_admin(organization_id) or public.can_edit_venue(venue_id))
with check(public.is_organization_admin(organization_id) or public.can_edit_venue(venue_id));
create policy "authorized delete bookings" on public.venue_bookings for delete to authenticated
using(public.is_organization_admin(organization_id) or public.can_edit_venue(venue_id));

drop policy if exists "admin seasons" on public.seasons;
create policy "organization admins write seasons" on public.seasons for all to authenticated
using(public.is_organization_admin(organization_id)) with check(public.is_organization_admin(organization_id));
drop policy if exists "admin competitions" on public.competitions;
create policy "organization admins write competitions" on public.competitions for all to authenticated
using(public.is_organization_admin(organization_id)) with check(public.is_organization_admin(organization_id));
drop policy if exists "admin competition teams" on public.competition_teams;
create policy "organization admins write competition teams" on public.competition_teams for all to authenticated
using(public.is_organization_admin((select organization_id from public.competitions where id=competition_id)))
with check(public.is_organization_admin((select organization_id from public.competitions where id=competition_id)));

drop policy if exists "admin inserts clubs" on public.clubs;
create policy "organization admins insert clubs" on public.clubs for insert to authenticated with check(public.is_organization_admin(organization_id));
drop policy if exists "admin or manager updates clubs" on public.clubs;
create policy "authorized update clubs" on public.clubs for update to authenticated using(public.can_manage_club(id)) with check(public.can_manage_club(id));
drop policy if exists "admin deletes clubs" on public.clubs;
create policy "organization admins delete clubs" on public.clubs for delete to authenticated using(public.is_organization_admin(organization_id));
drop policy if exists "admin writes club venues" on public.club_venues;
create policy "organization admins write club venues" on public.club_venues for all to authenticated
using(public.is_organization_admin((select organization_id from public.clubs where id=club_id)))
with check(public.is_organization_admin((select organization_id from public.clubs where id=club_id)));

drop policy if exists "admin writes club managers" on public.club_managers;
drop policy if exists "managers read own assignments" on public.club_managers;
create policy "organization users read club managers" on public.club_managers for select to authenticated
using(lower(email)=lower(coalesce(auth.jwt()->>'email','')) or public.is_organization_admin((select organization_id from public.clubs where id=club_id)));
create policy "organization admins write club managers" on public.club_managers for all to authenticated
using(public.is_organization_admin((select organization_id from public.clubs where id=club_id)))
with check(public.is_organization_admin((select organization_id from public.clubs where id=club_id)));
drop policy if exists "admin team editors" on public.team_editors;
drop policy if exists "captains read own assignments" on public.team_editors;
create policy "organization users read team editors" on public.team_editors for select to authenticated
using(lower(email)=lower(coalesce(auth.jwt()->>'email','')) or public.is_organization_admin((select organization_id from public.teams where id=team_id)));
create policy "organization admins write team editors" on public.team_editors for all to authenticated
using(public.is_organization_admin((select organization_id from public.teams where id=team_id)))
with check(public.is_organization_admin((select organization_id from public.teams where id=team_id)));

drop policy if exists "admin app users" on public.app_users;
drop policy if exists "users own or admin" on public.app_users;
create policy "delegated admins read app users" on public.app_users for select to authenticated
using(lower(email)=lower(coalesce(auth.jwt()->>'email','')) or public.is_platform_admin() or public.is_any_organization_admin());
create policy "delegated admins write app users" on public.app_users for all to authenticated
using(public.is_platform_admin() or public.is_any_organization_admin())
with check(public.is_platform_admin() or public.is_any_organization_admin());

drop policy if exists "admin inserts venues" on public.venues;
create policy "organization admins insert venues" on public.venues for insert to authenticated with check(public.is_organization_admin(organization_id));
drop policy if exists "admin deletes venues" on public.venues;
create policy "organization admins delete venues" on public.venues for delete to authenticated using(public.is_organization_admin(organization_id));
drop policy if exists "admin inserts teams" on public.teams;
create policy "organization admins insert teams" on public.teams for insert to authenticated with check(public.is_organization_admin(organization_id));
drop policy if exists "admin deletes teams" on public.teams;
create policy "organization admins delete teams" on public.teams for delete to authenticated using(public.is_organization_admin(organization_id));
drop policy if exists "admin deletes matches" on public.matches;
create policy "organization admins delete matches" on public.matches for delete to authenticated using(public.is_organization_admin(organization_id));

-- Nakon migracije dodajte prvog administratora PSGZ-a (može biti i platform admin).
insert into public.organization_admins(organization_id,email)
select o.id,au.email from public.organizations o cross join public.app_users au
where o.slug='psgz' and au.role='platform_admin'
on conflict do nothing;

commit;
