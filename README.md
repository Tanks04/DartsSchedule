# DartsScheduler

Javni raspored pikado ekipa i pregled zauzetosti lokacija. Svi mogu čitati podatke, a samo odobreni urednici mogu uvoziti Excel/CSV i mijenjati raspored.

## 1. Supabase

1. Na <https://supabase.com> napravite novi projekt.
2. Otvorite **SQL Editor**, zalijepite cijeli sadržaj datoteke `supabase/schema.sql` i pokrenite ga jednom.
3. U **Project Settings → API** kopirajte:
   - Project URL
   - Publishable key (ili legacy `anon public` key)
4. U **Authentication → URL Configuration** postavite:
   - Site URL: `https://tanks04.github.io/DartsScheduler/`
   - Redirect URL: `https://tanks04.github.io/DartsScheduler/**`

## 2. Prvi urednik

1. Objavite aplikaciju i kliknite **Urednik**.
2. Upišite svoj e-mail i otvorite poveznicu koja stigne e-mailom.
3. U Supabaseu otvorite **Authentication → Users** i kopirajte UUID tog korisnika.
4. U SQL Editoru pokrenite:

```sql
insert into public.editors (user_id)
values ('OVDJE-ZALIJEPITE-UUID');
```

Ponovite samo za osobe koje smiju uređivati raspored.

## 3. GitHub Pages

1. Napravite GitHub repozitorij `DartsScheduler` i dodajte sadržaj ovog projekta.
2. U repozitoriju otvorite **Settings → Secrets and variables → Actions → Variables**.
3. Dodajte:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. U **Settings → Pages → Build and deployment** odaberite **GitHub Actions**.
5. Push na granu `main` automatski pokreće objavu.

`service_role` ključ se nikada ne stavlja u GitHub ni u web-aplikaciju.

## Lokalni razvoj

Kopirajte `.env.example` u `.env.local`, unesite dvije javne Supabase vrijednosti i pokrenite:

```bash
pnpm install
pnpm dev
```
