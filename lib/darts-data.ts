export type Organization = { id: string; name: string; slug: string; countryCode: string; defaultLanguage: string; website: string; logo: string; active: boolean };
export type Season = { id: string; organizationId: string; name: string; active: boolean };
export type Competition = { id: string; organizationId: string; seasonId: string; name: string; externalId: string };
export type Club = { id: string; organizationId: string; name: string; contact: string; phone: string; email: string; note: string; venueIds: string[]; active: boolean; archivedAt: string; archivedReason: string };
export type Match = {
  id: string; date: string; time: string; homeId: string; awayId: string;
  home: string; away: string; venueId: string; venue: string;
  organizationId: string; competitionId: string; competition: string; round: string; note: string; externalEventId: string;
};
export type Team = {
  id: string; organizationId: string; name: string; clubId: string; club: string; defaultVenueId: string; defaultVenue: string;
  contact: string; phone: string; email: string; note: string; competitionIds: string[]; active: boolean; archivedAt: string; archivedReason: string;
};
export type Venue = {
  id: string; organizationId: string; name: string; address: string; mine: boolean; contact: string;
  phone: string; email: string; map: string; note: string;
};
export type Change = {
  id: string; matchId: string; changedAt: string; changedBy: string;
  oldDate: string; newDate: string; oldTime: string; newTime: string;
  competition: string; home: string; away: string;
};
export type Booking = {
  id: string; organizationId: string; venueId: string; date: string; startTime: string;
  endTime: string; title: string; organizer: string; note: string;
};
export type SchedulerData = {
  organizations: Organization[]; seasons: Season[]; competitions: Competition[]; matches: Match[];
  clubs: Club[]; teams: Team[]; venues: Venue[]; changes: Change[]; bookings: Booking[];
};

export const seedData: SchedulerData = {
  organizations: [{ id: "org-psgz", name: "Pikado savez Grada Zagreba", slug: "psgz", countryCode: "HR", defaultLanguage: "hr", website: "https://psgz.hr/", logo: "", active: true }],
  seasons: [{ id: "season-2026", organizationId: "org-psgz", name: "2026./27.", active: true }],
  competitions: [
    "1. LIGA", "2. LIGA", "3. LIGA SKUPINA A", "3. LIGA SKUPINA B",
    "4. LIGA SKUPINA A", "4. LIGA SKUPINA B", "4. LIGA SKUPINA C", "KLASIČNA LIGA", "SENIORKE",
  ].map((name, i) => ({ id: `competition-${i + 1}`, organizationId: "org-psgz", seasonId: "season-2026", name, externalId: String(815 + i) })),
  matches: [], changes: [], bookings: [],
  clubs: [{ id: "club-a1", organizationId: "org-psgz", name: "PK A1", contact: "Željko Žitnik", phone: "", email: "", note: "", venueIds: ["venue-a1"], active: true, archivedAt: "", archivedReason: "" }],
  teams: [
    { id: "team-a1", organizationId: "org-psgz", name: "A1", clubId: "club-a1", club: "PK A1", defaultVenueId: "venue-a1", defaultVenue: "A1 – Cirkovci 72", contact: "", phone: "", email: "", note: "", competitionIds: ["competition-1"], active: true, archivedAt: "", archivedReason: "" },
    { id: "team-a1-otpisani", organizationId: "org-psgz", name: "A1 OTPISANI", clubId: "club-a1", club: "PK A1", defaultVenueId: "venue-a1", defaultVenue: "A1 – Cirkovci 72", contact: "", phone: "", email: "", note: "", competitionIds: ["competition-1"], active: true, archivedAt: "", archivedReason: "" },
  ],
  venues: [{ id: "venue-a1", organizationId: "org-psgz", name: "A1 – Cirkovci 72", address: "Cirkovci 72", mine: true, contact: "", phone: "", email: "", map: "", note: "" }],
};

export function actualVenue(match: Match, teams: Team[]) {
  if (match.venue.trim()) return match.venue.trim();
  return teams.find((team) => team.id === match.homeId)?.defaultVenue ?? "";
}
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function formatDate(value: string, long = false, locale = "hr-HR") {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, long
    ? { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
export function normalizeHeader(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
