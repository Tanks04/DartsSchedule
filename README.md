# DartsScheduler

Javni raspored pikado liga, timova i zauzetosti lokacija. Posjetitelji biraju ligu i tim, a aplikacija taj početni izbor pamti na uređaju. Zauzetost lokacije uvijek se računa preko svih liga.

## Objavljivanje ove nadogradnje

1. U Supabaseu otvorite **SQL Editor**.
2. Zalijepite cijeli sadržaj `supabase/upgrade_v2.sql` i kliknite **Run**. Ovaj korak daje vlasniku administratorska prava i uključuje lige, kapetane, prava i dnevnik promjena.
3. Zatim u novom SQL upitu pokrenite `supabase/psgz_2026_27_seed.sql`. Uvozi 9 PSGZ liga, 98 timova i 1.232 utakmice za 2026./27.; sigurno ga je ponovno pokrenuti.
4. Na GitHub prenesite izmijenjene datoteke i commitajte ih na `main`. Workflow će sam objaviti aplikaciju.
5. Nakon objave odjavite se i ponovno prijavite jednokratnom poveznicom. U zaglavlju ćete vidjeti **Kapetani** i oznaku **ADMIN**.

Ako aplikacija javlja da baza nije nadograđena, SQL iz 2. koraka nije uspješno pokrenut. Sama zamjena `page.tsx` i CSS-a ne može dodijeliti administratorska prava.

## Prava

- **Admin** uređuje sve podatke i dodjeljuje najviše dva kapetana po timu.
- **Kapetan** uređuje kontakt i domaću lokaciju svojeg tima te utakmice u kojima taj tim sudjeluje.
- **Gledatelj** samo čita.

Promjena datuma, vremena ili lokacije utakmice globalna je i odmah utječe na raspored lige i zauzetost lokacije. Dnevnik promjena prikazuje zadnje izmjene.

## GitHub Pages

Repozitorij: <https://github.com/Tanks04/DartsSchedule>

U **Settings → Secrets and variables → Actions → Variables** moraju postojati:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

U **Settings → Pages → Build and deployment** izvor mora biti **GitHub Actions**. `service_role` ključ se nikada ne stavlja u GitHub niti u web-aplikaciju.

## PSGZ podaci

Izvor rasporeda je službena stranica PSGZ-a. Datoteka `data/psgz-2026-27.json` sadrži izdvojene rasporede, a `scripts/build-psgz-seed.mjs` reproducibilno iz nje stvara SQL seed.

Lokacije koje PSGZ raspored ne objavljuje ostaju prazne dok ih admin ili kapetan ne poveže s timom. Time se izbjegava pogrešan prikaz zauzetosti.

## Lokalni razvoj

Kopirajte `.env.example` u `.env.local`, unesite dvije javne Supabase vrijednosti i pokrenite:

```bash
pnpm install
pnpm dev
```
