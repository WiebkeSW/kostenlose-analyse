// Erzeugt aus einer Submission den Entwurf einer Antwort-Mail:
// korrekte Anrede, Hinweis auf fehlende/optionale Angaben, eine anschauliche
// IST-Prozess-Darstellung und einen vorsichtig formulierten Digitalisierungs-Vorschlag.
//
// Aufruf: node scripts/generate-antwort-mail.js <submission-id|latest>
//
// Erzeugt nur einen ENTWURF zum Prüfen — verschickt nichts.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function vorname(kontaktName) {
  const teile = (kontaktName ?? "").trim().split(/\s+/);
  return teile[0] || null;
}

// Manuelle/medienbruchbehaftete Werkzeuge, die auf Digitalisierungspotenzial hindeuten.
const MANUELLE_WERKZEUGE = /excel|papier|telefon|whatsapp|fax|handschrift|zettel|e-?mail/i;

function analysiere(formular) {
  const schritte = formular.schritte.filter((s) => s.beschreibung?.trim());
  const manuelleSchritte = schritte.filter((s) => MANUELLE_WERKZEUGE.test(s.werkzeug ?? ""));
  const whyKetten = formular.whyKetten.filter((k) => k.symptom?.trim());
  const wurzelursachen = whyKetten
    .map((k) => ({ symptom: k.symptom, ursache: [...(k.warums ?? [])].filter((w) => w?.trim()).pop() }))
    .filter((w) => w.ursache);

  const fehlendeOptionalAngaben = [];
  if (!formular.benötigteDaten?.trim()) {
    fehlendeOptionalAngaben.push(
      "Welche Angaben genau gebraucht werden (z. B. Bestellnummer, Freigabegrenze) — hilft uns, die passenden Felder für ein digitales Formular vorzuschlagen."
    );
  }
  if (!formular.entscheidungspunkte?.length) {
    fehlendeOptionalAngaben.push(
      "Ob es Fälle gibt, in denen der Ablauf anders läuft (z. B. je nach Betrag oder Kunde) — dann können wir auch diese Sonderfälle mit abbilden."
    );
  }
  const flacheWhyKetten = whyKetten.filter((k) => (k.warums ?? []).filter((w) => w?.trim()).length <= 2);
  if (flacheWhyKetten.length) {
    fehlendeOptionalAngaben.push(
      `Bei „${flacheWhyKetten[0].symptom}“ könnten ein oder zwei weitere „Warum?“-Antworten helfen, noch näher an die eigentliche Ursache zu kommen.`
    );
  }

  return { schritte, manuelleSchritte, wurzelursachen, fehlendeOptionalAngaben };
}

function fliessDiagrammHtml(formular) {
  const zelle = (inhalt, farbe) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:${farbe};color:#ffffff;border-radius:8px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:480px;">
          ${inhalt}
        </div>
      </td>
    </tr>
    <tr><td style="padding:2px 0 2px 18px;color:#9a958a;font-family:Arial,Helvetica,sans-serif;font-size:14px;">↓</td></tr>`;

  const start = zelle(`<strong>Start:</strong> ${escapeHtml(formular.auslöser)}`, "#2f5d62");
  const schrittZellen = formular.schritte
    .filter((s) => s.beschreibung?.trim())
    .map(
      (s, i) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:#ffffff;border:1px solid #e4ddd0;border-radius:8px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:480px;">
          <strong>${i + 1}. ${escapeHtml(s.akteur || "?")}</strong> — ${escapeHtml(s.beschreibung)}
          ${s.werkzeug ? `<br><span style="color:#8a8577;font-size:12px;">Werkzeug: ${escapeHtml(s.werkzeug)}</span>` : ""}
        </div>
      </td>
    </tr>
    <tr><td style="padding:2px 0 2px 18px;color:#9a958a;font-family:Arial,Helvetica,sans-serif;font-size:14px;">↓</td></tr>`
    )
    .join("");

  const verzweigungZellen = (formular.entscheidungspunkte ?? [])
    .filter((g) => g.frage?.trim())
    .map(
      (g) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:#fbe6d8;border:1px solid #e0703c;border-radius:8px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:480px;">
          <strong>Verzweigung:</strong> ${escapeHtml(g.frage)}<br>
          <span style="font-size:13px;">${escapeHtml(g.optionA)} → ${escapeHtml(g.folgeA)}</span><br>
          <span style="font-size:13px;">${escapeHtml(g.optionB)} → ${escapeHtml(g.folgeB)}</span>
        </div>
      </td>
    </tr>
    <tr><td style="padding:2px 0 2px 18px;color:#9a958a;font-family:Arial,Helvetica,sans-serif;font-size:14px;">↓</td></tr>`
    )
    .join("");

  const ende = zelle(`<strong>Ende:</strong> ${escapeHtml(formular.ergebnis)}`, "#2f5d62")
    .replace(/<tr><td style="padding:2px[^<]*<\/td><\/tr>$/, ""); // kein Pfeil nach dem letzten Element

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${start}${schrittZellen}${verzweigungZellen}${ende}
  </table>`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function einsparungsVorschlagText({ schritte, manuelleSchritte, wurzelursachen }) {
  if (manuelleSchritte.length === 0) return null;

  const anteil = Math.round((manuelleSchritte.length / schritte.length) * 100);
  const ursachenListe = wurzelursachen.map((w) => `„${w.ursache}“`).join(" und ");

  return {
    anteilText: `${manuelleSchritte.length} von ${schritte.length} Schritten laufen aktuell über Papier, Telefon, Excel oder E-Mail (${anteil}%).`,
    ursachenText: ursachenListe
      ? `Die tieferliegenden Gründe, die Du genannt hast — ${ursachenListe} —, sind typische Stellen, an denen ein einfaches digitales Hilfsmittel (z. B. eine gemeinsame Liste oder ein kleines Formular) oft schon viel verändert.`
      : null,
  };
}

function bauMail(eintrag) {
  const f = eintrag.formular;
  const name = vorname(f.firma.kontaktName);
  const analyse = analysiere(f);
  const vorschlag = einsparungsVorschlagText(analyse);
  const diagramm = fliessDiagrammHtml(f);

  const fehlendeHtml = analyse.fehlendeOptionalAngaben.length
    ? `
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2430;">
      Eine Kleinigkeit noch, falls Du kurz Zeit hast — dann wird das Bild noch genauer:
    </p>
    <ul style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2430;">
      ${analyse.fehlendeOptionalAngaben.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}
    </ul>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#8a8577;">
      Kein Muss — auch ohne das können wir Dir schon zeigen, was wir sehen.
    </p>`
    : "";

  const vorschlagHtml = vorschlag
    ? `
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2430;">
      ${vorschlag.anteilText} Bei ähnlich gelagerten Abläufen sehen wir erfahrungsgemäß, dass sich der
      Zeitaufwand für solche Teilschritte häufig um etwa <strong>20–40 %</strong> senken lässt, wenn
      Medienbrüche (Papier → Excel → Telefon) wegfallen.
    </p>
    ${vorschlag.ursachenText ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2430;">${vorschlag.ursachenText}</p>` : ""}
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8a8577;">
      Wichtig: Das ist eine grobe Einschätzung auf Basis Deiner Angaben, keine Zusage — wie viel sich
      bei Dir konkret realisieren lässt, sehen wir am besten in einem kurzen, unverbindlichen Gespräch.
    </p>`
    : `
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2430;">
      Dein Ablauf wirkt schon recht digital unterwegs — hier würden wir im Gespräch gezielt nachfragen,
      wo im Detail noch Zeit verloren geht, bevor wir eine Einschätzung wagen.
    </p>`;

  const betreff = `Deine Digitalisierungs-Analyse: „${f.prozessName}“ bei ${f.firma.name}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2430;">
  <p>Hallo${name ? " " + escapeHtml(name) : ""},</p>

  <p>
    danke, dass Du Dir die Zeit genommen hast, uns den Ablauf „<strong>${escapeHtml(f.prozessName)}</strong>“
    bei <strong>${escapeHtml(f.firma.name)}</strong> zu beschreiben. Hier ist, was wir daraus für Dich
    sichtbar gemacht haben.
  </p>

  ${fehlendeHtml}

  <h3 style="color:#1f4245;">So läuft der Ablauf heute (IST)</h3>
  ${diagramm}

  <h3 style="color:#1f4245;">Wo wir Potenzial sehen</h3>
  ${vorschlagHtml}

  <p>
    Wenn Du möchtest, schauen wir uns das gern gemeinsam in einem kurzen Gespräch an — unverbindlich
    und kostenlos. Einfach auf diese Mail antworten.
  </p>

  <p>Viele Grüße<br>Dein Team von Skillsprinters</p>
</div>`;

  const text = html
    .replace(/<h3[^>]*>/g, "\n\n")
    .replace(/<\/h3>/g, "\n")
    .replace(/<li>/g, "- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((zeile) => zeile.trim())
    .filter((zeile, i, arr) => zeile !== "" || arr[i - 1] !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { betreff, html, text };
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
