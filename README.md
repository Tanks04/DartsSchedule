# DartsScheduler

**DartsScheduler** je javni raspored namijenjen praćenju lokalnih pikado liga, timova i mjesta na kojima se igraju utakmice.

U aplikaciji možete:

- odabrati savez ili organizaciju čiji raspored pratite;
- odabrati ligu i tim koji pratite;
- pregledati sljedeću utakmicu i cijeli raspored ekipe;
- provjeriti kada je određeno mjesto slobodno ili zauzeto;
- vidjeti utakmice svih liga koje se igraju na istoj lokaciji;
- otvoriti poseban kalendar HPS i PSGZ Mastersa, filtriran po organizatoru i vrsti pikada;
- otvoriti adresu i kontaktne podatke kluba kada su dostupni.
- koristiti sučelje na hrvatskom, engleskom ili njemačkom jeziku.

Aplikacija pamti odabranu ligu, tim i lokaciju na vašem uređaju. Pri sljedećem otvaranju odmah prikazuje raspored koji pratite.

Možete uključiti i lokalne obavijesti za jedan tim ili cijeli klub te za nadolazeće Masterse. One se provjeravaju samo kada otvorite aplikaciju; DartsScheduler ne radi u pozadini. Pojedinu obavijest moguće je označiti pročitanom ili trajno utišati na tom uređaju.

## Otvori aplikaciju

**[Pokreni DartsScheduler](https://tanks04.github.io/DartsSchedule/)**

Za pregledavanje nije potrebna registracija.

## Instalacija na mobitel

DartsScheduler je web-aplikacija. Ne preuzima se iz trgovine, nego se s početne stranice može dodati na zaslon mobitela i zatim otvarati poput obične aplikacije.

### Android

1. Otvorite DartsScheduler u Chromeu.
2. Dodirnite izbornik s tri točke.
3. Odaberite **Dodaj na početni zaslon** ili **Instaliraj aplikaciju**.
4. Potvrdite instalaciju.

### iPhone i iPad

1. Otvorite DartsScheduler u Safariju.
2. Dodirnite gumb **Dijeli**.
3. Odaberite **Dodaj na početni zaslon**.
4. Dodirnite **Dodaj**.

### Računalo

Aplikaciju možete koristiti izravno u pregledniku. Chrome i Edge također mogu ponuditi gumb za instalaciju u adresnoj traci.

## Upute za gledatelje

1. Odaberite **ligu**.
2. Odaberite **tim** koji želite pratiti.
3. Na vrhu se prikazuje najvažnija aktualna informacija, a gumb **Raspored** otvara cijelu sezonu.
4. U prikazu lokacije možete provjeriti je li mjesto slobodno ili zauzeto. Zauzetost se računa prema utakmicama iz svih liga, ne samo prema trenutno odabranoj ligi.
5. Odabir se automatski pamti samo na uređaju na kojem ste ga napravili. U postavkama ga možete naknadno promijeniti.

Ako utakmica nema navedenu lokaciju, to znači da mjesto igranja još nije uneseno ili potvrđeno.

Rezervacije turnira, Mastersa i drugih događaja također označavaju lokaciju zauzetom, ali se ne prikazuju kao ligaške utakmice.

## Prijava

Prijava je potrebna samo korisnicima koji trebaju uređivati podatke.

1. U aplikaciji otvorite **Urednik** odnosno **Prijava**.
2. Upišite svoju e-mail adresu.
3. Otvorite jednokratnu poveznicu koja stiže e-mailom.
4. Nakon prve prijave i dalje imate prava gledatelja dok vam administrator ne dodijeli odgovarajuću ovlast.

Sama prijava ne omogućuje mijenjanje rasporeda.

## Kapetani i voditelji klubova

Za dobivanje prava uređivanja javite administratoru:

- e-mail adresu kojom ste se prijavili u aplikaciju;
- naziv svojeg tima ili kluba;
- trebate li prava **kapetana tima** ili **voditelja kluba**.

Administrator zatim povezuje vaš korisnički račun s odgovarajućim timom ili klubom.

### Kapetan tima

Kapetan može:

- uređivati podatke svojeg tima;
- postaviti domaću lokaciju i kontaktne podatke;
- mijenjati datum, vrijeme, lokaciju i napomenu utakmica svojeg tima;
- uvesti utakmice svojeg tima iz Excel ili CSV datoteke;
- izvesti raspored odabranog tima u Excel.

Za jedan tim mogu se dodijeliti najviše dva kapetana.

### Voditelj kluba

Voditelj kluba može uređivati sve timove i lokacije povezane sa svojim klubom. To je namijenjeno osobama koje vode prostor ili klub u kojem igra više različitih ekipa.

Voditelj može uređivati rasporede i podatke tih timova, uvoziti njihove utakmice iz Excel ili CSV datoteke te arhivirati tim ili klub koji više ne sudjeluje. Arhiviranje ne briše stare utakmice.

### Administrator

Administrator organizacije upravlja ligama, sezonama, timovima, klubovima, lokacijama i korisničkim ovlastima svojeg saveza. Može uvesti cijele rasporede i otvoriti novu sezonu ili ligu.

Platform administrator otvara nove organizacije i pomaže kod oporavka pristupa, ali administratori pojedinih saveza samostalno vode svoje podatke.

## Uređivanje tima i kluba

Nakon prijave odaberite ligu i tim. Ispod izbornika pojavljuju se jasno označene uredničke mogućnosti:

- **Uredi odabrani tim** – kontakt, klub, domaća lokacija i napomena;
- **Uredi klub** – kontaktni podaci odabranog kluba;
- **Arhiva** – pregled i vraćanje timova i klubova koji više nisu aktivni.

Kapetan vidi uređivanje svojeg tima. Voditelj kluba može uređivati klub i sve njegove timove. Administrator organizacije može tim premjestiti u drugi klub ili ukloniti iz odabrane lige.

## Uklanjanje iz lige i arhiviranje

**Ukloni iz odabrane lige** uklanja samo članstvo tima u toj ligi. Tim, klub i već unesene utakmice ostaju sačuvani.

**Arhiviraj tim** koristi se kada tim prestane djelovati ili bude isključen iz natjecanja. Tim nestaje iz aktivnih izbornika, a njegove buduće utakmice više ne zauzimaju lokaciju. Stare utakmice ostaju u povijesti.

**Arhiviraj klub i njegove timove** arhivira klub i sve njegove aktivne timove. Preporučuje se upisati razlog arhiviranja. Sve se kasnije može vratiti kroz prozor **Arhiva**.

Trajno brisanje nije dostupno u uobičajenom sučelju jer bi moglo obrisati rasporede i povijesne podatke.

## Važno kod izmjena

Promjena utakmice nije privatna bilješka. Promijenjeni datum, vrijeme ili lokacija odmah postaju vidljivi svim korisnicima i utječu na:

- raspored oba tima;
- raspored odabrane lige;
- zauzetost mjesta na kojem se igra;
- prikaz svih drugih timova koji koriste istu lokaciju.

Zato prije spremanja treba provjeriti da je promjena dogovorena i točno unesena.

## Uvoz i izvoz Excela

Uvoz i izvoz dostupni su kapetanima, voditeljima klubova i administratorima. Gledatelji nemaju te gumbe.

Predložak za unos novih sezona može se preuzeti iz prozora **Uvezi Excel**. Aplikacija obrađuje list **Utakmice** sa stupcima:

`ID | Sezona | Liga | Datum | Vrijeme | Domaćin | Gost | Kolo | Lokacija | Napomena`

Obavezni su sezona, liga, datum, domaćin i gost. Prije uvoza aplikacija prikazuje pregled i prijavljuje retke koje ne može prihvatiti.
Primjer excela nalazi se skupa sa Source Kodom.

## Podaci i točnost

Početni rasporedi preuzeti su sa službene stranice Pikado saveza Grada Zagreba. Lokacije, kontakti i naknadne promjene termina dopunjuju ovlašteni kapetani, voditelji klubova i administratori.

Ako primijetite pogrešan termin, tim ili lokaciju, javite se kapetanu ekipe ili administratoru aplikacije.

## Mastersi i događaji

Gumb **Mastersi** otvara zajednički kalendar službenih HPS i PSGZ natjecanja. Moguće je odvojiti elektronski pikado od klasičnog/steel pikada te prikazati i prošle događaje. Podaci sadrže poveznicu na službeni izvor. Ako novi HPS raspored još nije objavljen, aplikacija ga ne pokušava nagađati; administrator može događaj dodati ručno ili ga preuzeti nakon objave.

Administrator u istom prozoru može odabrati **Provjeri sada**. Aplikacija prikazuje koliko je službenih događaja novo, promijenjeno ili nepromijenjeno, a u bazu se upisuju tek nakon potvrde. GitHub Actions posao `check-official-events.yml` provjerava izvore jednom dnevno i mijenja službenu snimku samo kada pronađe stvarnu razliku.

## Projekt

Izvorni kod: [github.com/Tanks04/DartsSchedule](https://github.com/Tanks04/DartsSchedule)

Potpune upute za instalaciju, nadogradnju, backup i oporavak nalaze se u [`COOKBOOK.md`](COOKBOOK.md).
