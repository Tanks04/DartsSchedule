# DartsScheduler – administratorsko postavljanje

Ovaj dokument je za vlasnika instalacije i platform administratore. Javni korisnički opis nalazi se u `README.md`.

## Nadogradnja postojeće PSGZ instalacije

1. Napravite sigurnosnu kopiju Supabase baze.
2. U Supabase SQL Editoru pokrenite `supabase/upgrade_v7_organizations.sql`.
3. Prenesite v7 source na GitHub i pričekajte završetak Pages workflowa.
4. Odjavite se i ponovno prijavite jednokratnom e-mail poveznicom.

### Nadogradnja v7 na v8

Za podršku arhiviranju klubova i timova u Supabase SQL Editoru jednom pokrenite:

`supabase/upgrade_v8_archiving.sql`

Zatim objavite novi source na GitHub Pages. Migracija ne briše niti mijenja postojeće utakmice, timove ili klubove; samo dodaje status arhive i razlog arhiviranja.

Migracija postojeće podatke povezuje s organizacijom **Pikado savez Grada Zagreba**, postojeće administratore pretvara u platform administratore i zadržava kapetane i voditelje klubova.

## Potpuno nova instalacija

1. Otvorite novi Supabase projekt.
2. U SQL Editoru pokrenite `supabase/install_v7.sql`.
3. Postavite GitHub Pages varijable iz `.env.example`.
4. Objavite aplikaciju i jednom se prijavite svojom e-mail adresom.
5. U `supabase/bootstrap_platform_admin.sql` zamijenite `YOUR_EMAIL@example.com` svojom adresom i pokrenite datoteku.
6. Odjavite se i ponovno prijavite.
7. Otvorite **Organizacije**, dodajte prvi savez i njegovog administratora.

## Uloge

- Platform administrator otvara organizacije i služi kao sigurnosna mreža.
- Administrator organizacije upravlja samo svojim savezom i dodjeljuje niže ovlasti.
- Voditelj kluba upravlja povezanim timovima, lokacijama i rezervacijama.
- Kapetan upravlja svojim timom i utakmicama u kojima taj tim sudjeluje.
- Gledatelj nema prava zapisivanja.

Organizacija uvijek treba imati barem jednog administratora. Preporučena su dva.

## Timovi, lige i arhiva

- Kapetan može urediti i arhivirati svoj tim.
- Voditelj kluba može urediti ili arhivirati svoj klub i njegove timove.
- Administrator organizacije može tim premjestiti između klubova, ukloniti iz lige te arhivirati ili vratiti klubove i timove.
- Platform administrator ima ista prava u svim organizacijama.

Uklanjanje iz lige briše samo red iz `competition_teams`. Postojeće utakmice ostaju sačuvane.

Arhiviranje postavlja `is_active = false`, datum i razlog arhiviranja. Arhivirani podaci ostaju dostupni za povezivanje povijesnih utakmica, ali se ne prikazuju među aktivnim klubovima i timovima. Buduće utakmice arhiviranih timova ne računaju se u zauzetost lokacija.

Trajno brisanje namjerno nije ponuđeno kroz aplikaciju. Ako je zapis stvoren pogreškom i nema povezanih utakmica, platform administrator ga može ukloniti ručno tek nakon provjere svih stranih ključeva i sigurnosne kopije baze.

## Nova organizacija

Prvi administrator mora se barem jednom prijaviti u aplikaciju ili prihvatiti poveznicu koja mu stiže nakon dodavanja. Nakon dodjele može sam dodavati druge administratore, voditelje klubova i kapetane.

## Jezične datoteke

Upute za dodavanje jezika nalaze se u `TRANSLATIONS.md`.
