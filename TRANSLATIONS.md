# Dodavanje jezika

Prijevodi se nalaze u `public/locales`. Aplikacija ih učitava pri otvaranju, pa dodavanje jezika ne zahtijeva promjenu TypeScript koda.

1. Kopirajte `public/locales/en.json` u novu datoteku, primjerice `it.json`.
2. Prevedite vrijednosti s desne strane. Ključeve s lijeve strane ne mijenjajte.
3. Dodajte jezik u `public/locales/languages.json`:

```json
{
  "code": "it",
  "name": "Italiano",
  "file": "it.json",
  "locale": "it-IT"
}
```

4. Prenesite datoteke na GitHub. Nakon objave jezik se automatski pojavljuje u postavkama.

Ako prijevod nekog ključa nedostaje, aplikacija koristi engleski tekst. Nazivi saveza, liga, klubova, timova i lokacija ne prevode se automatski.
