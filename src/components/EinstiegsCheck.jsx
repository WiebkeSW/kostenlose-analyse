import { useState } from "react";

// Der 5-Fragen-Schnell-Check als Türöffner vor der eigentlichen Analyse —
// gleiches Konzept und gleicher Look wie das eigenständige digital-check.html.
// Nach dem Absenden der Kontaktdaten geht es direkt in den Analyse-Wizard weiter.

const QUESTIONS = [
  {
    title: "Wie laufen eure Kernprozesse heute überwiegend ab?",
    options: [
      { text: "Papier, Excel-Listen oder mündliche Absprachen", score: 2 },
      { text: "Ein Mix aus Software und manuellen Schritten", score: 1 },
      { text: "Durchgängig in digitalen Systemen", score: 0 },
    ],
  },
  {
    title: "Wie tauscht ihr Infos zwischen Abteilungen aus?",
    options: [
      { text: "Persönlich, per Zuruf oder Zettel", score: 2 },
      { text: "E-Mail oder Chat, aber ohne zentrales System", score: 1 },
      { text: "Gemeinsames System mit klaren Zuständigkeiten", score: 0 },
    ],
  },
  {
    title:
      "Wie viel Zeit geht wöchentlich für wiederkehrende manuelle Aufgaben drauf (Dateneingabe, Copy-Paste, Listen pflegen)?",
    options: [
      { text: "Spürbar viel – mehrere Stunden pro Woche", score: 2 },
      { text: "Etwas, aber im Rahmen", score: 1 },
      { text: "Kaum, das meiste läuft automatisch", score: 0 },
    ],
  },
  {
    title: "Setzt ihr aktuell Automatisierung oder KI-Tools im Arbeitsalltag ein?",
    options: [
      { text: "Nein, noch gar nicht", score: 2 },
      { text: "Vereinzelt, in einzelnen Bereichen", score: 1 },
      { text: "Ja, regelmäßig und mit klarem Nutzen", score: 0 },
    ],
  },
  {
    title: "Könnt ihr jederzeit auf aktuelle Kennzahlen zugreifen, um Entscheidungen zu treffen?",
    options: [
      { text: "Kaum – Zahlen sind verstreut oder veraltet", score: 2 },
      { text: "Mit etwas Aufwand zusammensuchbar", score: 1 },
      { text: "Ja, jederzeit aktuell verfügbar", score: 0 },
    ],
  },
];
const MAX_SCORE = QUESTIONS.length * 2;

const ERGEBNIS_TEXTE = {
  low: {
    badge: "Digitalisierungsbedarf: gering",
    headline: "Ihr seid schon gut aufgestellt.",
    text: "Eure Prozesse laufen weitgehend digital und automatisiert. Es gibt vermutlich noch einzelne Stellschrauben – die kostenlose Analyse zeigt euch, wo genau.",
  },
  mid: {
    badge: "Digitalisierungsbedarf: mittel",
    headline: "Da geht noch spürbar was.",
    text: "Ihr habt schon digitale Ansätze, aber auch klare Lücken – vermutlich kostet euch das jede Woche Zeit. Die Analyse zeigt, wo der größte Hebel liegt.",
  },
  high: {
    badge: "Digitalisierungsbedarf: hoch",
    headline: "Hier liegt viel Potenzial.",
    text: "Vieles läuft aktuell noch manuell – das kostet Zeit, Nerven und wahrscheinlich auch Geld. Die Analyse zeigt euch schnell, wo ihr am meisten gewinnt.",
  },
};

function levelVon(score) {
  if (score <= 3) return "low";
  if (score <= 6) return "mid";
  return "high";
}

export default function EinstiegsCheck({ onWeiter }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState(new Array(QUESTIONS.length).fill(null));
  const [fertig, setFertig] = useState(false);
  const [lead, setLead] = useState({ name: "", firma: "", email: "", telefon: "", consent: false });

  const score = answers.reduce((a, b) => a + (b || 0), 0);
  const level = levelVon(score);
  const pct = Math.round((score / MAX_SCORE) * 100);

  function waehleAntwort(punkte) {
    const next = [...answers];
    next[current] = punkte;
    setAnswers(next);
    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      setFertig(true);
    }
  }

  function zurueck() {
    if (fertig) {
      setFertig(false);
      return;
    }
    if (current > 0) setCurrent(current - 1);
  }

  function absenden(e) {
    e.preventDefault();
    onWeiter({ ...lead, quizScore: score, quizLevel: level });
  }

  return (
    <div className="wrap">
      <div className="eyebrow">Schnell-Check · 2 Minuten</div>
      <h1>Wie digital ist deine Firma wirklich?</h1>
      <p className="lead">
        5 kurze Fragen, ehrliche Einschätzung. Am Ende geht's direkt weiter in die kostenlose
        Analyse.
      </p>

      <div className="card">
        {!fertig && (
          <div>
            <div className="progress-row">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${((current + 1) / QUESTIONS.length) * 100}%` }}
                />
              </div>
              <div className="progress-num">
                {current + 1} / {QUESTIONS.length}
              </div>
            </div>
            <div className="q-title">{QUESTIONS[current].title}</div>
            <div>
              {QUESTIONS[current].options.map((opt) => (
                <button
                  key={opt.text}
                  type="button"
                  className="opt"
                  onClick={() => waehleAntwort(opt.score)}
                >
                  {opt.text}
                </button>
              ))}
            </div>
            <div className="nav-row">
              <button
                type="button"
                className="btn-back"
                onClick={zurueck}
                disabled={current === 0}
              >
                ← Zurück
              </button>
            </div>
          </div>
        )}

        {fertig && (
          <div>
            <div className={`result-badge ${level}`}>
              <span className="dot" />
              <span>{ERGEBNIS_TEXTE[level].badge}</span>
            </div>
            <div className="result-headline">{ERGEBNIS_TEXTE[level].headline}</div>
            <p className="result-text">{ERGEBNIS_TEXTE[level].text}</p>
            <div className="meter-track">
              <div className={`meter-fill ${level}`} style={{ width: `${pct}%` }} />
            </div>

            <div className="cta-box">
              <div className="cta-title">Kostenlose Analyse für eure Firma anfragen</div>
              <p className="cta-text">
                Weiter geht's mit ein paar Fragen zu einem konkreten Ablauf bei euch. Am Ende
                zeigen wir euch kostenlos, wo ihr steht, wo ihr hinkönnt, was es kostet, was es
                spart.
              </p>

              <form onSubmit={absenden}>
                <label htmlFor="ec-name">Name</label>
                <input
                  id="ec-name"
                  type="text"
                  required
                  value={lead.name}
                  onChange={(e) => setLead({ ...lead, name: e.target.value })}
                />

                <label htmlFor="ec-firma">Firma</label>
                <input
                  id="ec-firma"
                  type="text"
                  required
                  value={lead.firma}
                  onChange={(e) => setLead({ ...lead, firma: e.target.value })}
                />

                <label htmlFor="ec-email">E-Mail</label>
                <input
                  id="ec-email"
                  type="email"
                  required
                  value={lead.email}
                  onChange={(e) => setLead({ ...lead, email: e.target.value })}
                />

                <label htmlFor="ec-tel">
                  Telefon <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="ec-tel"
                  type="tel"
                  value={lead.telefon}
                  onChange={(e) => setLead({ ...lead, telefon: e.target.value })}
                />

                <div className="consent-row">
                  <input
                    type="checkbox"
                    required
                    checked={lead.consent}
                    onChange={(e) => setLead({ ...lead, consent: e.target.checked })}
                  />
                  <span>
                    Ich bin einverstanden, dass ihr mich zu diesem Anliegen kontaktiert.
                  </span>
                </div>

                <button type="submit" className="btn-primary">
                  Weiter zur Analyse
                </button>
              </form>
              <div className="fine-print">
                Dauert noch etwa 8–10 Minuten – danach meldet sich ein Mensch bei euch zurück.
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="fine-print" style={{ marginTop: "1.4rem" }}>
        Dieser Check ersetzt keine vollständige Analyse, gibt aber eine erste, ehrliche Richtung.
      </p>
    </div>
  );
}
