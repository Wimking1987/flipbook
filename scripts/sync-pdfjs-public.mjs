/**
 * Hält `public/pdfjs/` mit der installierten `pdfjs-dist`-Version kompatibel.
 * Worker-/API-Mismatch verursacht u.a. fehlgeschlagene JPX(JPEG2000)-Decodes → weiße Seiten.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "node_modules", "pdfjs-dist");
const pub = path.join(root, "public", "pdfjs");

function cpIfExists(from, to) {
  if (!fs.existsSync(from)) {
    console.warn("[sync-pdfjs] skip missing:", from);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function cpDir(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) {
    console.warn("[sync-pdfjs] skip missing dir:", fromDir);
    return;
  }
  fs.mkdirSync(toDir, { recursive: true });
  for (const name of fs.readdirSync(fromDir)) {
    const fp = path.join(fromDir, name);
    const tp = path.join(toDir, name);
    if (fs.statSync(fp).isDirectory()) cpDir(fp, tp);
    else fs.copyFileSync(fp, tp);
  }
}

cpIfExists(path.join(dist, "build", "pdf.worker.min.mjs"), path.join(pub, "pdf.worker.min.mjs"));
cpDir(path.join(dist, "wasm"), path.join(pub, "wasm"));
cpDir(path.join(dist, "iccs"), path.join(pub, "iccs"));
cpDir(path.join(dist, "cmaps"), path.join(pub, "cmaps"));
cpDir(path.join(dist, "standard_fonts"), path.join(pub, "standard_fonts"));

console.log("[sync-pdfjs] synced worker, wasm, iccs, cmaps, standard_fonts from pdfjs-dist");
