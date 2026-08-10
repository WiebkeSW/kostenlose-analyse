// Erzeugt aus einer Submission den Entwurf einer Antwort-Mail als Datei
// (HTML + Text) — zum Nachlesen/Prüfen, unabhängig vom automatischen Versand.
//
// Aufruf: node scripts/generate-antwort-mail.js <submission-id|latest>
//
// Erzeugt nur einen ENTWURF zum Prüfen — verschickt nichts.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { bauMail } from "../shared/mailBuilder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUBMISSIONS_DIR = path.join(__dirname, "..", "server", "data", "submissions");
const OUT_ROOT = path.join(__dirname, "..", "docs", "prozesse");

function slug(text) {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function findSubmission(arg) {
  const dateien = fs.readdirSync(SUBMISSIONS_DIR).filter((f) => f.endsWith(".json"));
  if (dateien.length === 0) throw new Error("Keine Submissions in server/data/submissions gefunden.");
  if (arg === "latest" || !arg) {
    dateien.sort(
      (a, b) =>
        fs.statSync(path.join(SUBMISSIONS_DIR, b)).mtimeMs -
        fs.statSync(path.join(SUBMISSIONS_DIR, a)).mtimeMs
    );
    return dateien[0];
  }
  const treffer = dateien.find((f) => f.startsWith(arg));
  if (!treffer) throw new Error(`Keine Submission mit ID "${arg}" gefunden.`);
  return treffer;
}

function main() {
  const arg = process.argv[2];
  const datei = findSubmission(arg);
  const eintrag = JSON.parse(fs.readFileSync(path.join(SUBMISSIONS_DIR, datei), "utf-8"));
  const { betreff, html, text } = bauMail(eintrag);

  const ordnerName = `${slug(eintrag.formular.firma.name)}--${slug(eintrag.formular.prozessName)}`;
  const zielOrdner = path.join(OUT_ROOT, ordnerName);
  fs.mkdirSync(zielOrdner, { recursive: true });

  fs.writeFileSync(
    path.join(zielOrdner, "antwort-mail.html"),
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${betreff}</title></head><body>${html}</body></html>\n`,
    "utf-8"
  );
  fs.writeFileSync(path.join(zielOrdner, "antwort-mail.txt"), `Betreff: ${betreff}\n\n${text}\n`, "utf-8");

  console.log(`Betreff: ${betreff}`);
  console.log(`Entwurf gespeichert unter: docs/prozesse/${ordnerName}/antwort-mail.html`);
}

main();
