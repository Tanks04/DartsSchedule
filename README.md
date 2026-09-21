# DartsScheduler

Javni raspored pikado liga, timova i zauzetosti lokacija. Posjetitelji biraju ligu i tim, a aplikacija taj početni izbor pamti na uređaju. Zauzetost lokacije uvijek se računa preko svih liga.

## Prava

- **Admin** uređuje sve podatke i dodjeljuje najviše dva kapetana po timu.
- **Kapetan** uređuje kontakt i domaću lokaciju svojeg tima te utakmice u kojima taj tim sudjeluje.
- **Gledatelj** samo čita.

Promjena datuma, vremena ili lokacije utakmice globalna je i odmah utječe na raspored lige i zauzetost lokacije. Dnevnik promjena prikazuje zadnje izmjene.

## GitHub Pages

Repozitorij: <https://github.com/Tanks04/DartsSchedule>

## PSGZ podaci

Izvor rasporeda je službena stranica PSGZ-a. Datoteka `data/psgz-2026-27.json` sadrži izdvojene rasporede, a `scripts/build-psgz-seed.mjs` reproducibilno iz nje stvara SQL seed.

Lokacije koje PSGZ raspored ne objavljuje ostaju prazne dok ih admin ili kapetan ne poveže s timom. Time se izbjegava pogrešan prikaz zauzetosti.

## Lokalni razvoj

Kopirajte `.env.example` u `.env.local`, unesite dvije javne Supabase vrijednosti i pokrenite:

```bash
pnpm install
pnpm dev
```
