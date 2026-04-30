# PDF Flipbook

Next.js app: PDF hochladen, als Blätterbuch anzeigen, Link und iframe-Code für Wix oder andere Sites.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Ohne `BLOB_READ_WRITE_TOKEN` werden PDFs unter `.data/flipbook/` gespeichert (nur für lokale Entwicklung geeignet; auf Vercel ist das Dateisystem nicht persistent).

## Produktion (Vercel)

1. Projekt mit Vercel verbinden und deployen.
2. Im Vercel Dashboard **Blob** aktivieren und ein Read-Write-Token anlegen.
3. Unter **Settings → Environment Variables** `BLOB_READ_WRITE_TOKEN` setzen und neu deployen.

## Einbinden in Wix Studio

1. Nach dem Upload den **iframe**-Block aus der Erfolgsmeldung kopieren.
2. In Wix ein **HTML / iframe**- oder Embed-Element einfügen und den Code einfügen.
3. Optional Hintergrund per URL: `…/embed/DOC_ID?bg=wood` (`neutral`, `wood`, `dark`).

## Umgebungsvariablen

| Variable                 | Beschreibung                          |
| ------------------------ | ------------------------------------- |
| `BLOB_READ_WRITE_TOKEN`  | Optional lokal; für Vercel empfohlen. |

Siehe [.env.example](.env.example).

## Limits

- Max. 20 MB pro PDF
- Max. 200 Seiten (Schutz für den Browser)
