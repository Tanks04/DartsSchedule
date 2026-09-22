-- DartsScheduler v8: sigurno arhiviranje klubova i timova
-- Pokrenuti jednom NAKON upgrade_v7_organizations.sql.

begin;

alter table public.teams
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text not null default '';

alter table public.clubs
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text not null default '';

create index if not exists teams_org_active_idx
  on public.teams(organization_id, is_active, name);

create index if not exists clubs_org_active_idx
  on public.clubs(organization_id, is_active, name);

notify pgrst, 'reload schema';

commit;

select 'DartsScheduler v8 archiving upgrade completed.' as result;
