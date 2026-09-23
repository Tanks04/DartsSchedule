"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Bell, Building2, CalendarDays, Download, Edit3, LogIn, LogOut, MapPin, Menu, Plus, RotateCcw, Settings, ShieldCheck, Upload, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { useI18n, type Translator, type LanguageDefinition } from "@/lib/i18n";
import { actualVenue, dateKey, formatDate, normalizeHeader, seedData, type Booking, type CalendarEvent, type Club, type Competition, type Match, type Organization, type SchedulerData, type Team, type Venue } from "@/lib/darts-data";

type AppRole = "viewer" | "captain" | "club_manager" | "organization_admin" | "platform_admin";
type Captain = { email: string; user_id: string | null; team_id: string; team_name: string };
type ClubManager = { email: string; user_id: string | null; club_id: string; club_name: string };
type OrganizationAdmin = { email: string; user_id: string | null };
type ExcelImportRow = { row:number; id:string; season:string; league:string; date:string; time:string; home:string; away:string; round:string; venue:string; note:string; error:string };
type SessionLike = { user: { email?: string } } | null;
type OfficialSnapshot = { generatedAt:string; sources:{name:string;ok:boolean;count:number;error?:string}[]; events:Omit<CalendarEvent,"id"|"organizationId">[] };

const prefOrganization = "dartsScheduler.defaultOrganization";
const prefLeague = "dartsScheduler.defaultCompetition";
const prefTeam = "dartsScheduler.defaultTeam";
const prefVenue = "dartsScheduler.defaultVenue";

function Status({ busy, t }: { busy: boolean; t: Translator }) {
  return <span className={`status ${busy ? "busy" : "free"}`}>{t(busy ? "status.occupied" : "status.available")}</span>;
}

export default function Home() {
  const { t, language, setLanguage, languages, locale } = useI18n();
  const [data, setData] = useState<SchedulerData>(seedData);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [organizationId, setOrganizationId] = useState("");
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
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [organizationsOpen, setOrganizationsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [occupancyOpen, setOccupancyOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const platformAdmin = role === "platform_admin";
  const organizationAdmin = platformAdmin || role === "organization_admin";
  const editor = role !== "viewer";

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [organizationsR,seasonsR,competitionsR,venuesR,teamsR,membershipR,matchesR,changesR,clubsR,clubVenuesR,bookingsR,eventsR] = await Promise.all([
      supabase.from("organizations").select("*").eq("is_active",true).order("name"),
      supabase.from("seasons").select("*").order("name",{ascending:false}),
      supabase.from("competitions").select("*").order("name"),
      supabase.from("venues").select("*").order("name"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("competition_teams").select("competition_id,team_id"),
      supabase.from("matches").select("*").order("match_date").order("match_time"),
      supabase.from("schedule_changes").select("*").order("changed_at",{ascending:false}).limit(100),
      supabase.from("clubs").select("*").order("name"),
      supabase.from("club_venues").select("club_id,venue_id"),
      supabase.from("venue_bookings").select("*").order("event_date").order("start_time"),
      supabase.from("calendar_events").select("*").order("event_date").order("start_time"),
    ]);
    const migrationError = organizationsR.error || bookingsR.error || eventsR.error;
    if (migrationError) {
      setNotice(eventsR.error?"Baza još nije nadograđena na v9. Pokrenite supabase/upgrade_v9_events.sql.":"Baza još nije nadograđena na v7. Pokrenite supabase/upgrade_v7_organizations.sql.");
      setLoading(false);
      return;
    }
    const error = seasonsR.error || competitionsR.error || venuesR.error || teamsR.error || membershipR.error || matchesR.error || changesR.error || clubsR.error || clubVenuesR.error;
    if (error) { setNotice(`Podaci se ne mogu učitati: ${error.message}`); setLoading(false); return; }
    const organizations: Organization[] = (organizationsR.data??[]).map(o=>({id:o.id,name:o.name,slug:o.slug,countryCode:o.country_code,defaultLanguage:o.default_language,website:o.website,logo:o.logo_url,active:o.is_active}));
    const venues: Venue[] = (venuesR.data??[]).map(v=>({id:v.id,organizationId:v.organization_id,name:v.name,address:v.address,mine:v.is_featured,contact:v.contact_name,phone:v.phone,email:v.email,map:v.map_url,note:v.note}));
    const venueNames = new Map(venues.map(v=>[v.id,v.name]));
    const clubVenueRows=clubVenuesR.data??[];
    const clubs: Club[]=(clubsR.data??[]).map(c=>({id:c.id,organizationId:c.organization_id,name:c.name,contact:c.contact_name,phone:c.phone,email:c.email,note:c.note,venueIds:clubVenueRows.filter(x=>x.club_id===c.id).map(x=>x.venue_id),active:c.is_active!==false,archivedAt:c.archived_at??"",archivedReason:c.archived_reason??""}));
    const clubNames=new Map(clubs.map(c=>[c.id,c.name]));
    const memberships=membershipR.data??[];
    const teams:Team[]=(teamsR.data??[]).map(team=>({id:team.id,organizationId:team.organization_id,name:team.name,clubId:team.club_id??"",club:clubNames.get(team.club_id)??team.club_name,defaultVenueId:team.default_venue_id??"",defaultVenue:venueNames.get(team.default_venue_id)??"",contact:team.contact_name,phone:team.phone,email:team.email,note:team.note,competitionIds:memberships.filter(m=>m.team_id===team.id).map(m=>m.competition_id),active:team.is_active!==false,archivedAt:team.archived_at??"",archivedReason:team.archived_reason??""}));
    const teamNames=new Map(teams.map(team=>[team.id,team.name]));
    const competitions:Competition[]=(competitionsR.data??[]).map(c=>({id:c.id,organizationId:c.organization_id,seasonId:c.season_id,name:c.name,externalId:c.external_id}));
    const competitionNames=new Map(competitions.map(c=>[c.id,c.name]));
    const matches:Match[]=(matchesR.data??[]).map(m=>({id:m.id,organizationId:m.organization_id,date:m.match_date,time:String(m.match_time??"").slice(0,5),homeId:m.home_team_id,awayId:m.away_team_id,home:teamNames.get(m.home_team_id)??t("common.unknownTeam"),away:teamNames.get(m.away_team_id)??t("common.unknownTeam"),venueId:m.venue_id??"",venue:venueNames.get(m.venue_id)??"",competitionId:m.competition_id??"",competition:competitionNames.get(m.competition_id)??m.league??"",round:m.round_name,note:m.note,externalEventId:m.external_event_id??""}));
    const matchMap=new Map(matches.map(m=>[m.id,m]));
    const changes=(changesR.data??[]).map(c=>{const m=matchMap.get(c.match_id);return{id:c.id,matchId:c.match_id,changedAt:c.changed_at,changedBy:c.changed_by,oldDate:c.old_date,newDate:c.new_date,oldTime:String(c.old_time??"").slice(0,5),newTime:String(c.new_time??"").slice(0,5),competition:m?.competition??"",home:m?.home??"",away:m?.away??""};});
    const bookings:Booking[]=(bookingsR.data??[]).map(b=>({id:b.id,organizationId:b.organization_id,venueId:b.venue_id,date:b.event_date,startTime:String(b.start_time??"").slice(0,5),endTime:String(b.end_time??"").slice(0,5),title:b.title,organizer:b.organizer,note:b.note}));
    const events:CalendarEvent[]=(eventsR.data??[]).map(e=>({id:e.id,organizationId:e.organization_id??"",eventDate:e.event_date,endDate:e.end_date??"",startTime:String(e.start_time??"").slice(0,5),title:e.title,organizer:e.organizer,discipline:e.discipline,category:e.category,venueName:e.venue_name,address:e.address,city:e.city,sourceUrl:e.source_url,externalId:e.external_id,note:e.note}));
    setData({organizations,seasons:(seasonsR.data??[]).map(s=>({id:s.id,organizationId:s.organization_id,name:s.name,active:s.is_active})),competitions,clubs,venues,teams,matches,changes,bookings,events});
    setLoading(false);
  },[t]);

  const syncAuth = useCallback(async (session:SessionLike, orgId:string) => {
    if (!supabase) return;
    const email=session?.user.email??"";
    setSessionEmail(email);
    if (!session || !orgId) { setRole("viewer"); setEditableTeams([]); setManagedClubIds([]); return; }
    const [roleR,teamsR,clubsR]=await Promise.all([
      supabase.rpc("current_organization_role",{target:orgId}),
      supabase.from("team_editors").select("team_id").ilike("email",email),
      supabase.from("club_managers").select("club_id").ilike("email",email),
    ]);
    if(roleR.error){setRole("viewer");setNotice(`Prava nisu dostupna: ${roleR.error.message}`);return;}
    setEditableTeams((teamsR.data??[]).map(x=>x.team_id));
    setManagedClubIds((clubsR.data??[]).map(x=>x.club_id));
    setRole((["platform_admin","organization_admin","club_manager","captain"].includes(roleR.data)?roleR.data:"viewer") as AppRole);
    setNotice(current=>current.startsWith("Prava nisu dostupna")?"":current);
  },[]);

  useEffect(()=>{
    if(!supabase)return;
    void loadData();
    supabase.auth.getSession().then(({data:a})=>void syncAuth(a.session,organizationId));
    const{data:l}=supabase.auth.onAuthStateChange((_event,session)=>{void syncAuth(session,organizationId);void loadData();});
    return()=>l.subscription.unsubscribe();
  },[loadData,syncAuth,organizationId]);

  useEffect(()=>{
    const stored=localStorage.getItem(prefOrganization)??"";
    if(!organizationId||!data.organizations.some(o=>o.id===organizationId))setOrganizationId(data.organizations.find(o=>o.id===stored)?.id??data.organizations[0]?.id??"");
  },[data.organizations,organizationId]);

  const orgData=useMemo<SchedulerData>(()=>({
    organizations:data.organizations,
    seasons:data.seasons.filter(x=>x.organizationId===organizationId),
    competitions:data.competitions.filter(x=>x.organizationId===organizationId),
    clubs:data.clubs.filter(x=>x.organizationId===organizationId),
    venues:data.venues.filter(x=>x.organizationId===organizationId),
    teams:data.teams.filter(x=>x.organizationId===organizationId),
    matches:data.matches.filter(x=>x.organizationId===organizationId),
    changes:data.changes.filter(c=>data.matches.find(m=>m.id===c.matchId)?.organizationId===organizationId),
    bookings:data.bookings.filter(x=>x.organizationId===organizationId),
    events:data.events,
  }),[data,organizationId]);
  const activeTeams=useMemo(()=>orgData.teams.filter(team=>team.active),[orgData.teams]);
  const activeClubs=useMemo(()=>orgData.clubs.filter(club=>club.active),[orgData.clubs]);

  useEffect(()=>{
    const storedCompetition=localStorage.getItem(prefLeague)??"";
    const storedTeam=localStorage.getItem(prefTeam)??"";
    const storedVenue=localStorage.getItem(prefVenue)??"";
    if(!competitionId||!orgData.competitions.some(c=>c.id===competitionId))setCompetitionId(orgData.competitions.find(c=>c.id===storedCompetition)?.id??orgData.competitions[0]?.id??"");
    if(!teamId||!activeTeams.some(team=>team.id===teamId))setTeamId(activeTeams.find(team=>team.id===storedTeam)?.id??activeTeams.find(team=>team.competitionIds.includes(storedCompetition))?.id??activeTeams[0]?.id??"");
    if(!venueId||!orgData.venues.some(v=>v.id===venueId))setVenueId(orgData.venues.find(v=>v.id===storedVenue)?.id??orgData.venues.find(v=>v.mine)?.id??orgData.venues[0]?.id??"");
  },[orgData,activeTeams,competitionId,teamId,venueId]);

  const leagueTeams=useMemo(()=>activeTeams.filter(team=>team.competitionIds.includes(competitionId)),[activeTeams,competitionId]);
  useEffect(()=>{if(leagueTeams.length&&!leagueTeams.some(team=>team.id===teamId))setTeamId(leagueTeams[0].id);},[leagueTeams,teamId]);
  const selectedTeam=orgData.teams.find(team=>team.id===teamId);
  const selectedClub=orgData.clubs.find(club=>club.id===selectedTeam?.clubId);
  const selectedVenue=orgData.venues.find(v=>v.id===venueId);
  const teamMatches=useMemo(()=>orgData.matches.filter(m=>m.competitionId===competitionId&&(m.homeId===teamId||m.awayId===teamId)),[orgData.matches,competitionId,teamId]);
  const venueMatches=useMemo(()=>selectedVenue?orgData.matches.filter(m=>actualVenue(m,orgData.teams)===selectedVenue.name&&(m.date<dateKey(new Date())||(orgData.teams.find(t=>t.id===m.homeId)?.active!==false&&orgData.teams.find(t=>t.id===m.awayId)?.active!==false))):[],[orgData.matches,orgData.teams,selectedVenue]);
  const venueBookings=useMemo(()=>selectedVenue?orgData.bookings.filter(b=>b.venueId===selectedVenue.id):[],[orgData.bookings,selectedVenue]);
  const today=dateKey(new Date());
  const todayMatches=venueMatches.filter(m=>m.date===today);
  const todayBookings=venueBookings.filter(b=>b.date===today);
  const weekEndDate=new Date();weekEndDate.setHours(12,0,0,0);weekEndDate.setDate(weekEndDate.getDate()+7);
  const weekEnd=dateKey(weekEndDate);
  const canEditTeam=(team?:Team)=>!!team&&(organizationAdmin||editableTeams.includes(team.id)||managedClubIds.includes(team.clubId));
  const canEditClub=(club?:Club)=>!!club&&(organizationAdmin||managedClubIds.includes(club.id));
  const canEditMatch=(match:Match)=>canEditTeam(orgData.teams.find(team=>team.id===match.homeId))||canEditTeam(orgData.teams.find(team=>team.id===match.awayId));
  const canEditSelectedVenue=!!selectedVenue&&(organizationAdmin||orgData.clubs.some(club=>managedClubIds.includes(club.id)&&club.venueIds.includes(selectedVenue.id)));
  const watchedTeams=useMemo(()=>{
    if(managedClubIds.length)return activeTeams.filter(team=>managedClubIds.includes(team.clubId));
    if(editableTeams.length)return activeTeams.filter(team=>editableTeams.includes(team.id));
    if(organizationAdmin&&selectedVenue)return activeTeams.filter(team=>team.defaultVenueId===selectedVenue.id);
    return selectedTeam?.active?[selectedTeam]:[];
  },[activeTeams,managedClubIds,editableTeams,organizationAdmin,selectedTeam,selectedVenue]);
  const weeklyRows=watchedTeams.map(team=>({team,match:orgData.matches.filter(m=>(m.homeId===team.id||m.awayId===team.id)&&m.date>=today&&m.date<=weekEnd&&orgData.teams.find(t=>t.id===(m.homeId===team.id?m.awayId:m.homeId))?.active!==false).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))[0]}));

  function selectOrganization(id:string){setOrganizationId(id);localStorage.setItem(prefOrganization,id);setCompetitionId("");setTeamId("");setVenueId("");}
  function selectCompetition(id:string){setCompetitionId(id);localStorage.setItem(prefLeague,id);const first=activeTeams.find(team=>team.competitionIds.includes(id));if(first){setTeamId(first.id);localStorage.setItem(prefTeam,first.id);}}
  function selectTeam(id:string){setTeamId(id);localStorage.setItem(prefTeam,id);}
  function selectVenue(id:string){setVenueId(id);localStorage.setItem(prefVenue,id);}

  async function exportExcel(){
    if(!selectedTeam)return;
    const XLSX=await import("xlsx");
    const competition=orgData.competitions.find(c=>c.id===competitionId);
    const season=orgData.seasons.find(s=>s.id===competition?.seasonId)?.name??"";
    const headers=language==="hr"?["ID","Sezona","Liga","Datum","Vrijeme","Domaćin","Gost","Kolo","Lokacija","Napomena"]:language==="de"?["ID","Saison","Liga","Datum","Uhrzeit","Heimteam","Gastteam","Runde","Spielort","Notiz"]:["ID","Season","League","Date","Time","Home team","Away team","Round","Venue","Note"];
    const rows=teamMatches.map(m=>[m.externalEventId||m.id,season,m.competition,new Date(`${m.date}T12:00:00`),m.time,m.home,m.away,m.round,actualVenue(m,orgData.teams),m.note]);
    const ws=XLSX.utils.aoa_to_sheet([headers,...rows],{cellDates:true});ws["!cols"]=[{wch:22},{wch:12},{wch:22},{wch:12},{wch:10},{wch:28},{wch:28},{wch:12},{wch:28},{wch:30}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,language==="hr"?"Utakmice":language==="de"?"Spiele":"Matches");
    XLSX.writeFile(wb,`DartsScheduler_${selectedTeam.name.replace(/[^a-z0-9]+/gi,"_")}_${season.replace(/[^0-9]+/g,"-")}.xlsx`);
  }

  const busyToday=todayMatches.length+todayBookings.length>0;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span>DS</span><div><strong>DartsScheduler</strong><small>{t("app.subtitle")}</small></div></div><div className="top-actions">
      {editor&&<Button variant="ghost" onClick={()=>setImportOpen(true)}><Upload/>{t("action.import")}</Button>}
      {editor&&<Button variant="ghost" onClick={()=>void exportExcel()}><Download/>{t("action.export")}</Button>}
      <Button variant="ghost" onClick={()=>setSettingsOpen(true)}><Settings/>{t("action.settings")}</Button>
      <Button variant="ghost" onClick={()=>setEventsOpen(true)}><CalendarDays/>{t("events.action")}</Button>
      {organizationAdmin&&<Button variant="outline" onClick={()=>setPermissionsOpen(true)}><UserCog/>{t("action.permissions")}</Button>}
      {platformAdmin&&<Button variant="outline" onClick={()=>setOrganizationsOpen(true)}><Building2/>{t("action.organizations")}</Button>}
      {sessionEmail?<Button variant="ghost" onClick={()=>supabase?.auth.signOut()}><LogOut/>{t("action.logout")}</Button>:<Button variant="ghost" onClick={()=>setLoginOpen(true)}><LogIn/>{t("action.login")}</Button>}
    </div><Button className="mobile-menu-trigger" variant="ghost" size="icon" aria-label={t("action.menu")} onClick={()=>setMobileMenuOpen(true)}><Menu/></Button></header>
    {notice&&<button className="notice" onClick={()=>setNotice("")}>{notice}</button>}
    {!supabaseConfigured&&<div className="setup-note">{t("common.demo")}</div>}
    <div className="organization-strip"><Building2/><strong>{data.organizations.find(o=>o.id===organizationId)?.name??"DartsScheduler"}</strong></div>
    <section className="panel location-status-panel"><div className="location-status-head"><div><span className="eyebrow"><MapPin/>{t("location.status")}</span><h2>{selectedVenue?.name??t("location.none")}</h2></div><div className="panel-tools"><NativeSelect value={venueId} onChange={e=>selectVenue(e.target.value)}>{orgData.venues.slice().sort((a,b)=>Number(b.mine)-Number(a.mine)||a.name.localeCompare(b.name)).map(v=><NativeSelectOption key={v.id} value={v.id}>{v.mine?"★ ":""}{v.name}</NativeSelectOption>)}</NativeSelect>{canEditSelectedVenue&&<Button variant="ghost" size="icon" onClick={()=>setEditingVenue(selectedVenue!)}><Edit3/></Button>}{canEditSelectedVenue&&<Button variant="ghost" size="icon" title={t("action.addBooking")} onClick={()=>setBookingOpen(true)}><Plus/></Button>}</div></div>{selectedVenue&&<p className="meta"><MapPin/>{selectedVenue.address}{selectedVenue.mine&&<b className="mine">{t("location.mine")}</b>}</p>}<button disabled={!selectedVenue} className={`today status-trigger ${busyToday?"busy":"free"}`} onClick={()=>setOccupancyOpen(true)}><div><small>{t("status.today")}</small><Status busy={busyToday} t={t}/></div><div>{busyToday?<>{todayMatches.map(m=><span key={m.id}>{m.time||"—"} · {m.home} — {m.away}<small>{m.competition}</small></span>)}{todayBookings.map(b=><span key={b.id}>{b.startTime||"—"} · {b.title}<small>{t("booking.label")}{b.organizer?` · ${b.organizer}`:""}</small></span>)}</>:<span>{t("status.noMatches")}</span>}<small>{selectedVenue?t("status.next30"):t("location.selectFirst")}</small></div></button></section>
    <div className="filters compact-filters"><label>{t("field.league")}<NativeSelect value={competitionId} onChange={e=>selectCompetition(e.target.value)}>{orgData.competitions.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></label><label>{t("field.team")}<NativeSelect value={teamId} onChange={e=>selectTeam(e.target.value)}>{leagueTeams.map(team=><NativeSelectOption key={team.id} value={team.id}>{team.name}</NativeSelectOption>)}</NativeSelect></label></div>
    {editor&&<div className="selection-actions"><span className="role-pill">{t(`role.${role}`)}</span>{canEditTeam(selectedTeam)&&<Button variant="outline" onClick={()=>setEditingTeam(selectedTeam!)}><Edit3/>{t("action.editSelectedTeam")}</Button>}{canEditClub(selectedClub)&&<Button variant="outline" onClick={()=>setEditingClub(selectedClub!)}><Building2/>{t("action.editClub")}</Button>}<Button variant="ghost" onClick={()=>setArchiveOpen(true)}><Archive/>{t("archive.title")}</Button></div>}
    <section className="panel weekly-panel"><div className="panel-head"><div><span className="eyebrow"><Users/>{t("week.title")}</span><h1>{watchedTeams.length>1?`${watchedTeams.length} ${organizationAdmin?t("week.venueTeams"):t("week.myTeams")}`:selectedTeam?.name??t("schedule.team")}</h1></div><div className="panel-tools"><Button variant="outline" onClick={()=>setScheduleOpen(true)}><CalendarDays/>{t("action.schedule")}</Button></div></div>
      <div className="weekly-team-list">{loading?<Empty>{t("common.loading")}</Empty>:weeklyRows.map(({team,match})=><button key={team.id} className={`weekly-team-row ${team.id===teamId?"selected":""}`} onClick={()=>{const league=team.competitionIds[0];if(league)selectCompetition(league);selectTeam(team.id);}}><strong>{team.name}</strong>{match?<><span>{formatDate(match.date,false,locale)} · {match.time||"—"}</span><span>{match.home} — {match.away}</span><em>{match.competition}</em></>:<span className="no-game">{t("week.noGame")}</span>}</button>)}</div>
      {!!orgData.changes.filter(c=>c.competition===orgData.competitions.find(x=>x.id===competitionId)?.name).length&&<><div className="section-label"><span><Bell/>{t("changes.recent")}</span></div><div className="changes">{orgData.changes.filter(c=>c.competition===orgData.competitions.find(x=>x.id===competitionId)?.name).slice(0,3).map(c=><div key={c.id}><b>{c.home} — {c.away}</b><span>{formatDate(c.oldDate,false,locale)} {c.oldTime} → {formatDate(c.newDate,false,locale)} {c.newTime}</span></div>)}</div></>}
    </section>

    <LoginDialog open={loginOpen} onClose={()=>setLoginOpen(false)} onNotice={setNotice} t={t}/>
    <MobileMenuDialog open={mobileMenuOpen} onClose={()=>setMobileMenuOpen(false)} editor={editor} organizationAdmin={organizationAdmin} platformAdmin={platformAdmin} signedIn={!!sessionEmail} onEvents={()=>setEventsOpen(true)} onImport={()=>setImportOpen(true)} onExport={()=>void exportExcel()} onSettings={()=>setSettingsOpen(true)} onPermissions={()=>setPermissionsOpen(true)} onOrganizations={()=>setOrganizationsOpen(true)} onLogin={()=>setLoginOpen(true)} onLogout={()=>void supabase?.auth.signOut()} t={t}/>
    <SettingsDialog open={settingsOpen} onClose={()=>setSettingsOpen(false)} organizations={data.organizations} organizationId={organizationId} onOrganization={selectOrganization} seasons={orgData.seasons} competitions={orgData.competitions} teams={activeTeams} competitionId={competitionId} teamId={teamId} onCompetition={selectCompetition} onTeam={selectTeam} languages={languages} language={language} onLanguage={setLanguage} t={t}/>
    <ScheduleDialog open={scheduleOpen} onClose={()=>setScheduleOpen(false)} team={selectedTeam} matches={teamMatches} teams={orgData.teams} canEdit={canEditMatch} onEdit={setEditing} t={t} locale={locale}/>
    <OccupancyDialog open={occupancyOpen} onClose={()=>setOccupancyOpen(false)} venue={selectedVenue} matches={venueMatches} bookings={venueBookings} t={t} locale={locale}/>
    <EventsDialog open={eventsOpen} onClose={()=>setEventsOpen(false)} events={data.events} platformAdmin={platformAdmin} organizationAdmin={organizationAdmin} organizationId={organizationId} psgzOrganizationId={data.organizations.find(o=>o.slug==="psgz")?.id??""} onSaved={loadData} onNotice={setNotice} t={t} locale={locale}/>
    <ImportDialog open={importOpen} onClose={()=>setImportOpen(false)} data={orgData} organizationId={organizationId} admin={organizationAdmin} editableTeams={editableTeams} managedClubIds={managedClubIds} onSaved={async count=>{setImportOpen(false);setNotice(t("import.saved",{count}));await loadData();}} onNotice={setNotice} t={t}/>
    <EditMatchDialog match={editing} venues={orgData.venues} onClose={()=>setEditing(null)} onSaved={async()=>{setEditing(null);await loadData();}} onNotice={setNotice} t={t}/>
    <EditTeamDialog team={editingTeam} venues={orgData.venues} clubs={activeClubs} competitionId={competitionId} competitionName={orgData.competitions.find(c=>c.id===competitionId)?.name??""} admin={organizationAdmin} onClose={()=>setEditingTeam(null)} onSaved={async()=>{setEditingTeam(null);await loadData();}} onNotice={setNotice} t={t}/>
    <EditClubDialog club={editingClub} teams={orgData.teams} onClose={()=>setEditingClub(null)} onSaved={async()=>{setEditingClub(null);await loadData();}} onNotice={setNotice} t={t}/>
    <ArchiveDialog open={archiveOpen} onClose={()=>setArchiveOpen(false)} teams={orgData.teams} clubs={orgData.clubs} organizationAdmin={organizationAdmin} editableTeams={editableTeams} managedClubIds={managedClubIds} onSaved={loadData} onNotice={setNotice} t={t}/>
    <EditVenueDialog venue={editingVenue} onClose={()=>setEditingVenue(null)} onSaved={async()=>{setEditingVenue(null);await loadData();}} onNotice={setNotice} t={t}/>
    <BookingDialog open={bookingOpen} venue={selectedVenue} organizationId={organizationId} onClose={()=>setBookingOpen(false)} onSaved={async()=>{setBookingOpen(false);setNotice(t("booking.saved"));await loadData();}} onNotice={setNotice} t={t}/>
    <PermissionsDialog open={permissionsOpen} onClose={()=>setPermissionsOpen(false)} organizationId={organizationId} teams={activeTeams} clubs={activeClubs} onNotice={setNotice} t={t}/>
    <OrganizationsDialog open={organizationsOpen} onClose={()=>setOrganizationsOpen(false)} onSaved={async()=>{setOrganizationsOpen(false);setNotice(t("organizations.created"));await loadData();}} onNotice={setNotice} t={t}/>
  </main>;
}

function Empty({children}:{children:React.ReactNode}){return <div className="empty">{children}</div>}

function MobileMenuDialog({open,onClose,editor,organizationAdmin,platformAdmin,signedIn,onEvents,onImport,onExport,onSettings,onPermissions,onOrganizations,onLogin,onLogout,t}:{open:boolean;onClose:()=>void;editor:boolean;organizationAdmin:boolean;platformAdmin:boolean;signedIn:boolean;onEvents:()=>void;onImport:()=>void;onExport:()=>void;onSettings:()=>void;onPermissions:()=>void;onOrganizations:()=>void;onLogin:()=>void;onLogout:()=>void;t:Translator}){
  const run=(action:()=>void)=>{onClose();action();};
  return <Dialog open={open} onOpenChange={value=>!value&&onClose()}><DialogContent className="mobile-nav-dialog"><DialogHeader><DialogTitle>{t("action.menu")}</DialogTitle><DialogDescription>{t("mobileMenu.description")}</DialogDescription></DialogHeader><div className="mobile-nav-actions"><Button variant="outline" onClick={()=>run(onEvents)}><CalendarDays/>{t("events.action")}</Button><Button variant="outline" onClick={()=>run(onSettings)}><Settings/>{t("action.settings")}</Button>{editor&&<Button variant="outline" onClick={()=>run(onImport)}><Upload/>{t("action.import")}</Button>}{editor&&<Button variant="outline" onClick={()=>run(onExport)}><Download/>{t("action.export")}</Button>}{organizationAdmin&&<Button variant="outline" onClick={()=>run(onPermissions)}><UserCog/>{t("action.permissions")}</Button>}{platformAdmin&&<Button variant="outline" onClick={()=>run(onOrganizations)}><Building2/>{t("action.organizations")}</Button>}{signedIn?<Button variant="outline" onClick={()=>run(onLogout)}><LogOut/>{t("action.logout")}</Button>:<Button variant="outline" onClick={()=>run(onLogin)}><LogIn/>{t("action.login")}</Button>}</div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.close")}</Button></DialogFooter></DialogContent></Dialog>;
}

function EventsDialog({open,onClose,events,platformAdmin,organizationAdmin,organizationId,psgzOrganizationId,onSaved,onNotice,t,locale}:{open:boolean;onClose:()=>void;events:CalendarEvent[];platformAdmin:boolean;organizationAdmin:boolean;organizationId:string;psgzOrganizationId:string;onSaved:()=>Promise<void>;onNotice:(value:string)=>void;t:Translator;locale:string}){
  const[organizer,setOrganizer]=useState("all");const[discipline,setDiscipline]=useState("all");const[showPast,setShowPast]=useState(false);const[snapshot,setSnapshot]=useState<OfficialSnapshot|null>(null);const[checking,setChecking]=useState(false);const[saving,setSaving]=useState(false);const today=dateKey(new Date());
  useEffect(()=>{if(open){setOrganizer("all");setDiscipline("all");setShowPast(false);setSnapshot(null);}},[open]);
  const organizers=Array.from(new Set(events.map(event=>event.organizer))).sort();
  const filtered=events.filter(event=>(organizer==="all"||event.organizer===organizer)&&(discipline==="all"||event.discipline===discipline)&&(showPast||event.eventDate>=today)).sort((a,b)=>a.eventDate.localeCompare(b.eventDate)||a.startTime.localeCompare(b.startTime));
  const comparable=(event:CalendarEvent|OfficialSnapshot["events"][number])=>[event.eventDate,event.startTime,event.title,event.discipline,event.category,event.venueName,event.address,event.city,event.sourceUrl,event.note].map(value=>String(value??"").trim()).join("|");
  const changes=(snapshot?.events??[]).map(event=>{const existing=events.find(item=>item.organizer===event.organizer&&item.externalId===event.externalId);return{event,existing,status:!existing?"new":comparable(existing)!==comparable(event)?"changed":"same"};});
  const pending=changes.filter(change=>change.status!=="same"&&((change.event.organizer==="HPS"&&platformAdmin)||(change.event.organizer==="PSGZ"&&(platformAdmin||(organizationAdmin&&organizationId===psgzOrganizationId)))));
  async function check(){setChecking(true);try{const base=process.env.NEXT_PUBLIC_BASE_PATH||"";const response=await fetch(`${base}/data/official-events.json`,{cache:"no-store"});if(!response.ok)throw new Error(`${response.status}`);setSnapshot(await response.json() as OfficialSnapshot);}catch(error){onNotice(t("events.checkError",{error:error instanceof Error?error.message:String(error)}));}finally{setChecking(false);}}
  async function apply(){if(!supabase||!pending.length)return;setSaving(true);const rows=pending.map(({event})=>({organization_id:event.organizer==="PSGZ"?psgzOrganizationId:null,event_date:event.eventDate,end_date:event.endDate||null,start_time:event.startTime||null,title:event.title,organizer:event.organizer,discipline:event.discipline,category:event.category,venue_name:event.venueName,address:event.address,city:event.city,source_url:event.sourceUrl,external_id:event.externalId,note:event.note}));const{error}=await supabase.from("calendar_events").upsert(rows,{onConflict:"organizer,external_id"});setSaving(false);if(error)onNotice(error.message);else{onNotice(t("events.applied",{count:rows.length}));setSnapshot(null);await onSaved();}}
  return <Dialog open={open} onOpenChange={value=>!value&&onClose()}><DialogContent className="events-dialog"><DialogHeader><DialogTitle>{t("events.title")}</DialogTitle><DialogDescription>{t("events.description")}</DialogDescription></DialogHeader>{(platformAdmin||organizationAdmin)&&<div className="official-check"><div><b>{t("events.officialCheck")}</b><span>{snapshot?t("events.generated",{date:new Intl.DateTimeFormat(locale,{dateStyle:"short",timeStyle:"short"}).format(new Date(snapshot.generatedAt))}):t("events.checkDescription")}</span></div><Button variant="outline" disabled={checking} onClick={()=>void check()}><RotateCcw/>{checking?t("events.checking"):t("events.check")}</Button></div>}{snapshot&&<div className="official-diff"><div className="diff-summary"><span>{t("events.newCount",{count:changes.filter(x=>x.status==="new").length})}</span><span>{t("events.changedCount",{count:changes.filter(x=>x.status==="changed").length})}</span><span>{t("events.sameCount",{count:changes.filter(x=>x.status==="same").length})}</span></div>{snapshot.sources.map(source=><small key={source.name} className={source.ok?"ok":"bad"}>{source.name}: {source.ok?`${source.count} ✓`:source.error}</small>)}<div className="diff-list">{changes.filter(x=>x.status!=="same").map(({event,status})=><div key={`${event.organizer}-${event.externalId}`}><b>{formatDate(event.eventDate,false,locale)} · {event.title}</b><span>{event.organizer} · {t(`events.${event.discipline}`)}</span><em>{t(`events.${status}`)}</em></div>)}</div><div className="diff-actions"><Button variant="outline" disabled={saving} onClick={()=>setSnapshot(null)}>{t("events.cancelImport")}</Button><Button className="red-button" disabled={saving||!pending.length} onClick={()=>void apply()}>{saving?t("events.applying"):t("events.apply",{count:pending.length})}</Button></div></div>}<div className="events-toolbar"><label>{t("events.organizer")}<NativeSelect value={organizer} onChange={e=>setOrganizer(e.target.value)}><NativeSelectOption value="all">{t("events.all")}</NativeSelectOption>{organizers.map(value=><NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect></label><label>{t("events.discipline")}<NativeSelect value={discipline} onChange={e=>setDiscipline(e.target.value)}><NativeSelectOption value="all">{t("events.all")}</NativeSelectOption><NativeSelectOption value="electronic">{t("events.electronic")}</NativeSelectOption><NativeSelectOption value="classic">{t("events.classic")}</NativeSelectOption></NativeSelect></label><label className="events-past"><input type="checkbox" checked={showPast} onChange={e=>setShowPast(e.target.checked)}/>{t("events.showPast")}</label></div><div className="events-list">{filtered.length?filtered.map(event=><article className="calendar-event" key={event.id}><div className="event-date"><b>{formatDate(event.eventDate,false,locale)}</b><span>{event.startTime||t("events.timeTba")}</span></div><div><h3>{event.title}</h3><p>{event.organizer} · {t(`events.${event.discipline}`)}{event.category?` · ${event.category}`:""}</p>{(event.venueName||event.city)&&<small><MapPin/>{[event.venueName,event.address,event.city].filter(Boolean).join(", ")}</small>}</div>{event.sourceUrl&&<a href={event.sourceUrl} target="_blank" rel="noreferrer">{t("events.source")}</a>}</article>):<Empty>{t("events.empty")}</Empty>}</div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.close")}</Button></DialogFooter></DialogContent></Dialog>;
}
function MatchRow({match,venue,editable,onEdit,t,locale}:{match:Match;venue:string;editable:boolean;onEdit:()=>void;t:Translator;locale:string}){return <article className="match"><div className="when"><b>{formatDate(match.date,false,locale)}</b><span>{match.time||"—"}</span></div><div><b>{match.home}</b><span> — </span><b>{match.away}</b><small><MapPin/>{venue||t("location.unspecified")}</small></div><em>{[match.competition,match.round].filter(Boolean).join(" · ")}</em>{editable&&<Button variant="ghost" size="icon" onClick={onEdit}><Edit3/></Button>}</article>}

function ScheduleDialog({open,onClose,team,matches,teams,canEdit,onEdit,t,locale}:{open:boolean;onClose:()=>void;team:Team|undefined;matches:Match[];teams:Team[];canEdit:(m:Match)=>boolean;onEdit:(m:Match)=>void;t:Translator;locale:string}){
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="schedule-dialog"><DialogHeader><DialogTitle>{t("action.schedule")} · {team?.name??t("field.team")}</DialogTitle><DialogDescription>{t("schedule.fullDescription")}</DialogDescription></DialogHeader><div className="dialog-match-list">{matches.length?matches.map(m=><MatchRow key={m.id} match={m} venue={actualVenue(m,teams)} editable={canEdit(m)} onEdit={()=>onEdit(m)} t={t} locale={locale}/>):<Empty>{t("schedule.empty")}</Empty>}</div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.close")}</Button></DialogFooter></DialogContent></Dialog>;
}

function OccupancyDialog({open,onClose,venue,matches,bookings,t,locale}:{open:boolean;onClose:()=>void;venue:Venue|undefined;matches:Match[];bookings:Booking[];t:Translator;locale:string}){
  const[page,setPage]=useState(0);
  const[wholeSeason,setWholeSeason]=useState(false);
  const[showFree,setShowFree]=useState(false);
  useEffect(()=>{if(open){setPage(0);setWholeSeason(false);setShowFree(false);}},[open,venue?.id]);
  const days=useMemo(()=>{
    const todayDate=new Date();todayDate.setHours(12,0,0,0);
    const eventDates=[...matches.map(m=>m.date),...bookings.map(b=>b.date)].filter(Boolean).sort();
    let start=new Date(todayDate);let end=new Date(todayDate);
    if(wholeSeason&&eventDates.length){start=new Date(`${eventDates[0]}T12:00:00`);end=new Date(`${eventDates[eventDates.length-1]}T12:00:00`);}
    else{start.setDate(start.getDate()+page*30);end=new Date(start);end.setDate(end.getDate()+29);}
    const matchesByDate=new Map<string,Match[]>();for(const match of matches)matchesByDate.set(match.date,[...(matchesByDate.get(match.date)??[]),match]);
    const bookingsByDate=new Map<string,Booking[]>();for(const booking of bookings)bookingsByDate.set(booking.date,[...(bookingsByDate.get(booking.date)??[]),booking]);
    const result:{key:string;d:Date;matches:Match[];bookings:Booking[]}[]=[];
    for(const cursor=new Date(start);cursor<=end&&result.length<550;cursor.setDate(cursor.getDate()+1)){
      const key=dateKey(cursor);const dayMatches=matchesByDate.get(key)??[];const dayBookings=bookingsByDate.get(key)??[];
      if(!wholeSeason||showFree||dayMatches.length+dayBookings.length)result.push({key,d:new Date(cursor),matches:dayMatches,bookings:dayBookings});
    }
    return result;
  },[matches,bookings,page,wholeSeason,showFree]);
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="schedule-dialog"><DialogHeader><DialogTitle>{t("occupancy.title")} · {venue?.name??t("field.venue")}</DialogTitle><DialogDescription>{t(wholeSeason?"occupancy.seasonDescription":"occupancy.description")}</DialogDescription></DialogHeader><div className="occupancy-toolbar"><Button variant="outline" disabled={wholeSeason} onClick={()=>setPage(value=>value-1)}>← {t("occupancy.previous30")}</Button><Button variant="outline" onClick={()=>{setPage(0);setWholeSeason(false);}}>{t("status.today")}</Button><Button variant="outline" disabled={wholeSeason} onClick={()=>setPage(value=>value+1)}>{t("occupancy.next30")} →</Button><Button variant={wholeSeason?"default":"outline"} onClick={()=>setWholeSeason(value=>!value)}>{t("occupancy.wholeSeason")}</Button>{wholeSeason&&<label className="occupancy-free-toggle"><input type="checkbox" checked={showFree} onChange={e=>setShowFree(e.target.checked)}/>{t("occupancy.showFree")}</label>}</div><div className="occupancy-list">{days.length?days.map(day=>{const busy=day.matches.length+day.bookings.length>0;return <div className="day" key={day.key}><div><b>{new Intl.DateTimeFormat(locale,{weekday:"short"}).format(day.d)}</b><span>{formatDate(day.key,false,locale)}</span></div><Status busy={busy} t={t}/><div>{busy?<>{day.matches.map(m=><span key={m.id}>{m.time||"—"} · {m.home} — {m.away}<small>{m.competition}</small></span>)}{day.bookings.map(b=><span key={b.id}>{b.startTime||"—"} · {b.title}<small>{t("booking.label")}{b.organizer?` · ${b.organizer}`:""}</small></span>)}</>:"—"}</div></div>}):<Empty>{t("occupancy.empty")}</Empty>}</div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.close")}</Button></DialogFooter></DialogContent></Dialog>;
}

function LoginDialog({open,onClose,onNotice,t}:{open:boolean;onClose:()=>void;onNotice:(s:string)=>void;t:Translator}){
  const[email,setEmail]=useState("");
  async function send(){if(!supabase)return;const{error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});onNotice(error?error.message:t("login.sent"));if(!error)onClose();}
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{t("login.title")}</DialogTitle><DialogDescription>{t("login.description")}</DialogDescription></DialogHeader><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button className="red-button" onClick={()=>void send()}>{t("action.sendLink")}</Button></DialogFooter></DialogContent></Dialog>;
}

function SettingsDialog({open,onClose,organizations,organizationId,onOrganization,seasons,competitions,teams,competitionId,teamId,onCompetition,onTeam,languages,language,onLanguage,t}:{open:boolean;onClose:()=>void;organizations:Organization[];organizationId:string;onOrganization:(v:string)=>void;seasons:{id:string;name:string;active:boolean}[];competitions:Competition[];teams:Team[];competitionId:string;teamId:string;onCompetition:(v:string)=>void;onTeam:(v:string)=>void;languages:LanguageDefinition[];language:string;onLanguage:(v:string)=>void;t:Translator}){
  const filtered=teams.filter(team=>team.competitionIds.includes(competitionId));const seasonId=competitions.find(c=>c.id===competitionId)?.seasonId??seasons[0]?.id??"";
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{t("settings.title")}</DialogTitle><DialogDescription>{t("settings.description")}</DialogDescription></DialogHeader><div className="form-grid"><label className="wide">{t("field.organization")}<NativeSelect value={organizationId} onChange={e=>onOrganization(e.target.value)}>{organizations.map(o=><NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}</NativeSelect></label><label>{t("field.language")}<NativeSelect value={language} onChange={e=>onLanguage(e.target.value)}>{languages.map(item=><NativeSelectOption key={item.code} value={item.code}>{item.name}</NativeSelectOption>)}</NativeSelect></label><label>{t("field.season")}<NativeSelect value={seasonId} disabled>{seasons.map(s=><NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}</NativeSelect></label><label>{t("field.league")}<NativeSelect value={competitionId} onChange={e=>onCompetition(e.target.value)}>{competitions.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></label><label>{t("field.team")}<NativeSelect value={teamId} onChange={e=>onTeam(e.target.value)}>{filtered.map(team=><NativeSelectOption key={team.id} value={team.id}>{team.name}</NativeSelectOption>)}</NativeSelect></label></div><DialogFooter><Button onClick={onClose}>{t("settings.done")}</Button></DialogFooter></DialogContent></Dialog>;
}

function EditMatchDialog({match,venues,onClose,onSaved,onNotice,t}:{match:Match|null;venues:Venue[];onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void;t:Translator}){
  const[date,setDate]=useState("");const[time,setTime]=useState("");const[venueId,setVenueId]=useState("");
  useEffect(()=>{setDate(match?.date??"");setTime(match?.time??"");setVenueId(match?.venueId??"");},[match]);
  async function save(){if(!supabase||!match)return;const{error}=await supabase.from("matches").update({match_date:date,match_time:time||null,venue_id:venueId||null}).eq("id",match.id);if(error)onNotice(error.message);else onSaved();}
  return <Dialog open={!!match} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{t("action.save")} · {match?.home} — {match?.away}</DialogTitle></DialogHeader><div className="form-grid"><label>{t("field.date")}<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>{t("field.time")}<Input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label className="wide">{t("field.venue")}<NativeSelect value={venueId} onChange={e=>setVenueId(e.target.value)}><NativeSelectOption value="">{t("common.defaultHomeVenue")}</NativeSelectOption>{venues.map(v=><NativeSelectOption key={v.id} value={v.id}>{v.name}</NativeSelectOption>)}</NativeSelect></label></div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button className="red-button" onClick={()=>void save()}>{t("action.save")}</Button></DialogFooter></DialogContent></Dialog>;
}

function EditTeamDialog({team,venues,clubs,competitionId,competitionName,admin,onClose,onSaved,onNotice,t}:{team:Team|null;venues:Venue[];clubs:Club[];competitionId:string;competitionName:string;admin:boolean;onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void;t:Translator}){
  const[form,setForm]=useState({clubId:"",venueId:"",contact:"",phone:"",email:"",note:"",archiveReason:""});
  useEffect(()=>{setForm({clubId:team?.clubId??"",venueId:team?.defaultVenueId??"",contact:team?.contact??"",phone:team?.phone??"",email:team?.email??"",note:team?.note??"",archiveReason:team?.archivedReason??""});},[team]);
  async function save(){if(!supabase||!team)return;const club=clubs.find(c=>c.id===form.clubId);const{error}=await supabase.from("teams").update({club_id:form.clubId||null,club_name:club?.name??(form.clubId?team.club:""),default_venue_id:form.venueId||null,contact_name:form.contact,phone:form.phone,email:form.email,note:form.note}).eq("id",team.id);if(error)onNotice(error.message);else onSaved();}
  async function archive(){if(!supabase||!team||!window.confirm(t("archive.confirmTeam",{name:team.name})))return;const{error}=await supabase.from("teams").update({is_active:false,archived_at:new Date().toISOString(),archived_reason:form.archiveReason.trim()}).eq("id",team.id);if(error)onNotice(error.message);else onSaved();}
  async function removeFromLeague(){if(!supabase||!team||!competitionId||!window.confirm(t("archive.confirmRemoveLeague",{name:team.name,league:competitionName})))return;const{error}=await supabase.from("competition_teams").delete().eq("competition_id",competitionId).eq("team_id",team.id);if(error)onNotice(error.message);else onSaved();}
  return <Dialog open={!!team} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{t("team.editTitle")} · {team?.name}</DialogTitle><DialogDescription>{t("team.editDescription")}</DialogDescription></DialogHeader><div className="form-grid"><label>{t("field.club")}<NativeSelect disabled={!admin} value={form.clubId} onChange={e=>setForm({...form,clubId:e.target.value})}><NativeSelectOption value="">—</NativeSelectOption>{clubs.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></label><label>{t("field.contact")}<Input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></label><label>{t("field.phone")}<Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>E-mail<Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className="wide">{t("field.venue")}<NativeSelect value={form.venueId} onChange={e=>setForm({...form,venueId:e.target.value})}><NativeSelectOption value="">—</NativeSelectOption>{venues.map(v=><NativeSelectOption key={v.id} value={v.id}>{v.name}</NativeSelectOption>)}</NativeSelect></label><label className="wide">{t("field.note")}<Input value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><label className="wide">{t("archive.reason")}<Input value={form.archiveReason} onChange={e=>setForm({...form,archiveReason:e.target.value})} placeholder={t("archive.reasonPlaceholder")}/></label></div><div className="danger-actions">{admin&&team?.competitionIds.includes(competitionId)&&<Button variant="outline" onClick={()=>void removeFromLeague()}>{t("archive.removeFromLeague")}</Button>}<Button className="red-button" onClick={()=>void archive()}><Archive/>{t("archive.team")}</Button></div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button onClick={()=>void save()}>{t("action.save")}</Button></DialogFooter></DialogContent></Dialog>;
}

function EditClubDialog({club,teams,onClose,onSaved,onNotice,t}:{club:Club|null;teams:Team[];onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void;t:Translator}){
  const[form,setForm]=useState({contact:"",phone:"",email:"",note:"",archiveReason:""});
  useEffect(()=>{setForm({contact:club?.contact??"",phone:club?.phone??"",email:club?.email??"",note:club?.note??"",archiveReason:club?.archivedReason??""});},[club]);
  async function save(){if(!supabase||!club)return;const{error}=await supabase.from("clubs").update({contact_name:form.contact,phone:form.phone,email:form.email,note:form.note}).eq("id",club.id);if(error)onNotice(error.message);else onSaved();}
  async function archive(){if(!supabase||!club||!window.confirm(t("archive.confirmClub",{name:club.name})))return;const now=new Date().toISOString();const reason=form.archiveReason.trim();const activeTeamIds=teams.filter(team=>team.clubId===club.id&&team.active).map(team=>team.id);if(activeTeamIds.length){const teamResult=await supabase.from("teams").update({is_active:false,archived_at:now,archived_reason:reason}).in("id",activeTeamIds);if(teamResult.error){onNotice(teamResult.error.message);return;}}const{error}=await supabase.from("clubs").update({is_active:false,archived_at:now,archived_reason:reason}).eq("id",club.id);if(error)onNotice(error.message);else onSaved();}
  return <Dialog open={!!club} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{t("club.editTitle")} · {club?.name}</DialogTitle><DialogDescription>{t("club.editDescription")}</DialogDescription></DialogHeader><div className="form-grid"><label>{t("field.contact")}<Input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></label><label>{t("field.phone")}<Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>E-mail<Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className="wide">{t("field.note")}<Input value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><label className="wide">{t("archive.reason")}<Input value={form.archiveReason} onChange={e=>setForm({...form,archiveReason:e.target.value})} placeholder={t("archive.reasonPlaceholder")}/></label></div><div className="danger-actions"><Button className="red-button" onClick={()=>void archive()}><Archive/>{t("archive.club")}</Button></div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button onClick={()=>void save()}>{t("action.save")}</Button></DialogFooter></DialogContent></Dialog>;
}
function ArchiveDialog({open,onClose,teams,clubs,organizationAdmin,editableTeams,managedClubIds,onSaved,onNotice,t}:{open:boolean;onClose:()=>void;teams:Team[];clubs:Club[];organizationAdmin:boolean;editableTeams:string[];managedClubIds:string[];onSaved:()=>Promise<void>;onNotice:(s:string)=>void;t:Translator}){
  const archivedTeams=teams.filter(team=>!team.active&&(organizationAdmin||editableTeams.includes(team.id)||managedClubIds.includes(team.clubId)));
  const archivedClubs=clubs.filter(club=>!club.active&&(organizationAdmin||managedClubIds.includes(club.id)));
  async function restoreTeam(team:Team){if(!supabase)return;const{error}=await supabase.from("teams").update({is_active:true,archived_at:null,archived_reason:""}).eq("id",team.id);if(error)onNotice(error.message);else await onSaved();}
  async function restoreClub(club:Club){if(!supabase)return;const{error}=await supabase.from("clubs").update({is_active:true,archived_at:null,archived_reason:""}).eq("id",club.id);if(error)onNotice(error.message);else await onSaved();}
  return <Dialog open={open} onOpenChange={value=>!value&&onClose()}><DialogContent className="access-dialog"><DialogHeader><DialogTitle>{t("archive.title")}</DialogTitle><DialogDescription>{t("archive.description")}</DialogDescription></DialogHeader><section className="access-section"><h3>{t("archive.teams")}</h3><div className="user-list">{archivedTeams.length?archivedTeams.map(team=><div className="managed-user" key={team.id}><div><b>{team.name}</b><span>{team.archivedReason||t("archive.noReason")}</span></div><Button variant="outline" onClick={()=>void restoreTeam(team)}><RotateCcw/>{t("archive.restore")}</Button></div>):<Empty>{t("archive.emptyTeams")}</Empty>}</div></section><section className="access-section"><h3>{t("archive.clubs")}</h3><div className="user-list">{archivedClubs.length?archivedClubs.map(club=><div className="managed-user" key={club.id}><div><b>{club.name}</b><span>{club.archivedReason||t("archive.noReason")}</span></div><Button variant="outline" onClick={()=>void restoreClub(club)}><RotateCcw/>{t("archive.restore")}</Button></div>):<Empty>{t("archive.emptyClubs")}</Empty>}</div></section><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.close")}</Button></DialogFooter></DialogContent></Dialog>;
}

function EditVenueDialog({venue,onClose,onSaved,onNotice,t}:{venue:Venue|null;onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void;t:Translator}){
  const[form,setForm]=useState({address:"",contact:"",phone:"",email:"",map:"",note:""});
  useEffect(()=>{setForm({address:venue?.address??"",contact:venue?.contact??"",phone:venue?.phone??"",email:venue?.email??"",map:venue?.map??"",note:venue?.note??""});},[venue]);
  async function save(){if(!supabase||!venue)return;const{error}=await supabase.from("venues").update({address:form.address,contact_name:form.contact,phone:form.phone,email:form.email,map_url:form.map,note:form.note}).eq("id",venue.id);if(error)onNotice(error.message);else onSaved();}
  return <Dialog open={!!venue} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{t("action.save")} · {venue?.name}</DialogTitle></DialogHeader><div className="form-grid"><label className="wide">Address<Input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><label>Contact<Input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></label><label>Phone<Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>E-mail<Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Google Maps<Input value={form.map} onChange={e=>setForm({...form,map:e.target.value})}/></label><label className="wide">{t("field.note")}<Input value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button className="red-button" onClick={()=>void save()}>{t("action.save")}</Button></DialogFooter></DialogContent></Dialog>;
}

function BookingDialog({open,venue,organizationId,onClose,onSaved,onNotice,t}:{open:boolean;venue:Venue|undefined;organizationId:string;onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void;t:Translator}){
  const[form,setForm]=useState({date:"",start:"",end:"",title:"",organizer:"",note:""});
  useEffect(()=>{if(!open)setForm({date:"",start:"",end:"",title:"",organizer:"",note:""});},[open]);
  async function save(){if(!supabase||!venue||!form.date||!form.title.trim()){onNotice(t("booking.required"));return;}const{error}=await supabase.from("venue_bookings").insert({organization_id:organizationId,venue_id:venue.id,event_date:form.date,start_time:form.start||null,end_time:form.end||null,title:form.title.trim(),organizer:form.organizer.trim(),note:form.note.trim()});if(error)onNotice(error.message);else onSaved();}
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{t("booking.title")} · {venue?.name}</DialogTitle><DialogDescription>{t("booking.description")}</DialogDescription></DialogHeader><div className="form-grid"><label>{t("field.date")}<Input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>{t("field.time")}<Input type="time" value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></label><label>{t("field.endTime")}<Input type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></label><label>{t("field.organizer")}<Input value={form.organizer} onChange={e=>setForm({...form,organizer:e.target.value})}/></label><label className="wide">{t("field.title")}<Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label className="wide">{t("field.note")}<Input value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button className="red-button" onClick={()=>void save()}>{t("action.save")}</Button></DialogFooter></DialogContent></Dialog>;
}

function PermissionsDialog({open,onClose,organizationId,teams,clubs,onNotice,t}:{open:boolean;onClose:()=>void;organizationId:string;teams:Team[];clubs:Club[];onNotice:(s:string)=>void;t:Translator}){
  const[email,setEmail]=useState("");const[teamId,setTeamId]=useState("");const[managerEmail,setManagerEmail]=useState("");const[clubId,setClubId]=useState("");const[adminEmail,setAdminEmail]=useState("");const[captains,setCaptains]=useState<Captain[]>([]);const[managers,setManagers]=useState<ClubManager[]>([]);const[admins,setAdmins]=useState<OrganizationAdmin[]>([]);const[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{if(!supabase)return;const[c,m,a]=await Promise.all([supabase.from("team_editors").select("team_id,email,app_users(user_id)"),supabase.from("club_managers").select("club_id,email,app_users(user_id)"),supabase.from("organization_admins").select("email,app_users(user_id)").eq("organization_id",organizationId)]);if(c.error||m.error||a.error){onNotice(c.error?.message??m.error?.message??a.error?.message??"");return;}setCaptains((c.data??[]).filter((x:any)=>teams.some(team=>team.id===x.team_id)).map((x:any)=>({team_id:x.team_id,email:x.email,user_id:x.app_users?.user_id??null,team_name:teams.find(team=>team.id===x.team_id)?.name??"—"})));setManagers((m.data??[]).filter((x:any)=>clubs.some(club=>club.id===x.club_id)).map((x:any)=>({club_id:x.club_id,email:x.email,user_id:x.app_users?.user_id??null,club_name:clubs.find(club=>club.id===x.club_id)?.name??"—"})));setAdmins((a.data??[]).map((x:any)=>({email:x.email,user_id:x.app_users?.user_id??null})));},[organizationId,teams,clubs,onNotice]);
  useEffect(()=>{if(open){setTeamId(teams[0]?.id??"");setClubId(clubs[0]?.id??"");void load();}},[open,teams,clubs,load]);
  async function ensureUser(targetEmail:string,roleName:string){if(!supabase)return false;const normalized=targetEmail.trim().toLowerCase();const result=await supabase.from("app_users").upsert({email:normalized,role:roleName},{onConflict:"email",ignoreDuplicates:true});if(result.error){onNotice(result.error.message);return false;}return true;}
  async function sendMail(targetEmail:string){if(!supabase)return;await supabase.auth.signInWithOtp({email:targetEmail.trim().toLowerCase(),options:{emailRedirectTo:window.location.origin+window.location.pathname}});}
  async function add(kind:"admin"|"manager"|"captain"){if(!supabase)return;setBusy(true);const target=kind==="admin"?adminEmail:kind==="manager"?managerEmail:email;const roleName=kind==="admin"?"organization_admin":kind==="manager"?"club_manager":"captain";if(await ensureUser(target,roleName)){const normalized=target.trim().toLowerCase();const result=kind==="admin"?await supabase.from("organization_admins").upsert({organization_id:organizationId,email:normalized},{onConflict:"organization_id,email",ignoreDuplicates:true}):kind==="manager"?await supabase.from("club_managers").upsert({club_id:clubId,email:normalized},{onConflict:"club_id,email",ignoreDuplicates:true}):await supabase.from("team_editors").upsert({team_id:teamId,email:normalized},{onConflict:"team_id,email",ignoreDuplicates:true});if(result.error)onNotice(result.error.message);else{await sendMail(normalized);setAdminEmail("");setManagerEmail("");setEmail("");await load();}}setBusy(false);}
  async function remove(table:string,filters:Record<string,string>){if(!supabase)return;let query=supabase.from(table).delete();Object.entries(filters).forEach(([key,value])=>{query=query.eq(key,value);});const result=await query;if(result.error)onNotice(result.error.message);else await load();}
  const state=(userId:string|null)=>userId?t("permissions.confirmed"):t("permissions.pending");
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="access-dialog"><DialogHeader><DialogTitle>{t("permissions.title")}</DialogTitle><DialogDescription>{t("permissions.description")}</DialogDescription></DialogHeader><AccessSection title={t("permissions.orgAdmins")} input={adminEmail} setInput={setAdminEmail} select={null} onAdd={()=>void add("admin")} busy={busy} users={admins.map(a=>({key:a.email,email:a.email,label:state(a.user_id),remove:()=>void remove("organization_admins",{organization_id:organizationId,email:a.email})}))} t={t}/><AccessSection title={t("permissions.clubManagers")} input={managerEmail} setInput={setManagerEmail} select={<NativeSelect value={clubId} onChange={e=>setClubId(e.target.value)}>{clubs.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect>} onAdd={()=>void add("manager")} busy={busy} users={managers.map(m=>({key:`${m.club_id}-${m.email}`,email:m.email,label:`${m.club_name} · ${state(m.user_id)}`,remove:()=>void remove("club_managers",{club_id:m.club_id,email:m.email})}))} t={t}/><AccessSection title={t("permissions.captains")} input={email} setInput={setEmail} select={<NativeSelect value={teamId} onChange={e=>setTeamId(e.target.value)}>{teams.map(team=><NativeSelectOption key={team.id} value={team.id}>{team.name}</NativeSelectOption>)}</NativeSelect>} onAdd={()=>void add("captain")} busy={busy} users={captains.map(c=>({key:`${c.team_id}-${c.email}`,email:c.email,label:`${c.team_name} · ${state(c.user_id)}`,remove:()=>void remove("team_editors",{team_id:c.team_id,email:c.email})}))} t={t}/><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.close")}</Button></DialogFooter></DialogContent></Dialog>;
}

function AccessSection({title,input,setInput,select,onAdd,busy,users,t}:{title:string;input:string;setInput:(v:string)=>void;select:React.ReactNode;onAdd:()=>void;busy:boolean;users:{key:string;email:string;label:string;remove:()=>void}[];t:Translator}){return <section className="access-section"><h3>{title}</h3><div className="captain-add"><Input type="email" value={input} onChange={e=>setInput(e.target.value)} placeholder="name@example.com"/>{select??<span/>}<Button disabled={busy||!input} className="red-button" onClick={onAdd}><ShieldCheck/>{t("action.add")}</Button></div><div className="user-list">{users.map(user=><div className="managed-user" key={user.key}><div><b>{user.email}</b><span>{user.label}</span></div><Button variant="ghost" onClick={user.remove}>{t("action.remove")}</Button></div>)}</div></section>}

function OrganizationsDialog({open,onClose,onSaved,onNotice,t}:{open:boolean;onClose:()=>void;onSaved:()=>void;onNotice:(s:string)=>void;t:Translator}){
  const[form,setForm]=useState({name:"",slug:"",country:"HR",language:"en",email:""});const[busy,setBusy]=useState(false);
  async function save(){if(!supabase||!form.name.trim()||!form.slug.trim()||!form.email.trim())return;setBusy(true);const org=await supabase.from("organizations").insert({name:form.name.trim(),slug:normalizeHeader(form.slug).replaceAll(" ","-"),country_code:form.country.toUpperCase(),default_language:form.language}).select("id").single();if(org.error){onNotice(org.error.message);setBusy(false);return;}const email=form.email.trim().toLowerCase();const user=await supabase.from("app_users").upsert({email,role:"organization_admin"},{onConflict:"email",ignoreDuplicates:true});if(user.error){onNotice(user.error.message);setBusy(false);return;}const assignment=await supabase.from("organization_admins").insert({organization_id:org.data.id,email});if(assignment.error){onNotice(assignment.error.message);setBusy(false);return;}await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+window.location.pathname}});setBusy(false);onSaved();}
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{t("organizations.title")}</DialogTitle><DialogDescription>{t("organizations.description")}</DialogDescription></DialogHeader><div className="form-grid"><label className="wide">{t("organizations.name")}<Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>{t("organizations.code")}<Input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></label><label>Country<Input maxLength={2} value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/></label><label>Default language<NativeSelect value={form.language} onChange={e=>setForm({...form,language:e.target.value})}><NativeSelectOption value="hr">Hrvatski</NativeSelectOption><NativeSelectOption value="en">English</NativeSelectOption><NativeSelectOption value="de">Deutsch</NativeSelectOption></NativeSelect></label><label className="wide">{t("organizations.adminEmail")}<Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button className="red-button" disabled={busy} onClick={()=>void save()}>{t("action.add")}</Button></DialogFooter></DialogContent></Dialog>;
}

function ImportDialog({open,onClose,data,organizationId,admin,editableTeams,managedClubIds,onSaved,onNotice,t}:{open:boolean;onClose:()=>void;data:SchedulerData;organizationId:string;admin:boolean;editableTeams:string[];managedClubIds:string[];onSaved:(n:number)=>void;onNotice:(s:string)=>void;t:Translator}){
  const[rows,setRows]=useState<ExcelImportRow[]>([]);const[fileName,setFileName]=useState("");const[busy,setBusy]=useState(false);const templateHref=`${process.env.NEXT_PUBLIC_BASE_PATH||""}/DartsScheduler_import_template.xlsx`;
  useEffect(()=>{if(!open){setRows([]);setFileName("");setBusy(false);}},[open]);
  const permitted=new Set([...editableTeams,...data.teams.filter(team=>managedClubIds.includes(team.clubId)).map(team=>team.id)]);
  const textValue=(value:unknown)=>String(value??"").trim();
  function excelDate(value:unknown,XLSX:any){if(value instanceof Date&&!Number.isNaN(value.getTime()))return dateKey(value);if(typeof value==="number"){const parsed=XLSX.SSF.parse_date_code(value);if(parsed)return`${parsed.y}-${String(parsed.m).padStart(2,"0")}-${String(parsed.d).padStart(2,"0")}`;}const valueString=textValue(value);let match=valueString.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);if(match)return`${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;match=valueString.match(/^(\d{4})-(\d{2})-(\d{2})/);return match?`${match[1]}-${match[2]}-${match[3]}`:"";}
  function excelTime(value:unknown,XLSX:any){if(value instanceof Date)return`${String(value.getHours()).padStart(2,"0")}:${String(value.getMinutes()).padStart(2,"0")}`;if(typeof value==="number")return XLSX.SSF.format("hh:mm",value);const match=textValue(value).match(/(\d{1,2}):(\d{2})/);return match?`${match[1].padStart(2,"0")}:${match[2]}`:"";}
  async function readFile(file:File){const XLSX=await import("xlsx");const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});const sheetName=["Utakmice","Matches","Spiele"].find(name=>workbook.SheetNames.includes(name))??workbook.SheetNames[0];const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(workbook.Sheets[sheetName],{defval:"",raw:true});const parsed=raw.map((source,index)=>{const normalized=new Map(Object.entries(source).map(([key,value])=>[normalizeHeader(key),value]));const get=(...keys:string[])=>keys.map(key=>normalized.get(normalizeHeader(key))).find(value=>value!==undefined&&value!=="")??"";const row:ExcelImportRow={row:index+2,id:textValue(get("ID","Identifikator")),season:textValue(get("Sezona","Season","Saison")),league:textValue(get("Liga","Natjecanje","League","Competition","Wettbewerb")),date:excelDate(get("Datum","Date"),XLSX),time:excelTime(get("Vrijeme","Time","Uhrzeit"),XLSX),home:textValue(get("Domaćin","Domacin","Doma","Home","Home team","Heimteam")),away:textValue(get("Gost","Away","Away team","Gastteam")),round:textValue(get("Kolo","Round","Runde")),venue:textValue(get("Lokacija","Mjesto","Venue","Spielort")),note:textValue(get("Napomena","Note","Notiz")),error:""};const errors:string[]=[];if(!row.season)errors.push("season");if(!row.league)errors.push("league");if(!row.date)errors.push("date");if(!row.home)errors.push("home team");if(!row.away)errors.push("away team");if(row.home&&row.away&&normalizeHeader(row.home)===normalizeHeader(row.away))errors.push("same teams");if(!admin){const season=data.seasons.find(s=>normalizeHeader(s.name)===normalizeHeader(row.season));const competition=data.competitions.find(c=>c.seasonId===season?.id&&normalizeHeader(c.name)===normalizeHeader(row.league));const home=data.teams.find(team=>normalizeHeader(team.name)===normalizeHeader(row.home));const away=data.teams.find(team=>normalizeHeader(team.name)===normalizeHeader(row.away));if(!competition)errors.push("unknown competition");if(!home||!away)errors.push("unknown team");else if(!permitted.has(home.id)&&!permitted.has(away.id))errors.push("no permission");if(row.venue&&!data.venues.some(v=>normalizeHeader(v.name)===normalizeHeader(row.venue)))errors.push("unknown venue");}row.error=errors.join(", ");return row;});setRows(parsed);setFileName(file.name);}
  async function importRows(){if(!supabase||!rows.length||rows.some(row=>row.error))return;setBusy(true);let count=0;const seasons=new Map(data.seasons.map(s=>[normalizeHeader(s.name),s.id]));const competitions=new Map(data.competitions.map(c=>[`${c.seasonId}|${normalizeHeader(c.name)}`,c.id]));const teams=new Map(data.teams.map(team=>[normalizeHeader(team.name),team.id]));const venues=new Map(data.venues.map(v=>[normalizeHeader(v.name),v.id]));const slug=(value:string)=>normalizeHeader(value).replaceAll(" ","-").slice(0,60);
    for(const row of rows){let seasonId=seasons.get(normalizeHeader(row.season));if(!seasonId&&admin){const result=await supabase.from("seasons").insert({organization_id:organizationId,name:row.season,is_active:false}).select("id").single();if(result.error){onNotice(result.error.message);setBusy(false);return;}seasonId=result.data.id as string;seasons.set(normalizeHeader(row.season),seasonId);}if(!seasonId)continue;let competitionId=competitions.get(`${seasonId}|${normalizeHeader(row.league)}`);if(!competitionId&&admin){const result=await supabase.from("competitions").insert({organization_id:organizationId,season_id:seasonId,name:row.league,external_id:`excel-${slug(row.league)}`}).select("id").single();if(result.error){onNotice(result.error.message);setBusy(false);return;}competitionId=result.data.id as string;competitions.set(`${seasonId}|${normalizeHeader(row.league)}`,competitionId);}if(!competitionId)continue;
      async function ensureTeam(name:string){let id=teams.get(normalizeHeader(name));if(!id&&admin){const result=await supabase!.from("teams").insert({organization_id:organizationId,name}).select("id").single();if(result.error)throw result.error;id=result.data.id as string;teams.set(normalizeHeader(name),id);}return id;}
      let homeId:string|undefined,awayId:string|undefined;try{homeId=await ensureTeam(row.home);awayId=await ensureTeam(row.away);}catch(error:any){onNotice(error.message);setBusy(false);return;}if(!homeId||!awayId)continue;let venueId=row.venue?venues.get(normalizeHeader(row.venue)):undefined;if(row.venue&&!venueId&&admin){const result=await supabase.from("venues").insert({organization_id:organizationId,name:row.venue}).select("id").single();if(result.error){onNotice(result.error.message);setBusy(false);return;}venueId=result.data.id as string;venues.set(normalizeHeader(row.venue),venueId);}if(admin){const membership=await supabase.from("competition_teams").upsert([{competition_id:competitionId,team_id:homeId},{competition_id:competitionId,team_id:awayId}],{onConflict:"competition_id,team_id",ignoreDuplicates:true});if(membership.error){onNotice(membership.error.message);setBusy(false);return;}}
      const external=row.id||`excel:${slug(row.season)}:${slug(row.league)}:${slug(row.round||row.date)}:${slug(row.home)}:${slug(row.away)}`;const payload={organization_id:organizationId,match_date:row.date,match_time:row.time||null,home_team_id:homeId,away_team_id:awayId,venue_id:venueId||null,competition_id:competitionId,external_event_id:external,league:row.league,round_name:row.round,note:row.note};const existing=await supabase.from("matches").select("id").eq("competition_id",competitionId).eq("external_event_id",external).maybeSingle();const saved=existing.data?.id?await supabase.from("matches").update(payload).eq("id",existing.data.id):await supabase.from("matches").insert(payload);if(saved.error){onNotice(saved.error.message);setBusy(false);return;}count++;
    }setBusy(false);onSaved(count);
  }
  const errors=rows.filter(row=>row.error);return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="import-dialog"><DialogHeader><DialogTitle>{t("import.title")}</DialogTitle><DialogDescription>{t("import.description")}</DialogDescription></DialogHeader><div className="import-actions"><Input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file);}}/><a className="template-link" href={templateHref} download>{t("import.template")}</a></div>{fileName&&<div className={`import-summary ${errors.length?"has-errors":"ready"}`}><b>{fileName}</b><span>{rows.length} · {errors.length?`${errors.length} errors`:t("import.ready")}</span></div>}<div className="import-preview">{rows.slice(0,12).map(row=><div key={row.row} className={row.error?"bad":""}><b>{t("import.row")} {row.row}</b><span>{row.date} {row.time} · {row.home} — {row.away}</span><small>{row.error||`${row.season} · ${row.league} · ${row.round}`}</small></div>)}</div><DialogFooter><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button><Button className="red-button" disabled={busy||!rows.length||!!errors.length} onClick={()=>void importRows()}><Upload/>{busy?t("import.busy"):t("import.button")}</Button></DialogFooter></DialogContent></Dialog>;
}
