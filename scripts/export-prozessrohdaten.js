// Liest eine gespeicherte Submission und erzeugt daraus:
//  - bpmn-rohdaten.json   strukturierte Grundlage für ein BPMN-Prozessmodell
//  - prozess-uebersicht.md  lesbare Zusammenfassung für Analyse/Angebot
//
// Aufruf: node scripts/export-prozessrohdaten.js <submission-id|latest>

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
    dateien.sort((a, b) =>
      fs.statSync(path.join(SUBMISSIONS_DIR, b)).mtimeMs -
      fs.statSync(path.join(SUBMISSIONS_DIR, a)).mtimeMs
    );
    return dateien[0];
  }
  const treffer = dateien.find((f) => f.startsWith(arg));
  if (!treffer) throw new Error(`Keine Submission mit ID "${arg}" gefunden.`);
  return treffer;
}

// Formular -> BPMN-Rohdaten (Pool = Firma, Lanes = Rollen, Tasks = Schritte in Reihenfolge)
function zuBpmnRohdaten(eintrag) {
  const f = eintrag.formular;
  const lanes = f.rollen.filter((r) => r.name?.trim()).map((r) => ({
    id: r.id,
    name: r.name,
    intern: !!r.intern,
  }));

  const tasks = f.schritte
    .filter((s) => s.beschreibung?.trim())
    .map((s, i) => ({
      id: s.id,
      reihenfolge: i + 1,
      lane: s.akteur || null,
      beschreibung: s.beschreibung,
      werkzeug: s.werkzeug || null,
    }));

  const gateways = (f.entscheidungspunkte ?? [])
    .filter((g) => g.frage?.trim())
    .map((g) => ({
      id: g.id,
      frage: g.frage,
      pfade: [
        { bedingung: g.optionA, folge: g.folgeA },
        { bedingung: g.optionB, folge: g.folgeB },
      ].filter((p) => p.bedingung?.trim()),
    }));

  const schmerzpunkte = (f.whyKetten ?? [])
    .filter((k) => k.symptom?.trim())
    .map((k) => ({
      symptom: k.symptom,
      warumKette: (k.warums ?? []).filter((w) => w?.trim()),
      wurzelursache: [...(k.warums ?? [])].filter((w) => w?.trim()).pop() ?? null,
    }));

  return {
    prozess: f.prozessName,
    firma: { name: f.firma.name, branche: f.firma.branche, groesse: f.firma.groesse },
    pool: f.firma.name,
    lanes,
    startEvent: { typ: "start", beschreibung: f.auslöser },
    tasks,
    gateways,
    endEvent: { typ: "end", beschreibung: f.ergebnis },
    benötigteDaten: f.benötigteDaten || null,
    schmerzpunkte,
    sonstiges: f.sonstiges || null,
    quelle: { submissionId: eintrag.id, eingereichtAm: eintrag.eingereichtAm },
  };
}

function zuMarkdown(rohdaten) {
  const lanesZeile = rohdaten.lanes.map((l) => `${l.name}${l.intern ? "" : " (extern)"}`).join(", ");
  const tasksListe = rohdaten.tasks
    .map((t) => `${t.reihenfolge}. **${t.lane ?? "?"}** — ${t.beschreibung}${t.werkzeug ? ` _(${t.werkzeug})_` : ""}`)
    .join("\n");
  const gatewaysListe = rohdaten.gateways.length
    ? rohdaten.gateways
        .map(
          (g) =>
            `- **${g.frage}**\n` +
            g.pfade.map((p) => `  - ${p.bedingung} → ${p.folge}`).join("\n")
        )
        .join("\n")
    : "_Keine Verzweigungen angegeben._";
  const schmerzpunkteListe = rohdaten.schmerzpunkte.length
    ? rohdaten.schmerzpunkte
        .map(
          (s) =>
            `### ${s.symptom}\n` +
            s.warumKette.map((w, i) => `${i + 1}. ${w}`).join("\n") +
            (s.wurzelursache ? `\n\n**Wurzelursache:** ${s.wurzelursache}` : "")
        )
        .join("\n\n")
    : "_Keine Schmerzpunkte angegeben._";

  return `# Prozess-Übersicht — ${rohdaten.prozess}

**Firma:** ${rohdaten.firma.name} (${rohdaten.firma.branche}, ${rohdaten.firma.groesse})
**Eingereicht:** ${rohdaten.quelle.eingereichtAm}

## Beteiligte (BPMN-Lanes)
${lanesZeile}

## Auslöser
${rohdaten.startEvent.beschreibung}

## Ablauf (BPMN-Tasks)
${tasksListe}

## Verzweigungen (BPMN-Gateways)
${gatewaysListe}

## Ergebnis
${rohdaten.endEvent.beschreibung}

${rohdaten.benötigteDaten ? `## Benötigte Daten\n${rohdaten.benötigteDaten}\n` : ""}
## Schmerzpunkte & Ursachen (5-Why)
${schmerzpunkteListe}

${rohdaten.sonstiges ? `## Sonstiges\n${rohdaten.sonstiges}\n` : ""}
---
_Diese Datei ist eine automatisch erzeugte Grundlage für ein BPMN-Prozessmodell,
kein fertiges Diagramm. Quelle: \`bpmn-rohdaten.json\` im selben Ordner._
`;
}

function main() {
  const arg = process.argv[2];
  const datei = findSubmission(arg);
  const eintrag = JSON.parse(fs.readFileSync(path.join(SUBMISSIONS_DIR, datei), "utf-8"));

  const rohdaten = zuBpmnRohdaten(eintrag);
  const ordnerName = `${slug(rohdaten.firma.name)}--${slug(rohdaten.prozess)}`;
  const zielOrdner = path.join(OUT_ROOT, ordnerName);
  fs.mkdirSync(zielOrdner, { recursive: true });

  fs.writeFileSync(
    path.join(zielOrdner, "bpmn-rohdaten.json"),
    JSON.stringify(rohdaten, null, 2),
    "utf-8"
  );
  fs.writeFileSync(path.join(zielOrdner, "prozess-uebersicht.md"), zuMarkdown(rohdaten), "utf-8");

  console.log(`Exportiert nach: docs/prozesse/${ordnerName}/`);
}

main();
