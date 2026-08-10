// Gemeinsames Schema für Frontend (Wizard) und Backend (Validierung).
// Plain ESM, kein JSX — von src/ (Vite) und server/ (Node) gleichermaßen importierbar.

export const BRANCHEN = [
  "Handwerk",
  "Handel & E-Commerce",
  "Produktion / Fertigung",
  "Dienstleistung",
  "Gesundheit & Pflege",
  "Bau & Immobilien",
  "Gastronomie & Hotellerie",
  "Logistik & Transport",
  "IT & Software",
  "Sonstiges",
];

export const GROESSENKLASSEN = [
  { value: "solo", label: "Solo / 1 Person" },
  { value: "klein", label: "2–9 Mitarbeitende" },
  { value: "mittel", label: "10–49 Mitarbeitende" },
  { value: "gross", label: "50+ Mitarbeitende" },
];

export const HONEYPOT_FIELD = "website_zweit";

export const MIN_LAENGE = {
  prozessName: 4,
  schrittBeschreibung: 6,
  auslöser: 6,
  ergebnis: 6,
  whyAntwort: 8,
};

export const MAX_WHY_TIEFE = 5;
export const MIN_WHY_TIEFE = 2;

// Eine Rolle im Prozess (wird später zur BPMN-Lane).
export function leereRolle() {
  return { id: crypto.randomUUID?.() ?? String(Math.random()), name: "", intern: true };
}

// Ein Prozessschritt (wird später zur BPMN-Task).
export function leererSchritt() {
  return {
    id: crypto.randomUUID?.() ?? String(Math.random()),
    akteur: "",
    beschreibung: "",
    werkzeug: "",
  };
}

// Ein Entscheidungspunkt (wird später zum BPMN-Gateway).
export function leererEntscheidungspunkt() {
  return {
    id: crypto.randomUUID?.() ?? String(Math.random()),
    frage: "",
    optionA: "",
    folgeA: "",
    optionB: "",
    folgeB: "",
  };
}

// Eine 5-Why-Kette zu einem genannten Schmerzpunkt.
export function leereWhyKette() {
  return { id: crypto.randomUUID?.() ?? String(Math.random()), symptom: "", warums: [""] };
}

export function leeresFormular() {
  return {
    firma: {
      name: "",
      branche: "",
      groesse: "",
      webseite: "",
      kontaktName: "",
      kontaktEmail: "",
    },
    prozessName: "",
    // WER
    rollen: [leereRolle(), leereRolle()],
    // WIE
    schritte: [leererSchritt()],
    // WAS
    auslöser: "",
    ergebnis: "",
    benötigteDaten: "",
    // Verzweigungen
    entscheidungspunkte: [],
    // WIESO / WESHALB / WARUM — 5-Why
    whyKetten: [leereWhyKette()],
    sonstiges: "",
    einwilligung: false,
    [HONEYPOT_FIELD]: "",
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Regelbasierte Validierung — läuft identisch im Frontend (sofortiges Feedback)
// und im Backend (verbindliche Prüfung, Client-Ergebnis ist nie vertrauenswürdig).
export function validiereFormular(formular) {
  const fehler = {};

  if (formular[HONEYPOT_FIELD]) {
    return { ok: false, fehler: { _bot: "Honeypot ausgefüllt" }, verdacht: "bot" };
  }

  if (!formular.firma?.name?.trim()) fehler["firma.name"] = "Firmenname fehlt.";
  if (!formular.firma?.branche) fehler["firma.branche"] = "Branche fehlt.";
  if (!formular.firma?.groesse) fehler["firma.groesse"] = "Größenklasse fehlt.";
  if (!formular.firma?.kontaktName?.trim()) fehler["firma.kontaktName"] = "Ansprechperson fehlt.";
  if (!EMAIL_REGEX.test(formular.firma?.kontaktEmail ?? "")) {
    fehler["firma.kontaktEmail"] = "E-Mail-Adresse ist ungültig.";
  }

  if ((formular.prozessName ?? "").trim().length < MIN_LAENGE.prozessName) {
    fehler.prozessName = `Prozessname braucht mindestens ${MIN_LAENGE.prozessName} Zeichen.`;
  }

  const rollen = (formular.rollen ?? []).filter((r) => r.name?.trim());
  if (rollen.length < 1) fehler.rollen = "Mindestens eine Rolle/Akteur angeben.";

  const schritte = (formular.schritte ?? []).filter((s) => s.beschreibung?.trim());
  if (schritte.length < 2) {
    fehler.schritte = "Mindestens zwei Prozessschritte angeben, sonst gibt es keinen Ablauf.";
  } else {
    schritte.forEach((s, i) => {
      if (s.beschreibung.trim().length < MIN_LAENGE.schrittBeschreibung) {
        fehler[`schritte.${i}`] = "Schrittbeschreibung ist zu kurz, um sie zu verstehen.";
      }
      if (!s.akteur?.trim()) {
        fehler[`schritte.${i}.akteur`] = "Zu jedem Schritt gehört ein/e verantwortliche Rolle.";
      }
    });
  }

  if ((formular.auslöser ?? "").trim().length < MIN_LAENGE.auslöser) {
    fehler.auslöser = "Bitte beschreiben, was den Prozess auslöst (mind. ein halber Satz).";
  }
  if ((formular.ergebnis ?? "").trim().length < MIN_LAENGE.ergebnis) {
    fehler.ergebnis = "Bitte beschreiben, was am Ende herauskommt.";
  }

  const whyKetten = (formular.whyKetten ?? []).filter((k) => k.symptom?.trim());
  if (whyKetten.length < 1) {
    fehler.whyKetten = "Mindestens ein Schmerzpunkt mit Warum-Kette angeben.";
  } else {
    whyKetten.forEach((k, i) => {
      const warums = (k.warums ?? []).filter((w) => w?.trim());
      if (warums.length < MIN_WHY_TIEFE) {
        fehler[`whyKetten.${i}`] = `Bei diesem Punkt bitte mindestens ${MIN_WHY_TIEFE}x "Warum?" beantworten.`;
      }
      warums.forEach((w, j) => {
        if (w.trim().length < MIN_LAENGE.whyAntwort) {
          fehler[`whyKetten.${i}.${j}`] = "Antwort ist zu kurz, um eine echte Ursache zu erkennen.";
        }
      });
    });
  }

  if (!formular.einwilligung) {
    fehler.einwilligung = "Einwilligung zur Datenverarbeitung wird für die Analyse benötigt.";
  }

  return { ok: Object.keys(fehler).length === 0, fehler };
}
