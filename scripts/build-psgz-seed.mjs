import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(new URL("../data/psgz-2026-27.json", import.meta.url), "utf8"));
const q = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const sql = [
  "-- Generated from the official PSGZ 2026/27 schedules.",
  "-- Run AFTER supabase/upgrade_v2.sql. Safe to run again: existing PSGZ events are updated.",
  "begin;",
];
const teams = [...new Set(input.flatMap((league) => league.games.flatMap((g) => [g.home, g.away])))].sort();
for (const team of teams) sql.push(`insert into public.teams(name) values(${q(team)}) on conflict(name) do nothing;`);
for (const league of input) {
  sql.push(`insert into public.competition_teams(competition_id,team_id) select c.id,t.id from public.competitions c,public.seasons s,public.teams t where c.season_id=s.id and s.name='2026./27.' and c.external_id=${q(league.externalId)} and t.name in (${[...new Set(league.games.flatMap(g=>[g.home,g.away]))].map(q).join(",")}) on conflict do nothing;`);
  for (const game of league.games) {
    const m = game.date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.\s+(\d{1,2}:\d{2})/);
    if (!m) continue;
    const date = `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    sql.push(`insert into public.matches(match_date,match_time,home_team_id,away_team_id,competition_id,external_event_id,league,round_name) select ${q(date)}::date,${q(m[4])}::time,h.id,a.id,c.id,${q(game.eventId)},${q(league.name)},${q(game.round)} from public.teams h,public.teams a,public.competitions c,public.seasons s where h.name=${q(game.home)} and a.name=${q(game.away)} and c.season_id=s.id and s.name='2026./27.' and c.external_id=${q(league.externalId)} on conflict(competition_id,external_event_id) where external_event_id<>'' do update set match_date=excluded.match_date,match_time=excluded.match_time,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,league=excluded.league,round_name=excluded.round_name;`);
  }
}
sql.push("commit;", "");
fs.writeFileSync(new URL("../supabase/psgz_2026_27_seed.sql", import.meta.url), sql.join("\n"));
const firstLeagueFinish = input.find((league) => league.externalId === "815");
const finishSql = [
  "-- Dopuna 1. LIGE, kola 19-26. Sigurna za ponovno pokretanje: ne mijenja postojeće utakmice.",
  "-- Pokrenuti nakon supabase/psgz_2026_27_seed.sql ili ako aplikacija završava na 18. kolu.",
  "begin;",
];
for (const game of firstLeagueFinish?.games.filter((g) => Number.parseInt(g.round, 10) >= 19) ?? []) {
  const m = game.date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.\s+(\d{1,2}:\d{2})/);
  if (!m) continue;
  const date = `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  finishSql.push(`insert into public.matches(match_date,match_time,home_team_id,away_team_id,competition_id,external_event_id,league,round_name) select ${q(date)}::date,${q(m[4])}::time,h.id,a.id,c.id,${q(game.eventId)},'1. LIGA',${q(game.round)} from public.teams h,public.teams a,public.competitions c,public.seasons s where h.name=${q(game.home)} and a.name=${q(game.away)} and c.season_id=s.id and s.name='2026./27.' and c.external_id='815' on conflict(competition_id,external_event_id) where external_event_id<>'' do nothing;`);
}
finishSql.push("commit;", "");
fs.writeFileSync(new URL("../supabase/psgz_1_liga_kola_19_26.sql", import.meta.url), finishSql.join("\n"));
console.log(`${input.length} natjecanja, ${teams.length} timova, ${input.reduce((n,l)=>n+l.games.length,0)} utakmica`);
