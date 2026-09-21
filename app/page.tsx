"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Download, Edit3, LogIn, LogOut, MapPin, Settings, ShieldCheck, Upload, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { actualVenue, dateKey, formatDate, normalizeHeader, seedData, type Club, type Competition, type Match, type SchedulerData, type Team, type Venue } from "@/lib/darts-data";

type AppRole = "viewer" | "captain" | "club_manager" | "admin";
type Captain = { email: string; user_id: string | null; team_id: string; team_name: string };
type ClubManager = { email: string; user_id: string | null; club_id: string; club_name: string };
type ExcelImportRow = { row:number; id:string; season:string; league:string; date:string; time:string; home:string; away:string; round:string; venue:string; note:string; error:string };
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
  const [managedClubIds, setManagedClubIds] = useState<string[]>([]);
  const [sessionEmail, setSessionEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captainsOpen, setCaptainsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [occupancyOpen, setOccupancyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const admin = role === "admin";
  const editor = role !== "viewer";

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [seasonsR, competitionsR, venuesR, teamsR, membershipR, matchesR, changesR, clubsR, clubVenuesR] = await Promise.all([
      supabase.from("seasons").select("*").order("name", { ascending: false }),
      supabase.from("competitions").select("*").order("name"),
      supabase.from("venues").select("*").order("name"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("competition_teams").select("competition_id,team_id"),
      supabase.from("matches").select("*").order("match_date").order("match_time"),
      supabase.from("schedule_changes").select("*").order("changed_at", { ascending: false }).limit(30),
      supabase.from("clubs").select("*").order("name"),
      supabase.from("club_venues").select("club_id,venue_id"),
    ]);
    const missing = seasonsR.error || competitionsR.error || membershipR.error || changesR.error || clubsR.error || clubVenuesR.error;
    if (missing) {
      setNotice("Baza još nije nadograđena na v3. Admin treba pokrenuti supabase/upgrade_v3_club_managers.sql.");
      setLoading(false); return;
    }
    const error = venuesR.error || teamsR.error || matchesR.error;
    if (error) { setNotice(`Podaci se ne mogu učitati: ${error.message}`); setLoading(false); return; }
    const venues: Venue[] = (venuesR.data ?? []).map(v => ({ id:v.id,name:v.name,address:v.address,mine:v.is_featured,contact:v.contact_name,phone:v.phone,email:v.email,map:v.map_url,note:v.note }));
    const venueNames = new Map(venues.map(v => [v.id,v.name]));
    const clubVenueRows = clubVenuesR.data ?? [];
    const clubs: Club[] = (clubsR.data ?? []).map(c => ({ id:c.id,name:c.name,contact:c.contact_name,phone:c.phone,email:c.email,note:c.note,venueIds:clubVenueRows.filter(x=>x.club_id===c.id).map(x=>x.venue_id) }));
    const clubNames = new Map(clubs.map(c => [c.id,c.name]));
    const memberships = membershipR.data ?? [];
    const teams: Team[] = (teamsR.data ?? []).map(t => ({ id:t.id,name:t.name,clubId:t.club_id??"",club:clubNames.get(t.club_id)??t.club_name,defaultVenueId:t.default_venue_id ?? "",defaultVenue:venueNames.get(t.default_venue_id) ?? "",contact:t.contact_name,phone:t.phone,email:t.email,note:t.note,competitionIds:memberships.filter(m=>m.team_id===t.id).map(m=>m.competition_id) }));
    const teamNames = new Map(teams.map(t => [t.id,t.name]));
    const competitions: Competition[] = (competitionsR.data ?? []).map(c => ({ id:c.id,seasonId:c.season_id,name:c.name,externalId:c.external_id }));
    const competitionNames = new Map(competitions.map(c => [c.id,c.name]));
    const matches: Match[] = (matchesR.data ?? []).map(m => ({ id:m.id,date:m.match_date,time:String(m.match_time ?? "").slice(0,5),homeId:m.home_team_id,awayId:m.away_team_id,home:teamNames.get(m.home_team_id) ?? "Nepoznata ekipa",away:teamNames.get(m.away_team_id) ?? "Nepoznata ekipa",venueId:m.venue_id ?? "",venue:venueNames.get(m.venue_id) ?? "",competitionId:m.competition_id ?? "",competition:competitionNames.get(m.competition_id) ?? m.league ?? "",round:m.round_name,note:m.note,externalEventId:m.external_event_id??"" }));
    const matchMap = new Map(matches.map(m => [m.id,m]));
    const changes = (changesR.data ?? []).map(c => { const m=matchMap.get(c.match_id); return { id:c.id,matchId:c.match_id,changedAt:c.changed_at,changedBy:c.changed_by,oldDate:c.old_date,newDate:c.new_date,oldTime:String(c.old_time??"").slice(0,5),newTime:String(c.new_time??"").slice(0,5),competition:m?.competition??"",home:m?.home??"",away:m?.away??"" }; });
    setData({ seasons:(seasonsR.data??[]).map(s=>({id:s.id,name:s.name,active:s.is_active})),competitions,clubs,venues,teams,matches,changes });
    setLoading(false);
  }, []);

  const syncAuth = useCallback(async (session: { user: { email?: string } } | null) => {
    if (!supabase) return;
    setSessionEmail(session?.user.email ?? "");
    if (!session) { setRole("viewer"); setEditableTeams([]); setManagedClubIds([]); return; }
    const roleR = await supabase.rpc("current_app_role");
    if (roleR.error) { setRole("viewer"); setNotice("Prijavljeni ste, ali prava nisu aktivna. Pokrenite upgrade_v2.sql u Supabaseu."); return; }
    const email = session.user.email ?? "";
    const [teamsR,clubsR]=await Promise.all([
      supabase.from("team_editors").select("team_id").ilike("email",email),
      supabase.from("club_managers").select("club_id").ilike("email",email),
    ]);
    if(clubsR.error){setNotice("Prava voditelja kluba nisu dostupna. Pokrenite upgrade_v3_club_managers.sql u Supabaseu.");}
    const teamIds=(teamsR.data??[]).map(x=>x.team_id);const clubIds=(clubsR.data??[]).map(x=>x.club_id);
    setEditableTeams(teamIds);setManagedClubIds(clubIds);
    setRole(roleR.data==="admin"?"admin":clubIds.length?"club_manager":teamIds.length||roleR.data==="captain"?"captain":"viewer");
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
  const occupancyDays=Array.from({length:30},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i);const key=dateKey(d);return{key,d,matches:venueMatches.filter(m=>m.date===key)}});
  const canEditTeam=(t?:Team)=>!!t&&(admin||editableTeams.includes(t.id)||managedClubIds.includes(t.clubId));
  const canEdit=(m:Match)=>canEditTeam(data.teams.find(t=>t.id===m.homeId))||canEditTeam(data.teams.find(t=>t.id===m.awayId));
  const canEditSelectedVenue=!!selectedVenue&&(admin||data.clubs.some(c=>managedClubIds.includes(c.id)&&c.venueIds.includes(selectedVenue.id)));
  const watchedTeams=useMemo(()=>{
    if(managedClubIds.length)return data.teams.filter(t=>managedClubIds.includes(t.clubId));
    if(editableTeams.length)return data.teams.filter(t=>editableTeams.includes(t.id));
    if(admin&&selectedTeam?.clubId)return data.teams.filter(t=>t.clubId===selectedTeam.clubId);
    return selectedTeam?[selectedTeam]:[];
  },[data.teams,managedClubIds,editableTeams,admin,selectedTeam]);
  const weekEnd=days.at(-1)?.key??today;
  const weeklyRows=watchedTeams.map(team=>({team,match:data.matches.filter(m=>(m.homeId===team.id||m.awayId===team.id)&&m.date>=today&&m.date<=weekEnd).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))[0]}));
  function selectCompetition(id:string){setCompetitionId(id);localStorage.setItem(prefLeague,id);const first=data.teams.find(t=>t.competitionIds.includes(id));if(first){setTeamId(first.id);localStorage.setItem(prefTeam,first.id);}}
  function selectTeam(id:string){setTeamId(id);localStorage.setItem(prefTeam,id);}
  async function exportExcel(){
    if(!selectedTeam)return;const XLSX=await import("xlsx");const competition=data.competitions.find(c=>c.id===competitionId);const season=data.seasons.find(s=>s.id===competition?.seasonId)?.name??"";
    const rows=teamMatches.map(m=>({ID:m.externalEventId||m.id,Sezona:season,Liga:m.competition,Datum:new Date(`${m.date}T12:00:00`),Vrijeme:m.time,Domaćin:m.home,Gost:m.away,Kolo:m.round,Lokacija:actualVenue(m,data.teams),Napomena:m.note}));
    const ws=XLSX.utils.json_to_sheet(rows,{header:["ID","Sezona","Liga","Datum","Vrijeme","Domaćin","Gost","Kolo","Lokacija","Napomena"],cellDates:true});ws["!cols"]=[{wch:22},{wch:12},{wch:22},{wch:12},{wch:10},{wch:28},{wch:28},{wch:12},{wch:28},{wch:30}];
    const teamRows=leagueTeams.map(t=>({Tim:t.name,Klub:t.club,"Domaća lokacija":t.defaultVenue,Kontakt:t.contact,Telefon:t.phone,"E-mail":t.email,Napomena:t.note}));const tws=XLSX.utils.json_to_sheet(teamRows);tws["!cols"]=[{wch:28},{wch:22},{wch:28},{wch:24},{wch:18},{wch:28},{wch:30}];
    const vws=XLSX.utils.json_to_sheet(data.venues.map(v=>({Lokacija:v.name,Adresa:v.address,Kontakt:v.contact,Telefon:v.phone,"E-mail":v.email,"Google Maps":v.map,Napomena:v.note})));vws["!cols"]=[{wch:28},{wch:34},{wch:24},{wch:18},{wch:28},{wch:38},{wch:30}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Utakmice");XLSX.utils.book_append_sheet(wb,tws,"Timovi");XLSX.utils.book_append_sheet(wb,vws,"Lokacije");XLSX.writeFile(wb,`DartsScheduler_${selectedTeam.name.replace(/[^a-z0-9]+/gi,"_")}_${season.replace(/[^0-9]+/g,"-")}.xlsx`);
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span>DS</span><div><strong>DartsScheduler</strong><small>raspored ekipa i lokacija</small></div></div><div className="top-actions">
      {editor&&<Button variant="ghost" onClick={()=>setImportOpen(true)}><Upload/> Uvezi Excel</Button>}
      {editor&&<Button variant="ghost" onClick={()=>void exportExcel()}><Download/> Izvezi Excel</Button>}
      <Button variant="ghost" onClick={()=>setSettingsOpen(true)}><Settings/> Postavke</Button>
      {admin&&<Button variant="outline" onClick={()=>setCaptainsOpen(true)}><UserCog/> Ovlasti</Button>}
      {sessionEmail?<Button variant="ghost" onClick={()=>supabase?.auth.signOut()}><LogOut/> Odjava</Button>:<Button variant="ghost" onClick={()=>setLoginOpen(true)}><LogIn/> Prijava</Button>}
    </div></header>
    {notice&&<button className="notice" onClick={()=>setNotice("")}>{notice}</button>}
    {!supabaseConfigured&&<div className="setup-note">Demo prikaz — Supabase još nije povezan.</div>}
    <section className="panel location-status-panel"><div className="location-status-head"><div><span className="eyebrow"><MapPin/> Status lokacije · sve lige</span><h2>{selectedVenue?.name??"Nema lokacija"}</h2></div><div className="panel-tools"><NativeSelect value={venueId} onChange={e=>setVenueId(e.target.value)}>{data.venues.slice().sort((a,b)=>Number(b.mine)-Number(a.mine)||a.name.localeCompare(b.name)).map(v=><NativeSelectOption key={v.id} value={v.id}>{v.mine?"★ ":""}{v.name}</NativeSelectOption>)}</NativeSelect>{canEditSelectedVenue&&<Button variant="ghost" size="icon" title="Uredi lokaciju" onClick={()=>setEditingVenue(selectedVenue!)}><Edit3/></Button>}</div></div>{selectedVenue&&<p className="meta"><MapPin/>{selectedVenue.address}{selectedVenue.mine&&<b className="mine">MOJE MJESTO</b>}</p>}<button className={`today status-trigger ${todayMatches.length?"busy":"free"}`} onClick={()=>setOccupancyOpen(true)}><div><small>Danas</small><Status busy={todayMatches.length>0}/></div><div>{todayMatches.length?todayMatches.map(m=><span key={m.id}>{m.time||"—"} · {m.home} — {m.away}<small>{m.competition}</small></span>):<span>Nema utakmica na ovoj lokaciji.</span>}<small>Dodirni za pregled sljedećih 30 dana</small></div></button></section>
    <div className="filters compact-filters"><label>Liga<NativeSelect value={competitionId} onChange={e=>selectCompetition(e.target.value)}>{data.competitions.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></label><label>Tim<NativeSelect value={teamId} onChange={e=>selectTeam(e.target.value)}>{leagueTeams.map(t=><NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}</NativeSelect></label></div>
    <section className="panel weekly-panel"><div className="panel-head"><div><span className="eyebrow"><Users/> Ovaj tjedan</span><h1>{watchedTeams.length>1?`${watchedTeams.length} mojih timova`:selectedTeam?.name??"Raspored ekipe"}</h1></div><div className="panel-tools"><span className="role-pill">{admin?"ADMIN":role==="club_manager"?"VODITELJ KLUBA":role==="captain"?"KAPETAN":"PREGLED"}</span>{canEditTeam(selectedTeam)&&<Button variant="ghost" size="icon" title="Uredi podatke tima" onClick={()=>setEditingTeam(selectedTeam!)}><Edit3/></Button>}<Button variant="outline" onClick={()=>setScheduleOpen(true)}><CalendarDays/> Raspored</Button></div></div>
      <div className="weekly-team-list">{loading?<Empty>Učitavanje…</Empty>:weeklyRows.map(({team,match})=><button key={team.id} className={`weekly-team-row ${team.id===teamId?"selected":""}`} onClick={()=>{const league=team.competitionIds[0];if(league){setCompetitionId(league);localStorage.setItem(prefLeague,league);}selectTeam(team.id);}}><strong>{team.name}</strong>{match?<><span>{formatDate(match.date)} · {match.time||"—"}</span><span>{match.home} — {match.away}</span><em>{match.competition}</em></>:<span className="no-game">Nema utakmice sljedećih 7 dana</span>}</button>)}</div>
      {!!data.changes.filter(c=>c.competition===data.competitions.find(x=>x.id===competitionId)?.name).length&&<><div className="section-label"><span><Bell/> Nedavne promjene</span></div><div className="changes">{data.changes.filter(c=>c.competition===data.competitions.find(x=>x.id===competitionId)?.name).slice(0,3).map(c=><div key={c.id}><b>{c.home} — {c.away}</b><span>{formatDate(c.oldDate)} {c.oldTime} → {formatDate(c.newDate)} {c.newTime}</span></div>)}</div></>}
    </section>
    <LoginDialog open={loginOpen} onClose={()=>setLoginOpen(false)} onNotice={setNotice}/>
    <SettingsDialog open={settingsOpen} onClose={()=>setSettingsOpen(false)} seasons={data.seasons} competitions={data.competitions} teams={data.teams} competitionId={competitionId} teamId={teamId} onCompetition={selectCompetition} onTeam={selectTeam}/>
    <ScheduleDialog open={scheduleOpen} onClose={()=>setScheduleOpen(false)} team={selectedTeam} matches={teamMatches} teams={data.teams} canEdit={canEdit} onEdit={m=>setEditing(m)}/>
    <OccupancyDialog open={occupancyOpen} onClose={()=>setOccupancyOpen(false)} venue={selectedVenue} days={occupancyDays}/>
    <ImportDialog open={importOpen} onClose={()=>setImportOpen(false)} data={data} admin={admin} editableTeams={editableTeams} managedClubIds={managedClubIds} onSaved={async n=>{setImportOpen(false);setNotice(`Uvezeno je ${n} utakmica.`);await loadData();}} onNotice={setNotice}/>
    <EditMatchDialog match={editing} venues={data.venues} onClose={()=>setEditing(null)} onSaved={async()=>{setEditing(null);setNotice("Termin je izmijenjen i promjena je vidljiva svima.");await loadData();}} onNotice={setNotice}/>
    <EditTeamDialog team={editingTeam} venues={data.venues} clubs={data.clubs} admin={admin} onClose={()=>setEditingTeam(null)} onSaved={async()=>{setEditingTeam(null);setNotice("Podaci tima su spremljeni.");await loadData();}} onNotice={setNotice}/>
    <EditVenueDialog venue={editingVenue} onClose={()=>setEditingVenue(null)} onSaved={async()=>{setEditingVenue(null);setNotice("Podaci lokacije su spremljeni.");await loadData();}} onNotice={setNotice}/>
    <CaptainsDialog open={captainsOpen} onClose={()=>setCaptainsOpen(false)} teams={data.teams} clubs={data.clubs} onNotice={setNotice}/>
  </main>;
}

function MatchRow({match,venue,editable,onEdit}:{match:Match;venue:string;editable:boolean;onEdit:()=>void}){return <article className="match"><div className="when"><b>{formatDate(match.date)}</b><span>{match.time||"—"}</span></div><div><b>{match.home}</b><span> — </span><b>{match.away}</b><small><MapPin/>{venue||"Lokacija nije određena"}</small></div><em>{[match.competition,match.round].filter(Boolean).join(" · ")}</em>{editable&&<Button variant="ghost" size="icon" title="Izmijeni utakmicu" onClick={onEdit}><Edit3/></Button>}</article>}
function Empty({children}:{children:React.ReactNode}){return <div className="empty">{children}</div>}

function ScheduleDialog({open,onClose,team,matches,teams,canEdit,onEdit}:{open:boolean;onClose:()=>void;team:Team|undefined;matches:Match[];teams:Team[];canEdit:(m:Match)=>boolean;onEdit:(m:Match)=>void}){
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="schedule-dialog"><DialogHeader><DialogTitle>Raspored · {team?.name??"Tim"}</DialogTitle><DialogDescription>Cijeli raspored odabranog tima za sezonu.</DialogDescription></DialogHeader><div className="dialog-match-list">{matches.length?matches.map(m=><MatchRow key={m.id} match={m} venue={actualVenue(m,teams)} editable={canEdit(m)} onEdit={()=>onEdit(m)}/>):<Empty>Za ovaj tim nema utakmica.</Empty>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Zatvori</Button></DialogFooter></DialogContent></Dialog>;
}
function OccupancyDialog({open,onClose,venue,days}:{open:boolean;onClose:()=>void;venue:Venue|undefined;days:{key:string;d:Date;matches:Match[]}[]}){
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="schedule-dialog"><DialogHeader><DialogTitle>Zauzetost · {venue?.name??"Lokacija"}</DialogTitle><DialogDescription>Sljedećih 30 dana, objedinjeno iz svih liga.</DialogDescription></DialogHeader><div className="occupancy-list">{days.map(day=><div className="day" key={day.key}><div><b>{new Intl.DateTimeFormat("hr-HR",{weekday:"short"}).format(day.d)}</b><span>{formatDate(day.key)}</span></div><Status busy={day.matches.length>0}/><div>{day.matches.length?day.matches.map(m=><span key={m.id}>{m.time||"—"} · {m.home} — {m.away}<small>{m.competition}</small></span>):"—"}</div></div>)}</div><DialogFooter><Button variant="outline" onClick={onClose}>Zatvori</Button></DialogFooter></DialogContent></Dialog>;
}

function ImportDialog({open,onClose,data,admin,editableTeams,managedClubIds,onSaved,onNotice}:{open:boolean;onClose:()=>void;data:SchedulerData;admin:boolean;editableTeams:string[];managedClubIds:string[];onSaved:(n:number)=>void;onNotice:(s:string)=>void}){
  const[rows,setRows]=useState<ExcelImportRow[]>([]);const[fileName,setFileName]=useState("");const[busy,setBusy]=useState(false);const templateHref=`${process.env.NEXT_PUBLIC_BASE_PATH||""}/DartsScheduler_predlozak_2027_28.xlsx`;
  useEffect(()=>{if(!open){setRows([]);setFileName("");setBusy(false);}},[open]);
  const permitted=new Set([...editableTeams,...data.teams.filter(t=>managedClubIds.includes(t.clubId)).map(t=>t.id)]);
  function textValue(v:unknown){return String(v??"").trim();}
  function excelDate(v:unknown,XLSX:any){if(v instanceof Date&&!Number.isNaN(v.getTime()))return dateKey(v);if(typeof v==="number"){const p=XLSX.SSF.parse_date_code(v);if(p)return `${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`;}const s=textValue(v);let m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);if(m)return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:"";}
  function excelTime(v:unknown,XLSX:any){if(v instanceof Date)return `${String(v.getHours()).padStart(2,"0")}:${String(v.getMinutes()).padStart(2,"0")}`;if(typeof v==="number")return XLSX.SSF.format("hh:mm",v);const m=textValue(v).match(/(\d{1,2}):(\d{2})/);return m?`${m[1].padStart(2,"0")}:${m[2]}`:"";}
  async function readFile(file:File){const XLSX=await import("xlsx");const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});const sheet=wb.Sheets[wb.SheetNames.includes("Utakmice")?"Utakmice":wb.SheetNames[0]];const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:"",raw:true});const parsed=raw.map((source,index)=>{const normalized=new Map(Object.entries(source).map(([k,v])=>[normalizeHeader(k),v]));const get=(...keys:string[])=>keys.map(k=>normalized.get(normalizeHeader(k))).find(v=>v!==undefined&&v!=="")??"";const row:ExcelImportRow={row:index+2,id:textValue(get("ID","Identifikator")),season:textValue(get("Sezona","Season")),league:textValue(get("Liga","Natjecanje","League")),date:excelDate(get("Datum","Date"),XLSX),time:excelTime(get("Vrijeme","Time"),XLSX),home:textValue(get("Domaćin","Domacin","Doma","Home")),away:textValue(get("Gost","Away")),round:textValue(get("Kolo","Round")),venue:textValue(get("Lokacija","Mjesto","Venue")),note:textValue(get("Napomena","Note")),error:""};const errors:string[]=[];if(!row.season)errors.push("nedostaje sezona");if(!row.league)errors.push("nedostaje liga");if(!row.date)errors.push("neispravan datum");if(!row.home)errors.push("nedostaje domaćin");if(!row.away)errors.push("nedostaje gost");if(row.home&&row.away&&normalizeHeader(row.home)===normalizeHeader(row.away))errors.push("domaćin i gost su isti");if(!admin){const season=data.seasons.find(s=>normalizeHeader(s.name)===normalizeHeader(row.season));const competition=data.competitions.find(c=>c.seasonId===season?.id&&normalizeHeader(c.name)===normalizeHeader(row.league));const home=data.teams.find(t=>normalizeHeader(t.name)===normalizeHeader(row.home));const away=data.teams.find(t=>normalizeHeader(t.name)===normalizeHeader(row.away));if(!competition)errors.push("liga/sezona ne postoji");if(!home||!away)errors.push("tim ne postoji");else if(!permitted.has(home.id)&&!permitted.has(away.id))errors.push("nemaš ovlasti za ovu utakmicu");if(row.venue&&!data.venues.some(v=>normalizeHeader(v.name)===normalizeHeader(row.venue)))errors.push("lokacija ne postoji");}row.error=errors.join(", ");return row;});setRows(parsed);setFileName(file.name);}
  async function importRows(){if(!supabase||!rows.length||rows.some(r=>r.error))return;setBusy(true);let count=0;const seasons=new Map(data.seasons.map(s=>[normalizeHeader(s.name),s.id]));const competitions=new Map(data.competitions.map(c=>[`${c.seasonId}|${normalizeHeader(c.name)}`,c.id]));const teams=new Map(data.teams.map(t=>[normalizeHeader(t.name),t.id]));const venues=new Map(data.venues.map(v=>[normalizeHeader(v.name),v.id]));const slug=(s:string)=>normalizeHeader(s).replaceAll(" ","-").slice(0,60);
    for(const row of rows){let seasonId=seasons.get(normalizeHeader(row.season));if(!seasonId&&admin){const r=await supabase.from("seasons").insert({name:row.season,is_active:false}).select("id").single();if(r.error){onNotice(`Red ${row.row}: ${r.error.message}`);setBusy(false);return;}seasonId=r.data.id as string;seasons.set(normalizeHeader(row.season),seasonId);}if(!seasonId)continue;let competitionId=competitions.get(`${seasonId}|${normalizeHeader(row.league)}`);if(!competitionId&&admin){const r=await supabase.from("competitions").insert({season_id:seasonId,name:row.league,external_id:`excel-${slug(row.league)}`}).select("id").single();if(r.error){onNotice(`Red ${row.row}: ${r.error.message}`);setBusy(false);return;}competitionId=r.data.id as string;competitions.set(`${seasonId}|${normalizeHeader(row.league)}`,competitionId);}if(!competitionId)continue;
      async function ensureTeam(name:string){let id=teams.get(normalizeHeader(name));if(!id&&admin){const r=await supabase!.from("teams").insert({name}).select("id").single();if(r.error)throw r.error;id=r.data.id as string;teams.set(normalizeHeader(name),id);}return id;}
      let homeId:string|undefined,awayId:string|undefined;try{homeId=await ensureTeam(row.home);awayId=await ensureTeam(row.away);}catch(e:any){onNotice(`Red ${row.row}: ${e.message}`);setBusy(false);return;}if(!homeId||!awayId)continue;let venueId=row.venue?venues.get(normalizeHeader(row.venue)):undefined;if(row.venue&&!venueId&&admin){const r=await supabase.from("venues").insert({name:row.venue}).select("id").single();if(r.error){onNotice(`Red ${row.row}: ${r.error.message}`);setBusy(false);return;}venueId=r.data.id as string;venues.set(normalizeHeader(row.venue),venueId);}if(admin){const memberships=await supabase.from("competition_teams").upsert([{competition_id:competitionId,team_id:homeId},{competition_id:competitionId,team_id:awayId}],{onConflict:"competition_id,team_id",ignoreDuplicates:true});if(memberships.error){onNotice(`Red ${row.row}: ${memberships.error.message}`);setBusy(false);return;}}
      const external=row.id||`excel:${slug(row.season)}:${slug(row.league)}:${slug(row.round||row.date)}:${slug(row.home)}:${slug(row.away)}`;const payload={match_date:row.date,match_time:row.time||null,home_team_id:homeId,away_team_id:awayId,venue_id:venueId||null,competition_id:competitionId,external_event_id:external,league:row.league,round_name:row.round,note:row.note};const existing=await supabase.from("matches").select("id").eq("competition_id",competitionId).eq("external_event_id",external).maybeSingle();const saved=existing.data?.id?await supabase.from("matches").update(payload).eq("id",existing.data.id):await supabase.from("matches").insert(payload);if(saved.error){onNotice(`Red ${row.row}: ${saved.error.message}`);setBusy(false);return;}count++;
    }setBusy(false);onSaved(count);
  }
  const errors=rows.filter(r=>r.error);return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="import-dialog"><DialogHeader><DialogTitle>Uvezi Excel ili CSV</DialogTitle><DialogDescription>Uvoze se podaci iz lista „Utakmice“. Prvo provjeri pregled; promjene postaju vidljive svima.</DialogDescription></DialogHeader><div className="import-actions"><Input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const f=e.target.files?.[0];if(f)void readFile(f);}}/><a className="template-link" href={templateHref} download>Preuzmi predložak 2027./28.</a></div>{fileName&&<div className={`import-summary ${errors.length?"has-errors":"ready"}`}><b>{fileName}</b><span>{rows.length} redaka · {errors.length?`${errors.length} s greškom`:"spremno za uvoz"}</span></div>}<div className="import-preview">{rows.slice(0,12).map(r=><div key={r.row} className={r.error?"bad":""}><b>Red {r.row}</b><span>{r.date} {r.time} · {r.home} — {r.away}</span><small>{r.error||`${r.season} · ${r.league} · ${r.round}`}</small></div>)}{rows.length>12&&<p>…i još {rows.length-12} redaka</p>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" disabled={busy||!rows.length||!!errors.length} onClick={()=>void importRows()}><Upload/> {busy?"Uvozim…":"Uvezi"}</Button></DialogFooter></DialogContent></Dialog>;
}

function LoginDialog({open,onClose,onNotice}:{open:boolean;onClose:()=>void;onNotice:(s:string)=>void}){
  const[email,setEmail]=useState("");async function send(){if(!supabase)return;const{error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});onNotice(error?error.message:"Poveznica za prijavu poslana je na e-mail.");if(!error)onClose();}
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Prijava kapetana ili administratora</DialogTitle><DialogDescription>Na odobrenu adresu stiže jednokratna poveznica.</DialogDescription></DialogHeader><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ime@primjer.hr"/><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={()=>void send()}>Pošalji poveznicu</Button></DialogFooter></DialogContent></Dialog>;
}
function SettingsDialog({open,onClose,seasons,competitions,teams,competitionId,teamId,onCompetition,onTeam}:{open:boolean;onClose:()=>void;seasons:{id:string;name:string;active:boolean}[];competitions:Competition[];teams:Team[];competitionId:string;teamId:string;onCompetition:(v:string)=>void;onTeam:(v:string)=>void}){
  const filtered=teams.filter(t=>t.competitionIds.includes(competitionId));const seasonId=competitions.find(c=>c.id===competitionId)?.seasonId??seasons[0]?.id??"";return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Moj početni prikaz</DialogTitle><DialogDescription>Odabir se pamti na ovom uređaju i otvara se pri sljedećem posjetu.</DialogDescription></DialogHeader><div className="form-grid"><label>Sezona<NativeSelect value={seasonId} disabled>{seasons.map(s=><NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}</NativeSelect></label><label>Liga<NativeSelect value={competitionId} onChange={e=>onCompetition(e.target.value)}>{competitions.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></label><label className="wide">Tim<NativeSelect value={teamId} onChange={e=>onTeam(e.target.value)}>{filtered.map(t=><NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}</NativeSelect></label></div><DialogFooter><Button onClick={onClose}>Gotovo</Button></DialogFooter></DialogContent></Dialog>;
}
function EditMatchDialog({match,venues,onClose,onSaved,onNotice}:{match:Match|null;venues:Venue[];onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void}){
  const[date,setDate]=useState("");const[time,setTime]=useState("");const[venueId,setVenueId]=useState("");
  useEffect(()=>{setDate(match?.date??"");setTime(match?.time??"");setVenueId(match?.venueId??"");},[match]);
  async function save(){if(!supabase||!match)return;const{error}=await supabase.from("matches").update({match_date:date,match_time:time||null,venue_id:venueId||null}).eq("id",match.id);if(error)onNotice(`Izmjena nije spremljena: ${error.message}`);else onSaved();}
  return <Dialog open={!!match} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Izmijeni utakmicu</DialogTitle><DialogDescription>{match?.home} — {match?.away}. Promjenu će vidjeti svi pratitelji lige i lokacije.</DialogDescription></DialogHeader><div className="form-grid"><label>Datum<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Vrijeme<Input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label className="wide">Lokacija<NativeSelect value={venueId} onChange={e=>setVenueId(e.target.value)}><NativeSelectOption value="">Zadana lokacija domaćina</NativeSelectOption>{venues.map(v=><NativeSelectOption key={v.id} value={v.id}>{v.name}</NativeSelectOption>)}</NativeSelect></label></div><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={()=>void save()}>Spremi za sve</Button></DialogFooter></DialogContent></Dialog>;
}
function EditTeamDialog({team,venues,clubs,admin,onClose,onSaved,onNotice}:{team:Team|null;venues:Venue[];clubs:Club[];admin:boolean;onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void}){
  const[form,setForm]=useState({clubId:"",venueId:"",contact:"",phone:"",email:"",note:""});
  useEffect(()=>{setForm({clubId:team?.clubId??"",venueId:team?.defaultVenueId??"",contact:team?.contact??"",phone:team?.phone??"",email:team?.email??"",note:team?.note??""});},[team]);
  async function save(){if(!supabase||!team)return;const club=clubs.find(c=>c.id===form.clubId);const{error}=await supabase.from("teams").update({club_id:form.clubId||null,club_name:club?.name??team.club,default_venue_id:form.venueId||null,contact_name:form.contact,phone:form.phone,email:form.email,note:form.note}).eq("id",team.id);if(error)onNotice(`Podaci nisu spremljeni: ${error.message}`);else onSaved();}
  return <Dialog open={!!team} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Uredi tim · {team?.name}</DialogTitle><DialogDescription>Kapetan ili voditelj kluba može održavati kontakt i domaću lokaciju. Samo admin može premjestiti tim u drugi klub.</DialogDescription></DialogHeader><div className="form-grid"><label>Klub<NativeSelect disabled={!admin} value={form.clubId} onChange={e=>setForm({...form,clubId:e.target.value})}><NativeSelectOption value="">Nije određen</NativeSelectOption>{clubs.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></label><label>Kontakt osoba<Input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></label><label>Telefon<Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>E-mail<Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className="wide">Zadana domaća lokacija<NativeSelect value={form.venueId} onChange={e=>setForm({...form,venueId:e.target.value})}><NativeSelectOption value="">Nije određena</NativeSelectOption>{venues.map(v=><NativeSelectOption key={v.id} value={v.id}>{v.name}</NativeSelectOption>)}</NativeSelect></label><label className="wide">Napomena<Input value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={()=>void save()}>Spremi</Button></DialogFooter></DialogContent></Dialog>;
}
function EditVenueDialog({venue,onClose,onSaved,onNotice}:{venue:Venue|null;onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void}){
  const[form,setForm]=useState({address:"",contact:"",phone:"",email:"",map:"",note:""});
  useEffect(()=>{setForm({address:venue?.address??"",contact:venue?.contact??"",phone:venue?.phone??"",email:venue?.email??"",map:venue?.map??"",note:venue?.note??""});},[venue]);
  async function save(){if(!supabase||!venue)return;const{error}=await supabase.from("venues").update({address:form.address,contact_name:form.contact,phone:form.phone,email:form.email,map_url:form.map,note:form.note}).eq("id",venue.id);if(error)onNotice(`Lokacija nije spremljena: ${error.message}`);else onSaved();}
  return <Dialog open={!!venue} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Uredi lokaciju · {venue?.name}</DialogTitle><DialogDescription>Promjene adrese i kontakta odmah su vidljive svim ekipama koje koriste ovu lokaciju.</DialogDescription></DialogHeader><div className="form-grid"><label className="wide">Adresa<Input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><label>Kontakt osoba<Input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></label><label>Telefon<Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>E-mail<Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Google Maps poveznica<Input value={form.map} onChange={e=>setForm({...form,map:e.target.value})}/></label><label className="wide">Napomena<Input value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={onClose}>Odustani</Button><Button className="red-button" onClick={()=>void save()}>Spremi</Button></DialogFooter></DialogContent></Dialog>;
}
function CaptainsDialog({open,onClose,teams,clubs,onNotice}:{open:boolean;onClose:()=>void;teams:Team[];clubs:Club[];onNotice:(s:string)=>void}){
  const[email,setEmail]=useState("");const[teamId,setTeamId]=useState("");const[managerEmail,setManagerEmail]=useState("");const[clubId,setClubId]=useState("");const[captains,setCaptains]=useState<Captain[]>([]);const[managers,setManagers]=useState<ClubManager[]>([]);const[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{if(!supabase)return;const[c,m]=await Promise.all([supabase.from("team_editors").select("team_id,email,app_users(user_id)"),supabase.from("club_managers").select("club_id,email,app_users(user_id)")]);if(c.error||m.error){onNotice(c.error?.message??m.error?.message??"");return;}setCaptains((c.data??[]).map((x:any)=>({team_id:x.team_id,email:x.email,user_id:x.app_users?.user_id??null,team_name:teams.find(t=>t.id===x.team_id)?.name??"Nepoznat tim"})));setManagers((m.data??[]).map((x:any)=>({club_id:x.club_id,email:x.email,user_id:x.app_users?.user_id??null,club_name:clubs.find(k=>k.id===x.club_id)?.name??"Nepoznat klub"})));},[teams,clubs,onNotice]);
  useEffect(()=>{if(open){setTeamId(teams[0]?.id??"");setClubId(clubs[0]?.id??"");void load();}},[open,teams,clubs,load]);
  async function invite(targetEmail:string,roleName:"captain"|"club_manager"){if(!supabase)return false;const normalized=targetEmail.trim().toLowerCase();const u=await supabase.from("app_users").upsert({email:normalized,role:roleName},{onConflict:"email",ignoreDuplicates:true});if(u.error){onNotice(u.error.message);return false;}return true;}
  async function sendMail(targetEmail:string,label:string){if(!supabase)return;const normalized=targetEmail.trim().toLowerCase();const mail=await supabase.auth.signInWithOtp({email:normalized,options:{emailRedirectTo:window.location.origin+window.location.pathname}});onNotice(mail.error?`${label} je dodan, ali poruka nije poslana: ${mail.error.message}`:`Poziv je poslan na ${normalized}.`);}
  async function addCaptain(){if(!supabase||!email||!teamId)return;setBusy(true);const normalized=email.trim().toLowerCase();if(await invite(normalized,"captain")){const a=await supabase.from("team_editors").upsert({team_id:teamId,email:normalized},{onConflict:"team_id,email",ignoreDuplicates:true});if(a.error)onNotice(a.error.message);else{await sendMail(normalized,"Kapetan");setEmail("");await load();}}setBusy(false);}
  async function addManager(){if(!supabase||!managerEmail||!clubId)return;setBusy(true);const normalized=managerEmail.trim().toLowerCase();if(await invite(normalized,"club_manager")){const a=await supabase.from("club_managers").upsert({club_id:clubId,email:normalized},{onConflict:"club_id,email",ignoreDuplicates:true});if(a.error)onNotice(a.error.message);else{await sendMail(normalized,"Voditelj kluba");setManagerEmail("");await load();}}setBusy(false);}
  async function removeCaptain(c:Captain){if(!supabase)return;const r=await supabase.from("team_editors").delete().eq("team_id",c.team_id).eq("email",c.email);if(r.error)onNotice(r.error.message);else{onNotice("Ovlasti kapetana su uklonjene.");await load();}}
  async function removeManager(m:ClubManager){if(!supabase)return;const r=await supabase.from("club_managers").delete().eq("club_id",m.club_id).eq("email",m.email);if(r.error)onNotice(r.error.message);else{onNotice("Ovlasti voditelja kluba su uklonjene.");await load();}}
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="access-dialog"><DialogHeader><DialogTitle>Ovlasti korisnika</DialogTitle><DialogDescription>Voditelj uređuje sve timove i lokacije kluba. Kapetan uređuje samo svoj tim i njegove utakmice.</DialogDescription></DialogHeader><section className="access-section"><h3>Voditelji klubova</h3><div className="captain-add"><Input type="email" value={managerEmail} onChange={e=>setManagerEmail(e.target.value)} placeholder="voditelj@primjer.hr"/><NativeSelect value={clubId} onChange={e=>setClubId(e.target.value)}>{clubs.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect><Button disabled={busy||!managerEmail||!clubId} className="red-button" onClick={()=>void addManager()}><ShieldCheck/> Dodaj</Button></div><div className="user-list">{managers.map(m=><div className="managed-user" key={`${m.club_id}-${m.email}`}><div><b>{m.email}</b><span>{m.club_name} · {m.user_id?"POTVRĐEN":"ČEKA PRIJAVU"}</span></div><Button variant="ghost" onClick={()=>void removeManager(m)}>Ukloni</Button></div>)}</div></section><section className="access-section"><h3>Kapetani timova</h3><div className="captain-add"><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="kapetan@primjer.hr"/><NativeSelect value={teamId} onChange={e=>setTeamId(e.target.value)}>{teams.map(t=><NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}</NativeSelect><Button disabled={busy||!email||!teamId} className="red-button" onClick={()=>void addCaptain()}><ShieldCheck/> Dodaj</Button></div><div className="user-list">{captains.map(c=><div className="managed-user" key={`${c.team_id}-${c.email}`}><div><b>{c.email}</b><span>{c.team_name} · {c.user_id?"POTVRĐEN":"ČEKA PRIJAVU"}</span></div><Button variant="ghost" onClick={()=>void removeCaptain(c)}>Ukloni</Button></div>)}</div></section><DialogFooter><Button variant="outline" onClick={onClose}>Zatvori</Button></DialogFooter></DialogContent></Dialog>;
}
