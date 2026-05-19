# PDF Flipbook

Next.js-App: PDF hochladen, als Blätterbuch anzeigen, Link und iframe-Code für Wix oder andere Sites.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Ohne `BLOB_READ_WRITE_TOKEN` werden PDFs unter `.data/flipbook/` gespeichert (nur für lokale Entwicklung geeignet; auf Vercel ist das Dateisystem nicht persistent).

## Online stellen (Vercel, ohne eigene Domain)

**Keine bezahlte Domain nötig:** Nach dem Deploy bekommst du eine URL `https://<projekt-name>.vercel.app`. Eine eigene Domain ist optional.

Kurzablauf:

1. Code in ein Git-Repository (z. B. GitHub) pushen.
2. Bei [vercel.com](https://vercel.com) einloggen, **Add New → Project**, Repository importieren.
3. **Vercel Blob** für das Projekt aktivieren und ein **Read-Write-Token** erzeugen (Dashboard → Storage → Blob).
4. Unter **Settings → Environment Variables** `BLOB_READ_WRITE_TOKEN` eintragen (oder beim ersten Import setzen).
5. Deploy. PDFs liegen dann in Blob; die API meldet nach Upload `storage: "vercel_blob"` (siehe [`src/app/api/upload/route.ts`](src/app/api/upload/route.ts)).

**Kosten / Limits:** Vercel und Blob haben Free-Tier- bzw. Fair-Use-Limits (Builds, Bandbreite, Speicher). Vor produktiver Nutzung die aktuellen Angaben im Vercel-Dashboard prüfen.

**PDF-Speicher:** Mit Blob-Token keine Codeänderung nötig. Andere Anbieter (z. B. S3-kompatibel) würden eine Anpassung in [`src/lib/pdf-storage.ts`](src/lib/pdf-storage.ts) erfordern.

## Umgebungsvariablen

| Variable | Beschreibung |
| -------- | ------------ |
| `BLOB_READ_WRITE_TOKEN` | Für Produktion (Vercel Blob): Read/Write-Token. Ohne: nur lokaler Ordner `.data/`. |

Siehe [.env.example](.env.example).

## Einbinden in Wix Studio

1. Nach dem Upload den **iframe**-Block aus der Erfolgsmeldung kopieren.
2. In Wix ein **HTML / iframe**- oder Embed-Element einfügen und den Code einfügen.
3. Optional Hintergrund per URL: `…/embed/DOC_ID?bg=wood` (`neutral`, `wood`, `dark`).

## PDF-Rendering („weiße Seiten“ bei JPEG2000 / JPX)

Die Vorschau nutzt **pdf.js** mit Assets unter **`public/pdfjs/`**. Entscheidend ist: **`pdf.worker.min.mjs`, WASM, CMaps und Fonts müssen zur installierten `pdfjs-dist`-Version passen.** Ein veralteter oder falscher Worker erzeugt bei **JPEG2000 (JPX)** oft „OpenJPEG failed“ → **komplett weiße Seiten** (wie bei „Scapes“ mit Druck-Rastern).

Nach **`npm install`** läuft automatisch **`npm run sync-pdfjs`** (`postinstall`, Skript [`scripts/sync-pdfjs-public.mjs`](scripts/sync-pdfjs-public.mjs)): Worker, `wasm/`, `iccs/`, `cmaps/`, `standard_fonts/` werden aus `node_modules/pdfjs-dist/` nach `public/pdfjs/` kopiert.

In [`FlipbookViewer.tsx`](src/components/FlipbookViewer.tsx) u. a.: **`iccUrl`**, **`isImageDecoderSupported: false`**, **`maxImageSize: -1`** (Details dort als Kommentare).

## Limits (App)

- Max. 20 MB pro PDF
- Max. 200 Seiten (Schutz für den Browser)

## Sicherheit im öffentlichen Betrieb

`POST /api/upload` ist für Demos schlicht gehalten. Bei öffentlichem Deployment können Speicher und Bandbreite missbräuchlich genutzt werden. Ohne Codeänderung hilft u. a. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection) oder passende Firewall-/Regeln je nach Plan.
