# DartsScheduler v7 – administratorsko postavljanje

Ovaj dokument je za vlasnika instalacije i platform administratore. Javni korisnički opis nalazi se u `README.md`.

## Nadogradnja postojeće PSGZ instalacije

1. Napravite sigurnosnu kopiju Supabase baze.
2. U Supabase SQL Editoru pokrenite `supabase/upgrade_v7_organizations.sql`.
3. Prenesite v7 source na GitHub i pričekajte završetak Pages workflowa.
4. Odjavite se i ponovno prijavite jednokratnom e-mail poveznicom.

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

## Nova organizacija

Prvi administrator mora se barem jednom prijaviti u aplikaciju ili prihvatiti poveznicu koja mu stiže nakon dodavanja. Nakon dodjele može sam dodavati druge administratore, voditelje klubova i kapetane.

## Jezične datoteke

Upute za dodavanje jezika nalaze se u `TRANSLATIONS.md`.
