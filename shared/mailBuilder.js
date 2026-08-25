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

function fliessDiagrammHtml(formular) {
  const zelle = (inhalt, farbe) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:${farbe};color:#ffffff;border-radius:8px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:480px;">
          ${inhalt}
        </div>
      </td>
    </tr>
    <tr><td style="padding:2px 0 2px 18px;color:#4A5670;font-family:Arial,Helvetica,sans-serif;font-size:14px;">↓</td></tr>`;

  const start = zelle(`<strong>Start:</strong> ${escapeHtml(formular.auslöser)}`, "#1D6E63");
  const schrittZellen = formular.schritte
    .filter((s) => s.beschreibung?.trim())
    .map(
      (s, i) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:#ffffff;border:1px solid #E1E5EC;border-radius:8px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:480px;">
          <strong>${i + 1}. ${escapeHtml(s.akteur || "?")}</strong> — ${escapeHtml(s.beschreibung)}
          ${s.werkzeug ? `<br><span style="color:#4A5670;font-size:12px;">Werkzeug: ${escapeHtml(s.werkzeug)}</span>` : ""}
        </div>
      </td>
    </tr>
    <tr><td style="padding:2px 0 2px 18px;color:#4A5670;font-family:Arial,Helvetica,sans-serif;font-size:14px;">↓</td></tr>`
    )
    .join("");

  const verzweigungZellen = (formular.entscheidungspunkte ?? [])
    .filter((g) => g.frage?.trim())
    .map(
      (g) => `
    <tr>
      <td style="padding:0 0 4px 0;">
        <div style="display:inline-block;background:#FBEADA;border:1px solid #C77A2E;border-radius:8px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:480px;">
          <strong>Verzweigung:</strong> ${escapeHtml(g.frage)}<br>
          <span style="font-size:13px;">${escapeHtml(g.optionA)} → ${escapeHtml(g.folgeA)}</span><br>
          <span style="font-size:13px;">${escapeHtml(g.optionB)} → ${escapeHtml(g.folgeB)}</span>
        </div>
      </td>
    </tr>
    <tr><td style="padding:2px 0 2px 18px;color:#4A5670;font-family:Arial,Helvetica,sans-serif;font-size:14px;">↓</td></tr>`
    )
    .join("");

  const ende = zelle(`<strong>Ende:</strong> ${escapeHtml(formular.ergebnis)}`, "#1D6E63").replace(
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

export function bauMail(eintrag) {
  const f = eintrag.formular;
  const name = vorname(f.firma.kontaktName);
  const analyse = analysiere(f);
  const vorschlag = einsparungsVorschlagText(analyse);
  const diagramm = fliessDiagrammHtml(f);

  const fehlendeHtml = analyse.fehlendeOptionalAngaben.length
    ? `
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#152238;">
      Eine Kleinigkeit noch, falls Du kurz Zeit hast — dann wird das Bild noch genauer:
    </p>
    <ul style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#152238;">
      ${analyse.fehlendeOptionalAngaben.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}
    </ul>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#4A5670;">
      Kein Muss — auch ohne das können wir Dir schon zeigen, was wir sehen.
    </p>`
    : "";

  const vorschlagHtml = vorschlag
    ? `
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#152238;">
      ${vorschlag.anteilText} Bei ähnlich gelagerten Abläufen sehen wir erfahrungsgemäß, dass sich der
      Zeitaufwand für solche Teilschritte häufig um etwa <strong>20–40 %</strong> senken lässt, wenn
      Medienbrüche (Papier → Excel → Telefon) wegfallen.
    </p>
    ${vorschlag.ursachenText ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#152238;">${vorschlag.ursachenText}</p>` : ""}
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4A5670;">
      Wichtig: Das ist eine grobe Einschätzung auf Basis Deiner Angaben, keine Zusage — wie viel sich
      bei Dir konkret realisieren lässt, sehen wir am besten in einem kurzen, unverbindlichen Gespräch.
    </p>`
    : `
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#152238;">
      Dein Ablauf wirkt schon recht digital unterwegs — hier würden wir im Gespräch gezielt nachfragen,
      wo im Detail noch Zeit verloren geht, bevor wir eine Einschätzung wagen.
    </p>`;

  const betreff = `Deine Digitalisierungs-Analyse: „${f.prozessName}“ bei ${f.firma.name}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#152238;">
  <p>Hallo${name ? " " + escapeHtml(name) : ""},</p>

  <p>
    danke, dass Du Dir die Zeit genommen hast, uns den Ablauf „<strong>${escapeHtml(f.prozessName)}</strong>“
    bei <strong>${escapeHtml(f.firma.name)}</strong> zu beschreiben. Hier ist, was wir daraus für Dich
    sichtbar gemacht haben.
  </p>

  ${fehlendeHtml}

  <h3 style="color:#152238;">So läuft der Ablauf heute (IST)</h3>
  ${diagramm}

  <h3 style="color:#152238;">Wo wir Potenzial sehen</h3>
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
