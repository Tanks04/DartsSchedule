"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { CalendarDays, LogIn, LogOut, MapPin, Plus, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { actualVenue, dateKey, formatDate, normalizeHeader, seedData, type Match, type SchedulerData, type Team, type Venue } from "@/lib/darts-data";

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

type Raw = Record<string, unknown>;

function field(row: Raw, aliases: string[]) {
  const pair = Object.entries(row).find(([key]) => aliases.includes(normalizeHeader(key)));
  return pair?.[1] ?? "";
}
function text(row: Raw, aliases: string[]) { return String(field(row, aliases) ?? "").trim(); }
function toDate(value: unknown) {
  if (value instanceof Date) return dateKey(value);
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const raw = String(value ?? "").trim();
  const hr = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (hr) return `${hr[3]}-${hr[2].padStart(2, "0")}-${hr[1].padStart(2, "0")}`;
  return raw.slice(0, 10);
}
function toTime(value: unknown) {
  if (typeof value === "number") {
    const mins = Math.round((value % 1) * 1440);
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
  return String(value ?? "").match(/\d{1,2}:\d{2}/)?.[0] ?? String(value ?? "").trim();
}
function sheetRows(book: XLSX.WorkBook, names: string[]) {
  const sheetName = book.SheetNames.find((name) => names.includes(normalizeHeader(name)));
  return sheetName ? XLSX.utils.sheet_to_json<Raw>(book.Sheets[sheetName], { raw: true, defval: "" }) : [];
}

function Status({ busy }: { busy: boolean }) {
  return <span className={`status ${busy ? "busy" : "free"}`}>{busy ? "ZAUZETO" : "SLOBODNO"}</span>;
}

export default function Home() {
  const [data, setData] = useState<SchedulerData>(seedData);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [team, setTeam] = useState("A1 OTPISANI");
  const [venue, setVenue] = useState("A1 – Cirkovci 72");
  const [editor, setEditor] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [venuesResult, teamsResult, matchesResult] = await Promise.all([
      supabase.from("venues").select("*").order("name"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("matches").select("*").order("match_date").order("match_time"),
    ]);
    const error = venuesResult.error || teamsResult.error || matchesResult.error;
    if (error) { setNotice(`Podaci se ne mogu učitati: ${error.message}`); setLoading(false); return; }
    const venues: Venue[] = (venuesResult.data ?? []).map((v) => ({ id: v.id, name: v.name, address: v.address, mine: v.is_featured, contact: v.contact_name, phone: v.phone, email: v.email, map: v.map_url, note: v.note }));
    const venueById = new Map(venues.map((v) => [v.id, v.name]));
    const teams: Team[] = (teamsResult.data ?? []).map((t) => ({ id: t.id, name: t.name, club: t.club_name, defaultVenue: venueById.get(t.default_venue_id) ?? "", contact: t.contact_name, phone: t.phone, email: t.email, note: t.note }));
    const teamById = new Map(teams.map((t) => [t.id, t.name]));
    const matches: Match[] = (matchesResult.data ?? []).map((m) => ({ id: m.id, date: m.match_date, time: String(m.match_time ?? "").slice(0, 5), home: teamById.get(m.home_team_id) ?? "Nepoznata ekipa", away: teamById.get(m.away_team_id) ?? "Nepoznata ekipa", venue: venueById.get(m.venue_id) ?? "", league: m.league, round: m.round_name, note: m.note }));
    setData({ venues, teams, matches });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void loadData();
    client.auth.getSession().then(async ({ data: auth }) => {
      const email = auth.session?.user.email ?? "";
      setSessionEmail(email);
      if (auth.session) {
        const { data: role } = await client.from("editors").select("user_id").eq("user_id", auth.session.user.id).maybeSingle();
        setEditor(Boolean(role));
      }
    });
    const { data: listener } = client.auth.onAuthStateChange(() => void loadData());
    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  useEffect(() => {
    if (!data.teams.some((t) => t.name === team)) setTeam(data.teams[0]?.name ?? "");
    if (!data.venues.some((v) => v.name === venue)) setVenue(data.venues.find((v) => v.mine)?.name ?? data.venues[0]?.name ?? "");
  }, [data, team, venue]);

  const today = dateKey(new Date());
  const teamMatches = useMemo(() => data.matches.filter((m) => m.home === team || m.away === team).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [data.matches, team]);
  const venueMatches = useMemo(() => data.matches.filter((m) => actualVenue(m, data.teams) === venue), [data.matches, data.teams, venue]);
  const todayMatches = venueMatches.filter((m) => m.date === today);
  const selectedTeam = data.teams.find((t) => t.name === team);
  const selectedVenue = data.venues.find((v) => v.name === venue);
  const days = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); const key = dateKey(d); return { key, d, matches: venueMatches.filter((m) => m.date === key) }; });

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const venueTool = {
      name: "get_venue_availability",
      title: "Provjeri zauzetost lokacije",
      description: "Vraća utakmice i status slobodno/zauzeto za odabranu lokaciju i datum.",
      inputSchema: { type: "object", properties: { venue: { type: "string" }, date: { type: "string", description: "Datum YYYY-MM-DD" } }, required: ["venue", "date"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { venue?: string; date?: string };
        if (!value.venue || !value.date) throw new Error("Potrebni su venue i date.");
        const matches = data.matches.filter((match) => actualVenue(match, data.teams) === value.venue && match.date === value.date);
        return { venue: value.venue, date: value.date, status: matches.length ? "ZAUZETO" : "SLOBODNO", matches: matches.map((m) => ({ time: m.time, home: m.home, away: m.away })) };
      },
    };
    const teamTool = {
      name: "get_team_schedule",
      title: "Dohvati raspored ekipe",
      description: "Vraća kronološki raspored utakmica za odabranu ekipu.",
      inputSchema: { type: "object", properties: { team: { type: "string" } }, required: ["team"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { team?: string };
        if (!value.team) throw new Error("Potrebno je ime ekipe.");
        return data.matches.filter((m) => m.home === value.team || m.away === value.team).map((m) => ({ date: m.date, time: m.time, home: m.home, away: m.away, venue: actualVenue(m, data.teams) }));
      },
    };
    void Promise.resolve(context.registerTool(venueTool, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool(teamTool, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [data]);

  async function importWorkbook(file: File) {
    if (!supabase || !editor) return;
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const venueRows = sheetRows(book, ["lokacije", "mjesta", "venues"]);
      const teamRows = sheetRows(book, ["ekipe", "timovi", "teams"]);
      const matchRows = sheetRows(book, ["utakmice", "raspored", "matches"]);
      if (!venueRows.length && !teamRows.length && !matchRows.length) throw new Error("Nisu pronađeni listovi Utakmice, Ekipe ili Lokacije.");

      if (venueRows.length) {
        const rows = venueRows.map((r) => ({ name: text(r, ["naziv mjesta", "naziv mesta"]), address: text(r, ["adresa"]), is_featured: ["da", "yes", "1", "true", "x"].includes(normalizeHeader(field(r, ["moje mjesto da ne", "moje mjesto"]))), contact_name: text(r, ["kontakt osoba"]), phone: text(r, ["telefon"]), email: text(r, ["email"]), map_url: text(r, ["web karta", "karta"]), note: text(r, ["napomena"]) })).filter((r) => r.name);
        const { error } = await supabase.from("venues").upsert(rows, { onConflict: "name" }); if (error) throw error;
      }
      const { data: remoteVenues } = await supabase.from("venues").select("id,name");
      const venueIds = new Map((remoteVenues ?? []).map((v) => [v.name, v.id]));
      if (teamRows.length) {
        const rows = teamRows.map((r) => ({ name: text(r, ["naziv ekipe", "naziv tima"]), club_name: text(r, ["naziv kluba"]), default_venue_id: venueIds.get(text(r, ["zadano mjesto igranja", "mjesto igranja"])) ?? null, contact_name: text(r, ["kontakt osoba", "kontakt name"]), phone: text(r, ["telefon", "kontakt"]), email: text(r, ["email"]), note: text(r, ["napomena"]) })).filter((r) => r.name);
        const { error } = await supabase.from("teams").upsert(rows, { onConflict: "name" }); if (error) throw error;
      }
      const { data: remoteTeams } = await supabase.from("teams").select("id,name,default_venue_id");
      const teamIds = new Map((remoteTeams ?? []).map((t) => [t.name, t]));
      if (matchRows.length) {
        const rows = matchRows.map((r) => { const home = teamIds.get(text(r, ["domacin", "doma", "home"])); const away = teamIds.get(text(r, ["gost", "guest"])); const chosenVenue = text(r, ["mjesto igranja", "lokacija", "venue"]); return { match_date: toDate(field(r, ["datum", "date"])), match_time: toTime(field(r, ["vrijeme", "time"])) || null, home_team_id: home?.id, away_team_id: away?.id, venue_id: chosenVenue ? venueIds.get(chosenVenue) ?? null : null, league: text(r, ["liga"]), round_name: text(r, ["kolo"]), note: text(r, ["napomena"]) }; }).filter((r) => r.match_date && r.home_team_id && r.away_team_id);
        const { error: deleteError } = await supabase.from("matches").delete().not("id", "is", null); if (deleteError) throw deleteError;
        if (rows.length) { const { error } = await supabase.from("matches").insert(rows); if (error) throw error; }
      }
      await loadData(); setNotice("Uvoz je završen. Svi posjetitelji sada vide novi raspored.");
    } catch (e) { setNotice(`Uvoz nije uspio: ${e instanceof Error ? e.message : "nepoznata greška"}`); }
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span>DS</span><div><strong>DartsScheduler</strong><small>raspored ekipa i lokacija</small></div></div>
      <div className="top-actions">
        {editor && <><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importWorkbook(file); e.currentTarget.value = ""; }} /><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Uvezi</Button><Button className="red-button" onClick={() => setAddOpen(true)}><Plus /> Utakmica</Button></>}
        {sessionEmail ? <Button variant="ghost" onClick={() => supabase?.auth.signOut().then(() => { setSessionEmail(""); setEditor(false); })}><LogOut /> Odjava</Button> : <Button variant="ghost" onClick={() => setLoginOpen(true)}><LogIn /> Urednik</Button>}
      </div>
    </header>
    {notice && <button className="notice" onClick={() => setNotice("")}>{notice}</button>}
    {!supabaseConfigured && <div className="setup-note">Demo prikaz — Supabase još nije povezan.</div>}
    <div className="dashboard">
      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow"><Users /> Raspored ekipe</span><h1>{team || "Nema ekipa"}</h1></div><NativeSelect value={team} onChange={(e) => setTeam(e.target.value)}>{data.teams.map((t) => <NativeSelectOption key={t.id} value={t.name}>{t.name}</NativeSelectOption>)}</NativeSelect></div>
        {selectedTeam && <p className="meta">{selectedTeam.club} · <MapPin /> {selectedTeam.defaultVenue}</p>}
        <div className="section-label"><span>Utakmice</span><b>{teamMatches.length}</b></div>
        <div className="match-list">{loading ? <Empty>Učitavanje…</Empty> : teamMatches.length ? teamMatches.map((m) => <MatchRow key={m.id} match={m} venue={actualVenue(m, data.teams)} />) : <Empty>Za ovu ekipu nema utakmica.</Empty>}</div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow"><MapPin /> Zauzetost lokacije</span><h2>{venue || "Nema lokacija"}</h2></div><NativeSelect value={venue} onChange={(e) => setVenue(e.target.value)}>{data.venues.slice().sort((a,b) => Number(b.mine)-Number(a.mine) || a.name.localeCompare(b.name)).map((v) => <NativeSelectOption key={v.id} value={v.name}>{v.mine ? "★ " : ""}{v.name}</NativeSelectOption>)}</NativeSelect></div>
        {selectedVenue && <p className="meta"><MapPin /> {selectedVenue.address}{selectedVenue.mine && <b className="mine">MOJE MJESTO</b>}</p>}
        <div className={`today ${todayMatches.length ? "busy" : "free"}`}><div><small>Danas</small><Status busy={todayMatches.length > 0} /></div><div>{todayMatches.length ? todayMatches.map((m) => <span key={m.id}>{m.time || "—"} · {m.home} — {m.away}</span>) : <span>Nema utakmica na ovoj lokaciji.</span>}</div></div>
        <div className="section-label"><span>Sljedećih 7 dana</span></div>
        <div className="week">{days.map((day) => <div className="day" key={day.key}><div><b>{new Intl.DateTimeFormat("hr-HR", { weekday: "short" }).format(day.d)}</b><span>{formatDate(day.key)}</span></div><Status busy={day.matches.length > 0} /><div>{day.matches.length ? day.matches.map((m) => <span key={m.id}>{m.time || "—"} · {m.home} — {m.away}</span>) : "—"}</div></div>)}</div>
      </section>
    </div>
    <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} onNotice={setNotice} />
    <AddMatchDialog open={addOpen} onClose={() => setAddOpen(false)} data={data} onSaved={async () => { setAddOpen(false); await loadData(); }} onNotice={setNotice} />
  </main>;
}

function MatchRow({ match, venue }: { match: Match; venue: string }) { return <article className="match"><div className="when"><b>{formatDate(match.date)}</b><span>{match.time || "—"}</span></div><div><b>{match.home}</b><span> — </span><b>{match.away}</b><small><MapPin /> {venue || "Lokacija nije određena"}</small></div>{(match.league || match.round) && <em>{[match.league, match.round].filter(Boolean).join(" · ")}</em>}</article>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="empty">{children}</div>; }

function LoginDialog({ open, onClose, onNotice }: { open: boolean; onClose: () => void; onNotice: (s: string) => void }) {
  const [email, setEmail] = useState("");
  async function send() { if (!supabase) return; const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } }); onNotice(error ? error.message : "Poslali smo poveznicu za prijavu na e-mail."); if (!error) onClose(); }
  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}><DialogContent><DialogHeader><DialogTitle>Prijava urednika</DialogTitle><DialogDescription>Poslat ćemo jednokratnu poveznicu na odobrenu e-mail adresu.</DialogDescription></DialogHeader><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ime@primjer.hr" /><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={() => void send()}>Pošalji poveznicu</Button></DialogFooter></DialogContent></Dialog>;
}

function AddMatchDialog({ open, onClose, data, onSaved, onNotice }: { open: boolean; onClose: () => void; data: SchedulerData; onSaved: () => void; onNotice: (s: string) => void }) {
  const [form, setForm] = useState({ date: dateKey(new Date()), time: "19:00", home: "", away: "", venue: "", league: "", round: "" });
  async function save() { if (!supabase) return; const home = data.teams.find((t) => t.name === form.home); const away = data.teams.find((t) => t.name === form.away); const venue = data.venues.find((v) => v.name === form.venue); if (!home || !away) return onNotice("Odaberite domaćina i gosta."); const { error } = await supabase.from("matches").insert({ match_date: form.date, match_time: form.time || null, home_team_id: home.id, away_team_id: away.id, venue_id: venue?.id ?? null, league: form.league, round_name: form.round }); if (error) onNotice(error.message); else onSaved(); }
  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}><DialogContent><DialogHeader><DialogTitle>Dodaj utakmicu</DialogTitle><DialogDescription>Prazna lokacija koristi zadano mjesto domaće ekipe.</DialogDescription></DialogHeader><div className="form-grid"><label>Datum<Input type="date" value={form.date} onChange={(e) => setForm({...form,date:e.target.value})}/></label><label>Vrijeme<Input type="time" value={form.time} onChange={(e) => setForm({...form,time:e.target.value})}/></label><label>Domaćin<NativeSelect className="w-full" value={form.home} onChange={(e) => setForm({...form,home:e.target.value})}><NativeSelectOption value="">Odaberi</NativeSelectOption>{data.teams.map((t) => <NativeSelectOption key={t.id} value={t.name}>{t.name}</NativeSelectOption>)}</NativeSelect></label><label>Gost<NativeSelect className="w-full" value={form.away} onChange={(e) => setForm({...form,away:e.target.value})}><NativeSelectOption value="">Odaberi</NativeSelectOption>{data.teams.map((t) => <NativeSelectOption key={t.id} value={t.name}>{t.name}</NativeSelectOption>)}</NativeSelect></label><label className="wide">Mjesto igranja<NativeSelect className="w-full" value={form.venue} onChange={(e) => setForm({...form,venue:e.target.value})}><NativeSelectOption value="">Zadano mjesto domaćina</NativeSelectOption>{data.venues.map((v) => <NativeSelectOption key={v.id} value={v.name}>{v.name}</NativeSelectOption>)}</NativeSelect></label><label>Liga<Input value={form.league} onChange={(e) => setForm({...form,league:e.target.value})}/></label><label>Kolo<Input value={form.round} onChange={(e) => setForm({...form,round:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={() => void save()}>Spremi</Button></DialogFooter></DialogContent></Dialog>;
}
