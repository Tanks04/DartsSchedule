"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Edit3, LogIn, LogOut, MapPin, Settings, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { actualVenue, dateKey, formatDate, seedData, type Competition, type Match, type SchedulerData, type Team, type Venue } from "@/lib/darts-data";

type AppRole = "viewer" | "captain" | "admin";
type Captain = { email: string; user_id: string | null; team_id: string; team_name: string };
const prefLeague = "dartsScheduler.defaultCompetition";
const prefTeam = "dartsScheduler.defaultTeam";

function Status({ busy }: { busy: boolean }) {
  return <span className={`status ${busy ? "busy" : "free"}`}>{busy ? "ZAUZETO" : "SLOBODNO"}</span>;
}

export default function Home() {
  const [data, setData] = useState<SchedulerData>(seedData);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [competitionId, setCompetitionId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [editableTeams, setEditableTeams] = useState<string[]>([]);
  const [sessionEmail, setSessionEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captainsOpen, setCaptainsOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const admin = role === "admin";

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [seasonsR, competitionsR, venuesR, teamsR, membershipR, matchesR, changesR] = await Promise.all([
      supabase.from("seasons").select("*").order("name", { ascending: false }),
      supabase.from("competitions").select("*").order("name"),
      supabase.from("venues").select("*").order("name"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("competition_teams").select("competition_id,team_id"),
      supabase.from("matches").select("*").order("match_date").order("match_time"),
      supabase.from("schedule_changes").select("*").order("changed_at", { ascending: false }).limit(30),
    ]);
    const missing = seasonsR.error || competitionsR.error || membershipR.error || changesR.error;
    if (missing) {
      setNotice("Baza još nije nadograđena na v2. Admin treba pokrenuti supabase/upgrade_v2.sql.");
      setLoading(false); return;
    }
    const error = venuesR.error || teamsR.error || matchesR.error;
    if (error) { setNotice(`Podaci se ne mogu učitati: ${error.message}`); setLoading(false); return; }
    const venues: Venue[] = (venuesR.data ?? []).map(v => ({ id:v.id,name:v.name,address:v.address,mine:v.is_featured,contact:v.contact_name,phone:v.phone,email:v.email,map:v.map_url,note:v.note }));
    const venueNames = new Map(venues.map(v => [v.id,v.name]));
    const memberships = membershipR.data ?? [];
    const teams: Team[] = (teamsR.data ?? []).map(t => ({ id:t.id,name:t.name,club:t.club_name,defaultVenueId:t.default_venue_id ?? "",defaultVenue:venueNames.get(t.default_venue_id) ?? "",contact:t.contact_name,phone:t.phone,email:t.email,note:t.note,competitionIds:memberships.filter(m=>m.team_id===t.id).map(m=>m.competition_id) }));
    const teamNames = new Map(teams.map(t => [t.id,t.name]));
    const competitions: Competition[] = (competitionsR.data ?? []).map(c => ({ id:c.id,seasonId:c.season_id,name:c.name,externalId:c.external_id }));
    const competitionNames = new Map(competitions.map(c => [c.id,c.name]));
    const matches: Match[] = (matchesR.data ?? []).map(m => ({ id:m.id,date:m.match_date,time:String(m.match_time ?? "").slice(0,5),homeId:m.home_team_id,awayId:m.away_team_id,home:teamNames.get(m.home_team_id) ?? "Nepoznata ekipa",away:teamNames.get(m.away_team_id) ?? "Nepoznata ekipa",venueId:m.venue_id ?? "",venue:venueNames.get(m.venue_id) ?? "",competitionId:m.competition_id ?? "",competition:competitionNames.get(m.competition_id) ?? m.league ?? "",round:m.round_name,note:m.note }));
    const matchMap = new Map(matches.map(m => [m.id,m]));
    const changes = (changesR.data ?? []).map(c => { const m=matchMap.get(c.match_id); return { id:c.id,matchId:c.match_id,changedAt:c.changed_at,changedBy:c.changed_by,oldDate:c.old_date,newDate:c.new_date,oldTime:String(c.old_time??"").slice(0,5),newTime:String(c.new_time??"").slice(0,5),competition:m?.competition??"",home:m?.home??"",away:m?.away??"" }; });
    setData({ seasons:(seasonsR.data??[]).map(s=>({id:s.id,name:s.name,active:s.is_active})),competitions,venues,teams,matches,changes });
    setLoading(false);
  }, []);

  const syncAuth = useCallback(async (session: { user: { email?: string } } | null) => {
    if (!supabase) return;
    setSessionEmail(session?.user.email ?? "");
    if (!session) { setRole("viewer"); setEditableTeams([]); return; }
    const roleR = await supabase.rpc("current_app_role");
    if (roleR.error) { setRole("viewer"); setNotice("Prijavljeni ste, ali prava nisu aktivna. Pokrenite upgrade_v2.sql u Supabaseu."); return; }
    const nextRole = roleR.data === "admin" ? "admin" : roleR.data === "captain" ? "captain" : "viewer";
    setRole(nextRole);
    if (nextRole === "captain") {
      const email = session.user.email ?? "";
      const r = await supabase.from("team_editors").select("team_id").ilike("email", email);
      setEditableTeams((r.data ?? []).map(x => x.team_id));
    } else setEditableTeams([]);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void loadData();
    supabase.auth.getSession().then(({data:a}) => void syncAuth(a.session));
    const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>{ void syncAuth(s); void loadData(); });
    return ()=>l.subscription.unsubscribe();
  }, [loadData,syncAuth]);

  useEffect(() => {
    const storedCompetition = localStorage.getItem(prefLeague) ?? "";
    const storedTeam = localStorage.getItem(prefTeam) ?? "";
    if (!competitionId || !data.competitions.some(c=>c.id===competitionId)) setCompetitionId(data.competitions.find(c=>c.id===storedCompetition)?.id ?? data.competitions[0]?.id ?? "");
    if (!teamId || !data.teams.some(t=>t.id===teamId)) setTeamId(data.teams.find(t=>t.id===storedTeam)?.id ?? data.teams.find(t=>t.competitionIds.includes(storedCompetition))?.id ?? data.teams[0]?.id ?? "");
    if (!venueId || !data.venues.some(v=>v.id===venueId)) setVenueId(data.venues.find(v=>v.mine)?.id ?? data.venues[0]?.id ?? "");
  }, [data,competitionId,teamId,venueId]);

  const leagueTeams = useMemo(()=>data.teams.filter(t=>t.competitionIds.includes(competitionId)),[data.teams,competitionId]);
  useEffect(()=>{ if (leagueTeams.length && !leagueTeams.some(t=>t.id===teamId)) setTeamId(leagueTeams[0].id); },[leagueTeams,teamId]);
  const selectedTeam=data.teams.find(t=>t.id===teamId);
  const selectedVenue=data.venues.find(v=>v.id===venueId);
  const teamMatches=useMemo(()=>data.matches.filter(m=>m.competitionId===competitionId&&(m.homeId===teamId||m.awayId===teamId)),[data.matches,competitionId,teamId]);
  const venueMatches=useMemo(()=>data.matches.filter(m=>actualVenue(m,data.teams)===(selectedVenue?.name??"")),[data.matches,data.teams,selectedVenue]);
  const today=dateKey(new Date());
  const todayMatches=venueMatches.filter(m=>m.date===today);
  const days=Array.from({length:8},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i);const key=dateKey(d);return{key,d,matches:venueMatches.filter(m=>m.date===key)}});
  const canEdit=(m:Match)=>admin||editableTeams.includes(m.homeId)||editableTeams.includes(m.awayId);
  function selectCompetition(id:string){setCompetitionId(id);localStorage.setItem(prefLeague,id);const first=data.teams.find(t=>t.competitionIds.includes(id));if(first){setTeamId(first.id);localStorage.setItem(prefTeam,first.id);}}
  function selectTeam(id:string){setTeamId(id);localStorage.setItem(prefTeam,id);}

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span>DS</span><div><strong>DartsScheduler</strong><small>raspored ekipa i lokacija</small></div></div><div className="top-actions">
      <Button variant="ghost" onClick={()=>setSettingsOpen(true)}><Settings/> Postavke</Button>
      {admin&&<Button variant="outline" onClick={()=>setCaptainsOpen(true)}><UserCog/> Kapetani</Button>}
      {sessionEmail?<Button variant="ghost" onClick={()=>supabase?.auth.signOut()}><LogOut/> Odjava</Button>:<Button variant="ghost" onClick={()=>setLoginOpen(true)}><LogIn/> Prijava</Button>}
    </div></header>
    {notice&&<button className="notice" onClick={()=>setNotice("")}>{notice}</button>}
    {!supabaseConfigured&&<div className="setup-note">Demo prikaz — Supabase još nije povezan.</div>}
    <div className="filters"><label>Sezona<NativeSelect value={data.competitions.find(c=>c.id===competitionId)?.seasonId??""} disabled>{data.seasons.map(s=><NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}</NativeSelect></label><label>Liga<NativeSelect value={competitionId} onChange={e=>selectCompetition(e.target.value)}>{data.competitions.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></label><label>Tim<NativeSelect value={teamId} onChange={e=>selectTeam(e.target.value)}>{leagueTeams.map(t=><NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}</NativeSelect></label></div>
    <div className="dashboard">
      <section className="panel"><div className="panel-head"><div><span className="eyebrow"><Users/> Raspored ekipe</span><h1>{selectedTeam?.name??"Nema ekipa"}</h1></div><div className="panel-tools"><span className="role-pill">{admin?"ADMIN":role==="captain"?"KAPETAN":"PREGLED"}</span>{selectedTeam&&(admin||editableTeams.includes(selectedTeam.id))&&<Button variant="ghost" size="icon" title="Uredi podatke tima" onClick={()=>setEditingTeam(selectedTeam)}><Edit3/></Button>}</div></div>
        {selectedTeam&&<p className="meta">{selectedTeam.club||"Klub nije upisan"} · <MapPin/>{selectedTeam.defaultVenue||"Lokacija nije upisana"}</p>}
        <div className="section-label"><span>Utakmice</span><b>{teamMatches.length}</b></div><div className="match-list">{loading?<Empty>Učitavanje…</Empty>:teamMatches.length?teamMatches.map(m=><MatchRow key={m.id} match={m} venue={actualVenue(m,data.teams)} editable={canEdit(m)} onEdit={()=>setEditing(m)}/>):<Empty>Za ovaj tim nema utakmica.</Empty>}</div>
        {!!data.changes.filter(c=>c.competition===data.competitions.find(x=>x.id===competitionId)?.name).length&&<><div className="section-label"><span><Bell/> Nedavne promjene</span></div><div className="changes">{data.changes.filter(c=>c.competition===data.competitions.find(x=>x.id===competitionId)?.name).slice(0,5).map(c=><div key={c.id}><b>{c.home} — {c.away}</b><span>{formatDate(c.oldDate)} {c.oldTime} → {formatDate(c.newDate)} {c.newTime}</span></div>)}</div></>}
      </section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow"><MapPin/> Zauzetost lokacije · sve lige</span><h2>{selectedVenue?.name??"Nema lokacija"}</h2></div><NativeSelect value={venueId} onChange={e=>setVenueId(e.target.value)}>{data.venues.slice().sort((a,b)=>Number(b.mine)-Number(a.mine)||a.name.localeCompare(b.name)).map(v=><NativeSelectOption key={v.id} value={v.id}>{v.mine?"★ ":""}{v.name}</NativeSelectOption>)}</NativeSelect></div>
        {selectedVenue&&<p className="meta"><MapPin/>{selectedVenue.address}{selectedVenue.mine&&<b className="mine">MOJE MJESTO</b>}</p>}
        <div className={`today ${todayMatches.length?"busy":"free"}`}><div><small>Danas</small><Status busy={todayMatches.length>0}/></div><div>{todayMatches.length?todayMatches.map(m=><span key={m.id}>{m.time||"—"} · {m.home} — {m.away}<small>{m.competition}</small></span>):<span>Nema utakmica na ovoj lokaciji.</span>}</div></div>
        <div className="section-label"><span>Sljedećih 7 dana</span></div><div className="week">{days.map(day=><div className="day" key={day.key}><div><b>{new Intl.DateTimeFormat("hr-HR",{weekday:"short"}).format(day.d)}</b><span>{formatDate(day.key)}</span></div><Status busy={day.matches.length>0}/><div>{day.matches.length?day.matches.map(m=><span key={m.id}>{m.time||"—"} · {m.home} — {m.away}<small>{m.competition}</small></span>):"—"}</div></div>)}</div>
      </section>
    </div>
    <LoginDialog open={loginOpen} onClose={()=>setLoginOpen(false)} onNotice={setNotice}/>
    <SettingsDialog open={settingsOpen} onClose={()=>setSettingsOpen(false)} competitions={data.competitions} teams={data.teams} competitionId={competitionId} teamId={teamId} onCompetition={selectCompetition} onTeam={selectTeam}/>
    <EditMatchDialog match={editing} venues={data.venues} onClose={()=>setEditing(null)} onSaved={async()=>{setEditing(null);setNotice("Termin je izmijenjen i promjena je vidljiva svima.");await loadData();}} onNotice={setNotice}/>
    <EditTeamDialog team={editingTeam} venues={data.venues} onClose={()=>setEditingTeam(null)} onSaved={async()=>{setEditingTeam(null);setNotice("Podaci tima su spremljeni.");await loadData();}} onNotice={setNotice}/>
    <CaptainsDialog open={captainsOpen} onClose={()=>setCaptainsOpen(false)} teams={data.teams} onNotice={setNotice}/>
  </main>;
}

function MatchRow({match,venue,editable,onEdit}:{match:Match;venue:string;editable:boolean;onEdit:()=>void}){return <article className="match"><div className="when"><b>{formatDate(match.date)}</b><span>{match.time||"—"}</span></div><div><b>{match.home}</b><span> — </span><b>{match.away}</b><small><MapPin/>{venue||"Lokacija nije određena"}</small></div><em>{[match.competition,match.round].filter(Boolean).join(" · ")}</em>{editable&&<Button variant="ghost" size="icon" title="Izmijeni utakmicu" onClick={onEdit}><Edit3/></Button>}</article>}
function Empty({children}:{children:React.ReactNode}){return <div className="empty">{children}</div>}

function LoginDialog({open,onClose,onNotice}:{open:boolean;onClose:()=>void;onNotice:(s:string)=>void}){
  const[email,setEmail]=useState("");async function send(){if(!supabase)return;const{error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});onNotice(error?error.message:"Poveznica za prijavu poslana je na e-mail.");if(!error)onClose();}
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Prijava kapetana ili administratora</DialogTitle><DialogDescription>Na odobrenu adresu stiže jednokratna poveznica.</DialogDescription></DialogHeader><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ime@primjer.hr"/><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={()=>void send()}>Pošalji poveznicu</Button></DialogFooter></DialogContent></Dialog>;
}
function SettingsDialog({open,onClose,competitions,teams,competitionId,teamId,onCompetition,onTeam}:{open:boolean;onClose:()=>void;competitions:Competition[];teams:Team[];competitionId:string;teamId:string;onCompetition:(v:string)=>void;onTeam:(v:string)=>void}){
  const filtered=teams.filter(t=>t.competitionIds.includes(competitionId));return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Moj početni prikaz</DialogTitle><DialogDescription>Odabir se pamti na ovom uređaju i otvara se pri sljedećem posjetu.</DialogDescription></DialogHeader><div className="form-grid"><label>Liga<NativeSelect value={competitionId} onChange={e=>onCompetition(e.target.value)}>{competitions.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></label><label>Tim<NativeSelect value={teamId} onChange={e=>onTeam(e.target.value)}>{filtered.map(t=><NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}</NativeSelect></label></div><DialogFooter><Button onClick={onClose}>Gotovo</Button></DialogFooter></DialogContent></Dialog>;
}
function EditMatchDialog({match,venues,onClose,onSaved,onNotice}:{match:Match|null;venues:Venue[];onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void}){
  const[date,setDate]=useState("");const[time,setTime]=useState("");const[venueId,setVenueId]=useState("");
  useEffect(()=>{setDate(match?.date??"");setTime(match?.time??"");setVenueId(match?.venueId??"");},[match]);
  async function save(){if(!supabase||!match)return;const{error}=await supabase.from("matches").update({match_date:date,match_time:time||null,venue_id:venueId||null}).eq("id",match.id);if(error)onNotice(`Izmjena nije spremljena: ${error.message}`);else onSaved();}
  return <Dialog open={!!match} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Izmijeni utakmicu</DialogTitle><DialogDescription>{match?.home} — {match?.away}. Promjenu će vidjeti svi pratitelji lige i lokacije.</DialogDescription></DialogHeader><div className="form-grid"><label>Datum<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Vrijeme<Input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label className="wide">Lokacija<NativeSelect value={venueId} onChange={e=>setVenueId(e.target.value)}><NativeSelectOption value="">Zadana lokacija domaćina</NativeSelectOption>{venues.map(v=><NativeSelectOption key={v.id} value={v.id}>{v.name}</NativeSelectOption>)}</NativeSelect></label></div><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={()=>void save()}>Spremi za sve</Button></DialogFooter></DialogContent></Dialog>;
}
function EditTeamDialog({team,venues,onClose,onSaved,onNotice}:{team:Team|null;venues:Venue[];onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void}){
  const[form,setForm]=useState({club:"",venueId:"",contact:"",phone:"",email:"",note:""});
  useEffect(()=>{setForm({club:team?.club??"",venueId:team?.defaultVenueId??"",contact:team?.contact??"",phone:team?.phone??"",email:team?.email??"",note:team?.note??""});},[team]);
  async function save(){if(!supabase||!team)return;const{error}=await supabase.from("teams").update({club_name:form.club,default_venue_id:form.venueId||null,contact_name:form.contact,phone:form.phone,email:form.email,note:form.note}).eq("id",team.id);if(error)onNotice(`Podaci nisu spremljeni: ${error.message}`);else onSaved();}
  return <Dialog open={!!team} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Uredi tim · {team?.name}</DialogTitle><DialogDescription>Kapetan može održavati kontakt i zadanu domaću lokaciju svojeg tima.</DialogDescription></DialogHeader><div className="form-grid"><label>Klub<Input value={form.club} onChange={e=>setForm({...form,club:e.target.value})}/></label><label>Kontakt osoba<Input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></label><label>Telefon<Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>E-mail<Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className="wide">Zadana domaća lokacija<NativeSelect value={form.venueId} onChange={e=>setForm({...form,venueId:e.target.value})}><NativeSelectOption value="">Nije određena</NativeSelectOption>{venues.map(v=><NativeSelectOption key={v.id} value={v.id}>{v.name}</NativeSelectOption>)}</NativeSelect></label><label className="wide">Napomena<Input value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={()=>void save()}>Spremi</Button></DialogFooter></DialogContent></Dialog>;
}
function CaptainsDialog({open,onClose,teams,onNotice}:{open:boolean;onClose:()=>void;teams:Team[];onNotice:(s:string)=>void}){
  const[email,setEmail]=useState("");const[teamId,setTeamId]=useState("");const[captains,setCaptains]=useState<Captain[]>([]);const[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{if(!supabase)return;const r=await supabase.from("team_editors").select("team_id,email,app_users(user_id)");if(r.error){onNotice(r.error.message);return;}setCaptains((r.data??[]).map((x:any)=>({team_id:x.team_id,email:x.email,user_id:x.app_users?.user_id??null,team_name:teams.find(t=>t.id===x.team_id)?.name??"Nepoznat tim"})));},[teams,onNotice]);
  useEffect(()=>{if(open){setTeamId(teams[0]?.id??"");void load();}},[open,teams,load]);
  async function add(){if(!supabase||!email||!teamId)return;setBusy(true);const normalized=email.trim().toLowerCase();const u=await supabase.from("app_users").upsert({email:normalized,role:"captain"},{onConflict:"email"});if(u.error){onNotice(u.error.message);setBusy(false);return;}const a=await supabase.from("team_editors").insert({team_id:teamId,email:normalized});if(a.error){onNotice(a.error.message);setBusy(false);return;}const mail=await supabase.auth.signInWithOtp({email:normalized,options:{emailRedirectTo:window.location.origin+window.location.pathname}});onNotice(mail.error?`Kapetan je dodan, ali poruka nije poslana: ${mail.error.message}`:`Poziv za kapetana poslan je na ${normalized}.`);setEmail("");await load();setBusy(false);}
  async function remove(c:Captain){if(!supabase)return;const r=await supabase.from("team_editors").delete().eq("team_id",c.team_id).eq("email",c.email);if(r.error)onNotice(r.error.message);else{onNotice("Ovlasti kapetana su uklonjene.");await load();}}
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Kapetani timova</DialogTitle><DialogDescription>Najviše dva kapetana po timu. Mogu mijenjati samo utakmice svojeg tima.</DialogDescription></DialogHeader><div className="captain-add"><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="kapetan@primjer.hr"/><NativeSelect value={teamId} onChange={e=>setTeamId(e.target.value)}>{teams.map(t=><NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}</NativeSelect><Button disabled={busy||!email||!teamId} className="red-button" onClick={()=>void add()}><ShieldCheck/> Dodaj</Button></div><div className="user-list">{captains.map(c=><div className="managed-user" key={`${c.team_id}-${c.email}`}><div><b>{c.email}</b><span>{c.team_name} · {c.user_id?"POTVRĐEN":"ČEKA PRIJAVU"}</span></div><Button variant="ghost" onClick={()=>void remove(c)}>Ukloni</Button></div>)}</div><DialogFooter><Button variant="outline" onClick={onClose}>Zatvori</Button></DialogFooter></DialogContent></Dialog>;
}
