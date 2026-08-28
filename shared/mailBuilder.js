// Baut aus einer Submission den Inhalt der Antwort-Mail: korrekte Anrede,
// Hinweis auf fehlende/optionale Angaben, eine anschauliche IST-Prozess-
// Darstellung und einen vorsichtig formulierten Digitalisierungs-Vorschlag.
// Genutzt sowohl vom CLI-Skript (scripts/generate-antwort-mail.js) als auch
// vom Backend (server/mailer.js) für den automatischen Versand.

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

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Einheitliche Typo-/Farb-Skala für die ganze Mail — ein Font-Stack, vier
// Textgrößen (Fliesstext, Bildunterschrift, Sektionstitel, Titel), damit die
// Mail nicht wie ein Flickenteppich aus Ad-hoc-Styles wirkt.
const FONT = "Arial,Helvetica,sans-serif";
const GROESSE = { text: "15px", klein: "13px", label: "12px", titel: "22px", abschnitt: "16px" };
const FARBE = { tinte: "#152238", gedaempft: "#5B6459", akzent: "#1D6E63", rand: "#E4E0D2", warnRand: "#C77A2E", warnFlaeche: "#FBEADA", kartenGrund: "#F7F5EE" };

function fliessDiagrammHtml(formular) {
  const pfeil = `<tr><td style="padding:2px 0 2px 20px;color:${FARBE.gedaempft};font-family:${FONT};font-size:${GROESSE.text};line-height:1;">↓</td></tr>`;
  const zelle = (inhalt, farbe) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:${farbe};color:#ffffff;border-radius:8px;padding:11px 16px;font-family:${FONT};font-size:${GROESSE.text};line-height:1.4;max-width:480px;">
          ${inhalt}
        </div>
      </td>
    </tr>${pfeil}`;

  const start = zelle(`<strong>Start:</strong> ${escapeHtml(formular.auslöser)}`, FARBE.akzent);
  const schrittZellen = formular.schritte
    .filter((s) => s.beschreibung?.trim())
    .map(
      (s, i) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:#ffffff;border:1px solid ${FARBE.rand};border-radius:8px;padding:11px 16px;font-family:${FONT};font-size:${GROESSE.text};line-height:1.4;max-width:480px;color:${FARBE.tinte};">
          <strong>${i + 1}. ${escapeHtml(s.akteur || "?")}</strong> — ${escapeHtml(s.beschreibung)}
          ${s.werkzeug ? `<br><span style="color:${FARBE.gedaempft};font-size:${GROESSE.klein};">Werkzeug: ${escapeHtml(s.werkzeug)}</span>` : ""}
        </div>
      </td>
    </tr>${pfeil}`
    )
    .join("");

  const verzweigungZellen = (formular.entscheidungspunkte ?? [])
    .filter((g) => g.frage?.trim())
    .map(
      (g) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:${FARBE.warnFlaeche};border:1px solid ${FARBE.warnRand};border-radius:8px;padding:11px 16px;font-family:${FONT};font-size:${GROESSE.text};line-height:1.4;color:${FARBE.tinte};max-width:480px;">
          <strong>Verzweigung:</strong> ${escapeHtml(g.frage)}<br>
          <span style="font-size:${GROESSE.klein};">${escapeHtml(g.optionA)} → ${escapeHtml(g.folgeA)}</span><br>
          <span style="font-size:${GROESSE.klein};">${escapeHtml(g.optionB)} → ${escapeHtml(g.folgeB)}</span>
        </div>
      </td>
    </tr>${pfeil}`
    )
    .join("");

  const ende = zelle(`<strong>Ende:</strong> ${escapeHtml(formular.ergebnis)}`, FARBE.akzent).replace(
    /<tr><td style="padding:2px[^<]*<\/td><\/tr>$/,
    ""
  ); // kein Pfeil nach dem letzten Element

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${start}${schrittZellen}${verzweigungZellen}${ende}
  </table>`;
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

// Ein Abschnittstitel mit farbigem Steg links statt wechselnder <h1>-<h6>-Defaults
// — hält Schriftgröße/-familie über die ganze Mail identisch zur Skala oben.
function abschnittstitel(text) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 12px;">
      <tr>
        <td style="width:4px;background:${FARBE.akzent};border-radius:2px;"></td>
        <td style="padding-left:10px;font-family:${FONT};font-size:${GROESSE.abschnitt};font-weight:bold;color:${FARBE.tinte};">
          ${text}
        </td>
      </tr>
    </table>`;
}

// Eine Karte mit eigenem Hintergrund für Hinweis-/Potenzial-Absätze — bündelt
// zusammengehörigen Text sichtbar, statt ihn als lose Fließtext-Absätze zu zeigen.
function karte(innerHtml, { rand = FARBE.rand, grund = FARBE.kartenGrund } = {}) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${grund};border:1px solid ${rand};border-radius:10px;margin:0 0 8px;">
      <tr><td style="padding:16px 18px;">${innerHtml}</td></tr>
    </table>`;
}

function absatz(text, { klein = false, farbe = FARBE.tinte } = {}) {
  return `<p style="font-family:${FONT};font-size:${klein ? GROESSE.klein : GROESSE.text};line-height:1.6;color:${farbe};margin:0 0 12px;">${text}</p>`;
}

export function bauMail(eintrag) {
  const f = eintrag.formular;
  const name = vorname(f.firma.kontaktName);
  const rolle = (f.firma.meineRolle ?? "").trim();
  const analyse = analysiere(f);
  const vorschlag = einsparungsVorschlagText(analyse);
  const diagramm = fliessDiagrammHtml(f);

  // Persönliche Anrede statt Textbaustein: nur mit dem arbeiten, was Du tatsächlich
  // angegeben hast (Name, Rolle, Firma, Prozess) — nichts dazu erfinden.
  const einleitungText = rolle
    ? `danke, dass Du Dir als <strong>${escapeHtml(rolle)}</strong> bei <strong>${escapeHtml(f.firma.name)}</strong> die Zeit genommen hast, uns den Ablauf „<strong>${escapeHtml(f.prozessName)}</strong>“ zu beschreiben. Was folgt, ist ausschließlich auf Basis Deiner eigenen Angaben entstanden — kein Textbaustein von der Stange.`
    : `danke, dass Du Dir die Zeit genommen hast, uns den Ablauf „<strong>${escapeHtml(f.prozessName)}</strong>“ bei <strong>${escapeHtml(f.firma.name)}</strong> zu beschreiben. Hier ist, was wir daraus für Dich sichtbar gemacht haben.`;

  const abschlussText = rolle
    ? `Diese Einschätzung wurde ausschließlich für ${escapeHtml(f.firma.name)} erstellt, auf Basis dessen, was Du uns als ${escapeHtml(rolle)} erzählt hast — kein Massenversand, keine Vorlage.`
    : null;

  const fehlendeHtml = analyse.fehlendeOptionalAngaben.length
    ? karte(
        absatz("Eine Kleinigkeit noch, falls Du kurz Zeit hast — dann wird das Bild noch genauer:") +
          `<ul style="font-family:${FONT};font-size:${GROESSE.text};line-height:1.6;color:${FARBE.tinte};margin:0 0 12px;padding-left:20px;">
            ${analyse.fehlendeOptionalAngaben.map((a) => `<li style="margin-bottom:6px;">${escapeHtml(a)}</li>`).join("")}
          </ul>` +
          absatz("Kein Muss — auch ohne das können wir Dir schon zeigen, was wir sehen.", { klein: true, farbe: FARBE.gedaempft })
      )
    : "";

  const vorschlagHtml = vorschlag
    ? karte(
        absatz(
          `${escapeHtml(vorschlag.anteilText)} Bei ähnlich gelagerten Abläufen sehen wir erfahrungsgemäß, dass sich der
          Zeitaufwand für solche Teilschritte häufig um etwa <strong>20–40&nbsp;%</strong> senken lässt, wenn
          Medienbrüche (Papier → Excel → Telefon) wegfallen.`
        ) +
          (vorschlag.ursachenText ? absatz(escapeHtml(vorschlag.ursachenText)) : "") +
          absatz(
            "Wichtig: Das ist eine grobe Einschätzung auf Basis Deiner Angaben, keine Zusage — wie viel sich bei Dir konkret realisieren lässt, sehen wir am besten in einem kurzen, unverbindlichen Gespräch.",
            { klein: true, farbe: FARBE.gedaempft }
          ),
        { rand: FARBE.akzent, grund: "#EBF3F0" }
      )
    : karte(
        absatz(
          "Dein Ablauf wirkt schon recht digital unterwegs — hier würden wir im Gespräch gezielt nachfragen, wo im Detail noch Zeit verloren geht, bevor wir eine Einschätzung wagen."
        ),
        { rand: FARBE.akzent, grund: "#EBF3F0" }
      );

  const betreff = `Deine Digitalisierungs-Analyse: „${f.prozessName}“ bei ${f.firma.name}`;

  const html = `
<div style="background:#F3F1EA;padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${FARBE.rand};">
  <tr>
    <td style="background:${FARBE.tinte};padding:26px 32px;">
      <div style="font-family:${FONT};font-size:${GROESSE.label};letter-spacing:0.08em;text-transform:uppercase;color:#9FD8C9;">Digitalisierungs-Analyse</div>
      <div style="font-family:${FONT};font-size:${GROESSE.titel};font-weight:bold;color:#ffffff;margin-top:4px;">Skillsprinters</div>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      ${absatz(`Hallo${name ? " " + escapeHtml(name) : ""},`)}

      ${absatz(einleitungText)}

      ${fehlendeHtml}

      ${abschnittstitel("So läuft der Ablauf heute (IST)")}
      ${diagramm}

      ${abschnittstitel("Wo wir Potenzial sehen")}
      ${vorschlagHtml}

      ${absatz(
        "Wenn Du möchtest, schauen wir uns das gern gemeinsam in einem kurzen Gespräch an — unverbindlich und kostenlos. Einfach auf diese Mail antworten."
      )}

      ${abschlussText ? absatz(abschlussText, { klein: true, farbe: FARBE.gedaempft }) : ""}

      ${absatz("Viele Grüße<br>Dein Team von Skillsprinters", { farbe: FARBE.gedaempft })}
    </td>
  </tr>
  <tr>
    <td style="background:${FARBE.kartenGrund};padding:16px 32px;font-family:${FONT};font-size:${GROESSE.klein};color:${FARBE.gedaempft};">
      Skillsprinters · Kostenlose Digitalisierungs-Analyse
    </td>
  </tr>
</table>
</div>`;

const text = textVersion({ f, name, rolle, analyse, vorschlag });

  return { betreff, html, text };
}

// Eigenständig aus den Daten gebaut statt aus dem HTML gestrippt — bei der
// Tabellen-/Karten-Struktur oben verliert reines Tag-Strippen die Zeilenumbrüche.
function textVersion({ f, name, rolle, analyse, vorschlag }) {
  const zeilen = [];
  zeilen.push(`Hallo${name ? " " + name : ""},`, "");
  zeilen.push(
    rolle
      ? `danke, dass Du Dir als ${rolle} bei ${f.firma.name} die Zeit genommen hast, uns den Ablauf „${f.prozessName}“ zu beschreiben. Was folgt, ist ausschließlich auf Basis Deiner eigenen Angaben entstanden — kein Textbaustein von der Stange.`
      : `danke, dass Du Dir die Zeit genommen hast, uns den Ablauf „${f.prozessName}“ bei ${f.firma.name} zu beschreiben. Hier ist, was wir daraus für Dich sichtbar gemacht haben.`,
    ""
  );

  if (analyse.fehlendeOptionalAngaben.length) {
    zeilen.push("Eine Kleinigkeit noch, falls Du kurz Zeit hast — dann wird das Bild noch genauer:");
    analyse.fehlendeOptionalAngaben.forEach((a) => zeilen.push(`- ${a}`));
    zeilen.push("Kein Muss — auch ohne das können wir Dir schon zeigen, was wir sehen.", "");
  }

  zeilen.push("SO LÄUFT DER ABLAUF HEUTE (IST)", "");
  zeilen.push(`Start: ${f.auslöser}`);
  f.schritte
    .filter((s) => s.beschreibung?.trim())
    .forEach((s, i) => {
      zeilen.push(`${i + 1}. ${s.akteur || "?"} — ${s.beschreibung}${s.werkzeug ? ` (Werkzeug: ${s.werkzeug})` : ""}`);
    });
  (f.entscheidungspunkte ?? [])
    .filter((g) => g.frage?.trim())
    .forEach((g) => {
      zeilen.push(`Verzweigung: ${g.frage} — ${g.optionA} → ${g.folgeA} / ${g.optionB} → ${g.folgeB}`);
    });
  zeilen.push(`Ende: ${f.ergebnis}`, "");

  zeilen.push("WO WIR POTENZIAL SEHEN", "");
  if (vorschlag) {
    zeilen.push(
      `${vorschlag.anteilText} Bei ähnlich gelagerten Abläufen sehen wir erfahrungsgemäß, dass sich der Zeitaufwand für solche Teilschritte häufig um etwa 20–40 % senken lässt, wenn Medienbrüche (Papier → Excel → Telefon) wegfallen.`
    );
    if (vorschlag.ursachenText) zeilen.push(vorschlag.ursachenText);
    zeilen.push(
      "Wichtig: Das ist eine grobe Einschätzung auf Basis Deiner Angaben, keine Zusage — wie viel sich bei Dir konkret realisieren lässt, sehen wir am besten in einem kurzen, unverbindlichen Gespräch."
    );
  } else {
    zeilen.push(
      "Dein Ablauf wirkt schon recht digital unterwegs — hier würden wir im Gespräch gezielt nachfragen, wo im Detail noch Zeit verloren geht, bevor wir eine Einschätzung wagen."
    );
  }
  zeilen.push(
    "",
    "Wenn Du möchtest, schauen wir uns das gern gemeinsam in einem kurzen Gespräch an — unverbindlich und kostenlos. Einfach auf diese Mail antworten."
  );
  if (rolle) {
    zeilen.push(
      "",
      `Diese Einschätzung wurde ausschließlich für ${f.firma.name} erstellt, auf Basis dessen, was Du uns als ${rolle} erzählt hast — kein Massenversand, keine Vorlage.`
    );
  }
  zeilen.push("", "Viele Grüße", "Dein Team von Skillsprinters");

  return zeilen.join("\n");
}
