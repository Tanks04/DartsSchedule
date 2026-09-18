export type Match = {
  id: string;
  date: string;
  time: string;
  home: string;
  away: string;
  venue: string;
  league: string;
  round: string;
  note: string;
};

export type Team = {
  id: string;
  name: string;
  club: string;
  defaultVenue: string;
  contact: string;
  phone: string;
  email: string;
  note: string;
};

export type Venue = {
  id: string;
  name: string;
  address: string;
  mine: boolean;
  contact: string;
  phone: string;
  email: string;
  map: string;
  note: string;
};

export type SchedulerData = {
  matches: Match[];
  teams: Team[];
  venues: Venue[];
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const seedData: SchedulerData = {
  matches: [],
  teams: [
    { id: "team-billionaires", name: "BILLIONAIRES", club: "PK BILLIONAIRES", defaultVenue: "Zeverika 13", contact: "Emir Ždralović", phone: "+385 95 514 9114", email: "pikadoklubbillionaires@gmail.com", note: "" },
    { id: "team-sunset", name: "DC SUNSET", club: "PK ZALAZAK SUNCA", defaultVenue: "Zalazak sunca – A. T. Mimare 39A", contact: "Branislav Stanković", phone: "", email: "", note: "" },
    { id: "team-agram", name: "AGRAM DARTS TEAM", club: "PK 8 BALL", defaultVenue: "8 Ball – Kelekova 4", contact: "Zoran Milunović", phone: "", email: "", note: "" },
    { id: "team-a1", name: "A1", club: "PK A1", defaultVenue: "A1 – Cirkovci 72", contact: "Marko Pandža", phone: "", email: "", note: "" },
    { id: "team-janje-mix", name: "JANJE MIX TEAM", club: "PK JANJE", defaultVenue: "Janje – Mikulići 151", contact: "Mladen Havrin Gorenec", phone: "", email: "", note: "" },
    { id: "team-ipa", name: "IPA ZAGREB", club: "PK IPA ZAGREB", defaultVenue: "IPA Zagreb – Jelkovečka 1", contact: "Mateo Lasić", phone: "", email: "", note: "" },
    { id: "team-sesvete", name: "SESVETE", club: "PK SESVETE", defaultVenue: "Sesvete – Zagrebačka 26", contact: "Josip Penić", phone: "", email: "", note: "" },
    { id: "team-darts-point", name: "DARTS POINT TEAM BAN", club: "PK SESVETE", defaultVenue: "Zeverika 13", contact: "Željko Grubišić", phone: "", email: "", note: "" },
    { id: "team-dinamo", name: "DINAMO", club: "PK DINAMO", defaultVenue: "Dinamo – Lavoslava Ružičke 66", contact: "Slaven Kovačević", phone: "", email: "", note: "" },
    { id: "team-gospode", name: "GOSPOĐE", club: "PK QUATTRO SB", defaultVenue: "Sesvete – Zagrebačka 26", contact: "Mladen Boljat", phone: "", email: "", note: "" },
    { id: "team-a1-otpisani", name: "A1 OTPISANI", club: "PK A1", defaultVenue: "A1 – Cirkovci 72", contact: "Silvijo Sudec", phone: "", email: "", note: "" },
    { id: "team-janje-orion", name: "JANJE ORION", club: "PK JANJE", defaultVenue: "Janje – Mikulići 151", contact: "Hrvoje Dragičević", phone: "", email: "", note: "" },
    { id: "team-knezija", name: "KNEŽIJA DRINKING DWARVES", club: "PK KNEŽIJA", defaultVenue: "Knežija – Poljana Zvonimira Dražića 3", contact: "Bruno Šukara", phone: "", email: "", note: "" },
    { id: "team-panda", name: "PANDA RAVNICE", club: "CB PANDA", defaultVenue: "Panda – II Ravnice 11", contact: "Davor Ivanuš", phone: "", email: "", note: "" },
  ],
  venues: [
    { id: "venue-zeverika", name: "Zeverika 13", address: "Zeverika 13", mine: false, contact: "", phone: "", email: "", map: "", note: "Zajednička lokacija ekipa iz različitih klubova." },
    { id: "venue-sunset", name: "Zalazak sunca – A. T. Mimare 39A", address: "A. T. Mimare 39A", mine: false, contact: "", phone: "", email: "", map: "", note: "" },
    { id: "venue-8ball", name: "8 Ball – Kelekova 4", address: "Kelekova 4", mine: false, contact: "", phone: "", email: "", map: "", note: "Velik prostor; više ekipa ili klubova može koristiti istu lokaciju." },
    { id: "venue-a1", name: "A1 – Cirkovci 72", address: "Cirkovci 72", mine: true, contact: "", phone: "", email: "", map: "", note: "" },
    { id: "venue-janje", name: "Janje – Mikulići 151", address: "Mikulići 151", mine: false, contact: "", phone: "", email: "", map: "", note: "" },
    { id: "venue-ipa", name: "IPA Zagreb – Jelkovečka 1", address: "Jelkovečka 1", mine: false, contact: "", phone: "", email: "", map: "", note: "" },
    { id: "venue-sesvete", name: "Sesvete – Zagrebačka 26", address: "Zagrebačka 26, Sesvete", mine: false, contact: "", phone: "", email: "", map: "", note: "Lokaciju koriste ekipe iz različitih klubova." },
    { id: "venue-dinamo", name: "Dinamo – Lavoslava Ružičke 66", address: "Lavoslava Ružičke 66", mine: false, contact: "", phone: "", email: "", map: "", note: "" },
    { id: "venue-knezija", name: "Knežija – Poljana Zvonimira Dražića 3", address: "Poljana Zvonimira Dražića 3", mine: false, contact: "", phone: "", email: "", map: "", note: "" },
    { id: "venue-panda", name: "Panda – II Ravnice 11", address: "II Ravnice 11", mine: false, contact: "", phone: "", email: "", map: "", note: "Velik prostor; više ekipa ili klubova može koristiti istu lokaciju." },
  ],
};

export function actualVenue(match: Match, teams: Team[]) {
  if (match.venue.trim()) return match.venue.trim();
  return teams.find((team) => team.name === match.home)?.defaultVenue ?? "";
}

export function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(value: string, long = false) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("hr-HR", long
    ? { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }
  ).format(date);
}

export function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
