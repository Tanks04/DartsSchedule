-- DartsScheduler v5: ovlašteni uvoz rasporeda iz Excela/CSV-a.
-- Pokrenuti jednom NAKON upgrade_v3_club_managers.sql.
-- Kapetan smije dodati utakmicu svojeg tima, voditelj utakmicu tima svojeg kluba,
-- a administrator bilo koju utakmicu. Javni korisnici i dalje imaju samo čitanje.
begin;

drop policy if exists "admin inserts matches" on public.matches;
drop policy if exists "authorized users insert matches" on public.matches;
create policy "authorized users insert matches" on public.matches
for insert to authenticated
with check(public.can_edit_match(home_team_id,away_team_id));

commit;
