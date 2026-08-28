import { useEffect, useMemo, useRef, useState } from "react";
import Stepper from "./components/Stepper.jsx";
import WhyKette from "./components/WhyKette.jsx";
import EinstiegsCheck from "./components/EinstiegsCheck.jsx";
import {
  BRANCHEN,
  GROESSENKLASSEN,
  HONEYPOT_FIELD,
  leeresFormular,
  leereRolle,
  leererSchritt,
  leererEntscheidungspunkt,
  leereWhyKette,
  validiereFormular,
} from "../shared/interviewSchema.js";

const STEPS = [
  { key: "steckbrief", label: "Über dich", w: "★" },
  { key: "wer", label: "Wer?", w: "Wer?" },
  { key: "wie", label: "Wie?", w: "Wie?" },
  { key: "was", label: "Was?", w: "Was?" },
  { key: "verzweigung", label: "Immer gleich?", w: "?" },
  { key: "warum", label: "Wieso, weshalb, warum?", w: "Warum?" },
  { key: "abschluss", label: "Absenden", w: "✓" },
];

// Welche Fehlerschlüssel (aus validiereFormular) zu welchem Schritt gehören —
// so lässt sich pro Schritt live prüfen, ob er wirklich fertig ist.
const STEP_PREFIXES = [
  ["firma", "prozessName"],
  ["rollen"],
  ["schritte"],
  ["auslöser", "ergebnis"],
  [], // Verzweigungen sind freiwillig — nie "offen"
  ["whyKetten"],
  ["einwilligung"],
];

function offenePunkteFuerSchritt(fehlerObj, stepIndex) {
  const prefixes = STEP_PREFIXES[stepIndex] ?? [];
  return Object.keys(fehlerObj).filter((k) =>
    prefixes.some((p) => k === p || k.startsWith(`${p}.`))
  );
}

// Wer über den kostenlosen digital-check.html-Quiz hierher kommt, hat Name/Firma/
// E-Mail/Telefon schon dort angegeben — per Query-String übergeben, damit man
// hier nicht nochmal von vorn anfängt.
function leadAusUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get("email") && !params.get("firma")) return null;
  return {
    name: params.get("name") || "",
    firma: params.get("firma") || "",
    email: params.get("email") || "",
    telefon: params.get("telefon") || "",
  };
}

function formularMitLead(lead) {
  const leer = leeresFormular();
  if (!lead) return leer;
  return {
    ...leer,
    firma: {
      ...leer.firma,
      name: lead.firma,
      kontaktName: lead.name,
      kontaktEmail: lead.email,
      telefon: lead.telefon,
    },
  };
}

export default function App() {
  const [gestartet, setGestartet] = useState(() => leadAusUrl() !== null);
  const [step, setStep] = useState(0);
  const [formular, setFormular] = useState(() => formularMitLead(leadAusUrl()));
  const [status, setStatus] = useState("entwurf"); // entwurf | senden | ok | fehlgeschlagen
  const bodyRef = useRef(null);

  const pruefung = useMemo(() => validiereFormular(formular), [formular]);
  const fehler = pruefung.fehler; // immer live, nie ein veralteter Schnappschuss

  const offeneImAktuellenSchritt = offenePunkteFuerSchritt(fehler, step);
  const aktuellerSchrittErledigt = offeneImAktuellenSchritt.length === 0;

  // Bei jedem Schrittwechsel: nach oben scrollen und das erste Feld fokussieren,
  // damit man immer sofort sieht und weiß, wo man weitermachen kann.
  useEffect(() => {
    if (!gestartet) return;
    bodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const erstesFeld = bodyRef.current?.querySelector("input, select, textarea");
    erstesFeld?.focus({ preventScroll: true });
  }, [step, gestartet]);

  function update(patch) {
    setFormular((f) => ({ ...f, ...patch }));
  }

  function weiter() {
    if (!aktuellerSchrittErledigt) return; // Aufgabe erst fertig machen, dann weiter
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function zurueck() {
    setStep((s) => Math.max(s - 1, 0));
  }
  function springeZu(i) {
    if (i <= step) setStep(i); // nur zu bereits besuchten Schritten zurückspringen
  }

  async function absenden() {
    setStatus("senden");
    if (!pruefung.ok) {
      setStatus("entwurf");
      return;
    }
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formular),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("ok");
    } catch (e) {
      console.error(e);
      setStatus("fehlgeschlagen");
    }
  }

  function onKeyDown(e) {
    if (e.key !== "Enter") return;
    const tag = e.target.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
    e.preventDefault();
    if (step < STEPS.length - 1) {
      weiter();
    } else if (pruefung.ok) {
      absenden();
    }
  }

  if (status === "ok") {
    return (
      <div className="wrap">
        <div className="card thanks">
          <div className="thanks-icon">✓</div>
          <h1>Danke, {formular.firma.kontaktName.split(" ")[0]}!</h1>
          <p className="result-text" style={{ margin: "0 auto" }}>
            Wir haben alles für die Analyse von <strong>„{formular.prozessName}“</strong> bei{" "}
            <strong>{formular.firma.name}</strong> zusammen. Wir melden uns mit dem Ergebnis per
            E-Mail an <strong>{formular.firma.kontaktEmail}</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (!gestartet) {
    return (
      <EinstiegsCheck
        onWeiter={(lead) => {
          setFormular((f) => ({
            ...f,
            firma: {
              ...f.firma,
              name: lead.firma || f.firma.name,
              kontaktName: lead.name || f.firma.kontaktName,
              kontaktEmail: lead.email || f.firma.kontaktEmail,
              telefon: lead.telefon || f.firma.telefon,
            },
          }));
          setGestartet(true);
        }}
      />
    );
  }

  return (
    <div className="wrap" onKeyDown={onKeyDown}>
      <div className="eyebrow">Kostenlose Digitalisierungs-Analyse</div>
      <header className="app__header">
        <p className="app__fortschritt-text">
          Schritt {step + 1} von {STEPS.length}
        </p>
        <div className="app__fortschritt-balken">
          <div
            className="app__fortschritt-balken-innen"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="card">
      <Stepper
        steps={STEPS}
        current={step}
        istErledigt={(i) => offenePunkteFuerSchritt(fehler, i).length === 0}
        onSelect={springeZu}
      />

      <main className="app__body" ref={bodyRef}>
        {step === 0 && <StepSteckbrief formular={formular} update={update} fehler={fehler} />}
        {step === 1 && <StepWer formular={formular} update={update} fehler={fehler} />}
        {step === 2 && <StepWie formular={formular} update={update} fehler={fehler} />}
        {step === 3 && <StepWas formular={formular} update={update} fehler={fehler} />}
        {step === 4 && <StepVerzweigung formular={formular} update={update} />}
        {step === 5 && <StepWarum formular={formular} update={update} fehler={fehler} />}
        {step === 6 && (
          <StepAbschluss
            formular={formular}
            update={update}
            fehler={fehler}
            pruefung={pruefung}
            onAbsenden={absenden}
            sendeStatus={status}
            springeZu={springeZu}
          />
        )}

        {/* Für Menschen unsichtbares Feld — Bots füllen es meist blind aus */}
        <input
          type="text"
          name={HONEYPOT_FIELD}
          value={formular[HONEYPOT_FIELD]}
          onChange={(e) => update({ [HONEYPOT_FIELD]: e.target.value })}
          className="honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
      </main>

      <footer className="app__nav">
        <button type="button" onClick={zurueck} disabled={step === 0} className="secondary-btn">
          Zurück
        </button>
        {step < STEPS.length - 1 && (
          <div className="app__nav-weiter">
            <button
              type="button"
              onClick={weiter}
              className="primary-btn"
              disabled={!aktuellerSchrittErledigt}
              title={
                aktuellerSchrittErledigt
                  ? undefined
                  : "Bitte erst die offenen Punkte in diesem Schritt ausfüllen."
              }
            >
              Weiter
            </button>
            {!aktuellerSchrittErledigt && (
              <p className="hint hint--warn">
                Noch {offeneImAktuellenSchritt.length} offene Angabe(n) in diesem Schritt.
              </p>
            )}
          </div>
        )}
      </footer>
      </div>
    </div>
  );
}

function StepSteckbrief({ formular, update, fehler }) {
  const f = formular.firma;
  function setFirma(patch) {
    update({ firma: { ...f, ...patch } });
  }
  return (
    <section>
      <h2>Zuerst ein paar Angaben zu dir und deiner Firma</h2>
      <div className="grid2">
        <label>
          Firmenname
          <input value={f.name} onChange={(e) => setFirma({ name: e.target.value })} />
          {fehler["firma.name"] && <Err text={fehler["firma.name"]} />}
        </label>
        <label>
          Branche
          <select value={f.branche} onChange={(e) => setFirma({ branche: e.target.value })}>
            <option value="">Bitte wählen</option>
            {BRANCHEN.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {fehler["firma.branche"] && <Err text={fehler["firma.branche"]} />}
        </label>
        <label>
          Größe
          <select value={f.groesse} onChange={(e) => setFirma({ groesse: e.target.value })}>
            <option value="">Bitte wählen</option>
            {GROESSENKLASSEN.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          {fehler["firma.groesse"] && <Err text={fehler["firma.groesse"]} />}
        </label>
        <label>
          Webseite (freiwillig)
          <input value={f.webseite} onChange={(e) => setFirma({ webseite: e.target.value })} />
        </label>
        <label>
          Ansprechperson
          <input
            value={f.kontaktName}
            onChange={(e) => setFirma({ kontaktName: e.target.value })}
          />
          {fehler["firma.kontaktName"] && <Err text={fehler["firma.kontaktName"]} />}
        </label>
        <label>
          Deine Rolle in der Firma (freiwillig)
          <input
            value={f.meineRolle}
            onChange={(e) => setFirma({ meineRolle: e.target.value })}
            placeholder="z. B. Geschäftsführung, Buchhaltung, Assistenz der GF"
          />
        </label>
        <label>
          E-Mail
          <input
            type="email"
            value={f.kontaktEmail}
            onChange={(e) => setFirma({ kontaktEmail: e.target.value })}
          />
          {fehler["firma.kontaktEmail"] && <Err text={fehler["firma.kontaktEmail"]} />}
        </label>
      </div>
      <label>
        Wie soll dieser Ablauf heißen?
        <input
          value={formular.prozessName}
          onChange={(e) => update({ prozessName: e.target.value })}
          placeholder="z. B. „Rechnungseingang“, „Urlaubsantrag“, „Neuanlage Kunde“"
        />
        {fehler.prozessName && <Err text={fehler.prozessName} />}
      </label>
    </section>
  );
}

function StepWer({ formular, update, fehler }) {
  const rollen = formular.rollen;
  function setRolle(i, patch) {
    const next = [...rollen];
    next[i] = { ...next[i], ...patch };
    update({ rollen: next });
  }
  return (
    <section>
      <h2>Wer? — Wer ist bei diesem Ablauf alles beteiligt?</h2>
      <p className="hint">Personen, Rollen oder Abteilungen — von der eigenen Firma oder von außen.</p>
      {rollen.map((r, i) => (
        <div className="row" key={r.id}>
          <input
            value={r.name}
            onChange={(e) => setRolle(i, { name: e.target.value })}
            placeholder="z. B. „Buchhaltung“, „Kunde“, „Lieferant“"
          />
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={r.intern}
              onChange={(e) => setRolle(i, { intern: e.target.checked })}
            />
            eigene Firma
          </label>
          {rollen.length > 1 && (
            <button
              type="button"
              className="link-btn"
              onClick={() => update({ rollen: rollen.filter((_, j) => j !== i) })}
            >
              entfernen
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="secondary-btn"
        onClick={() => update({ rollen: [...rollen, leereRolle()] })}
      >
        weitere Person/Rolle hinzufügen
      </button>
      {fehler.rollen && <Err text={fehler.rollen} />}
    </section>
  );
}

function StepWie({ formular, update, fehler }) {
  const schritte = formular.schritte;
  function setSchritt(i, patch) {
    const next = [...schritte];
    next[i] = { ...next[i], ...patch };
    update({ schritte: next });
  }
  const rollenNamen = formular.rollen.map((r) => r.name).filter(Boolean);
  return (
    <section>
      <h2>Wie? — Wie läuft das heute ab, Schritt für Schritt?</h2>
      <p className="hint">
        Genau so, wie es wirklich passiert — auch wenn dabei Excel, Papier, E-Mail oder WhatsApp
        im Spiel sind.
      </p>
      {schritte.map((s, i) => (
        <div className="step-card" key={s.id}>
          <span className="step-card__num">{i + 1}</span>
          <div className="step-card__fields">
            <label>
              Was passiert?
              <textarea
                rows={2}
                value={s.beschreibung}
                onChange={(e) => setSchritt(i, { beschreibung: e.target.value })}
                placeholder="z. B. „Buchhaltung prüft die Rechnung gegen die Bestellung.“"
              />
              {fehler[`schritte.${i}`] && <Err text={fehler[`schritte.${i}`]} />}
            </label>
            <div className="grid2">
              <label>
                Wer macht das?
                <input
                  list="rollen-liste"
                  value={s.akteur}
                  onChange={(e) => setSchritt(i, { akteur: e.target.value })}
                />
                {fehler[`schritte.${i}.akteur`] && <Err text={fehler[`schritte.${i}.akteur`]} />}
              </label>
              <label>
                Womit? (z. B. Excel, E-Mail, Software)
                <input
                  value={s.werkzeug}
                  onChange={(e) => setSchritt(i, { werkzeug: e.target.value })}
                  placeholder="Excel, E-Mail, Software-Name, Papier …"
                />
              </label>
            </div>
          </div>
          {schritte.length > 1 && (
            <button
              type="button"
              className="link-btn"
              onClick={() => update({ schritte: schritte.filter((_, j) => j !== i) })}
            >
              entfernen
            </button>
          )}
        </div>
      ))}
      <datalist id="rollen-liste">
        {rollenNamen.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <button
        type="button"
        className="secondary-btn"
        onClick={() => update({ schritte: [...schritte, leererSchritt()] })}
      >
        weiteren Schritt hinzufügen
      </button>
      {fehler.schritte && <Err text={fehler.schritte} />}
    </section>
  );
}

function StepWas({ formular, update, fehler }) {
  return (
    <section>
      <h2>Was? — Was löst das Ganze aus, und was kommt am Ende heraus?</h2>
      <label>
        Wodurch beginnt das Ganze?
        <textarea
          rows={2}
          value={formular.auslöser}
          onChange={(e) => update({ auslöser: e.target.value })}
          placeholder="z. B. „Eine Rechnung kommt per E-Mail oder Post an.“"
        />
        {fehler.auslöser && <Err text={fehler.auslöser} />}
      </label>
      <label>
        Was steht am Ende fest, wenn alles erledigt ist?
        <textarea
          rows={2}
          value={formular.ergebnis}
          onChange={(e) => update({ ergebnis: e.target.value })}
          placeholder="z. B. „Rechnung ist bezahlt und abgelegt.“"
        />
        {fehler.ergebnis && <Err text={fehler.ergebnis} />}
      </label>
      <label>
        Welche Angaben werden dafür gebraucht? (freiwillig)
        <textarea
          rows={2}
          value={formular.benötigteDaten}
          onChange={(e) => update({ benötigteDaten: e.target.value })}
          placeholder="z. B. Bestellnummer, Lieferantendaten, Freigabegrenze …"
        />
      </label>
    </section>
  );
}

function StepVerzweigung({ formular, update }) {
  const punkte = formular.entscheidungspunkte;
  function setPunkt(i, patch) {
    const next = [...punkte];
    next[i] = { ...next[i], ...patch };
    update({ entscheidungspunkte: next });
  }
  return (
    <section>
      <h2>Läuft es immer gleich ab?</h2>
      <details className="warum-hinweis">
        <summary>Warum fragen wir das?</summary>
        <p>
          Viele Abläufe laufen nicht immer gleich — je nach Betrag, Kunde oder Ausnahmefall geht
          es an manchen Stellen anders weiter. Wenn wir das wissen, wird unser Bild vom Ablauf
          vollständiger. Diese Frage ist freiwillig — wenn dir nichts einfällt, einfach weiter.
        </p>
      </details>
      {punkte.map((p, i) => (
        <div className="step-card" key={p.id}>
          <div className="step-card__fields">
            <label>
              An welcher Stelle geht es unterschiedlich weiter?
              <input
                value={p.frage}
                onChange={(e) => setPunkt(i, { frage: e.target.value })}
                placeholder="z. B. „Rechnungsbetrag über 1.000 €?“"
              />
            </label>
            <div className="grid2">
              <label>
                Fall A
                <input value={p.optionA} onChange={(e) => setPunkt(i, { optionA: e.target.value })} />
              </label>
              <label>
                → was passiert dann?
                <input value={p.folgeA} onChange={(e) => setPunkt(i, { folgeA: e.target.value })} />
              </label>
              <label>
                Fall B
                <input value={p.optionB} onChange={(e) => setPunkt(i, { optionB: e.target.value })} />
              </label>
              <label>
                → was passiert dann?
                <input value={p.folgeB} onChange={(e) => setPunkt(i, { folgeB: e.target.value })} />
              </label>
            </div>
          </div>
          <button
            type="button"
            className="link-btn"
            onClick={() => update({ entscheidungspunkte: punkte.filter((_, j) => j !== i) })}
          >
            entfernen
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary-btn"
        onClick={() =>
          update({ entscheidungspunkte: [...punkte, leererEntscheidungspunkt()] })
        }
      >
        Fall hinzufügen
      </button>
    </section>
  );
}

function StepWarum({ formular, update, fehler }) {
  const ketten = formular.whyKetten;
  function setKette(i, next) {
    const arr = [...ketten];
    arr[i] = next;
    update({ whyKetten: arr });
  }
  return (
    <section>
      <h2>Wieso, weshalb, warum?</h2>
      <details className="warum-hinweis" open>
        <summary>Warum fragen wir das gleich mehrmals?</summary>
        <p>
          Bei jedem Problem fragen wir so lange „Warum?“, bis der eigentliche Grund sichtbar wird
          — nicht nur das, was man auf den ersten Blick sieht. Beispiel: „Die Freigabe dauert
          lange“ → „Weil der Chef oft nicht da ist“ → „Weil es keine Vertretung gibt“. Erst bei
          der zweiten oder dritten Antwort kommt man dem echten Grund näher.
        </p>
      </details>
      {ketten.map((k, i) => (
        <WhyKette
          key={k.id}
          kette={k}
          index={i}
          onChange={(next) => setKette(i, next)}
          onRemove={() => update({ whyKetten: ketten.filter((_, j) => j !== i) })}
          removable={ketten.length > 1}
        />
      ))}
      <button
        type="button"
        className="secondary-btn"
        onClick={() => update({ whyKetten: [...ketten, leereWhyKette()] })}
      >
        weiteres Problem hinzufügen
      </button>
      {fehler.whyKetten && <Err text={fehler.whyKetten} />}
    </section>
  );
}

function StepAbschluss({ formular, update, fehler, pruefung, onAbsenden, sendeStatus, springeZu }) {
  const andereOffenePunkte = Object.keys(pruefung.fehler).filter((k) => k !== "einwilligung");
  return (
    <section>
      <h2>Fast fertig — bitte kurz prüfen</h2>
      <Zusammenfassung formular={formular} springeZu={springeZu} />

      <label>
        Sonst noch etwas, das wir wissen sollten? (freiwillig)
        <textarea
          rows={3}
          value={formular.sonstiges}
          onChange={(e) => update({ sonstiges: e.target.value })}
        />
      </label>
      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={formular.einwilligung}
          onChange={(e) => update({ einwilligung: e.target.checked })}
        />
        Ich bin einverstanden, dass diese Angaben für die kostenlose Digitalisierungs-Analyse
        verwendet werden.
      </label>
      {fehler.einwilligung && <Err text={fehler.einwilligung} />}

      {andereOffenePunkte.length > 0 && (
        <p className="hint hint--warn">
          Oben fehlt noch etwas — bitte auf „ändern“ klicken, um es zu ergänzen.
        </p>
      )}

      <button
        type="button"
        className="primary-btn"
        onClick={onAbsenden}
        disabled={sendeStatus === "senden" || !pruefung.ok}
      >
        {sendeStatus === "senden" ? "Wird gesendet …" : "Analyse anfordern"}
      </button>
      {sendeStatus === "fehlgeschlagen" && (
        <Err text="Senden hat nicht funktioniert — bitte nochmal versuchen." />
      )}
    </section>
  );
}

function Zusammenfassung({ formular, springeZu }) {
  const rollen = formular.rollen.filter((r) => r.name?.trim());
  const schritte = formular.schritte.filter((s) => s.beschreibung?.trim());
  const probleme = formular.whyKetten.filter((k) => k.symptom?.trim());

  return (
    <div className="zusammenfassung">
      <ZusammenfassungsBlock titel="Über dich" onEdit={() => springeZu(0)}>
        <p>
          <strong>{formular.firma.name || "—"}</strong> ({formular.firma.branche || "—"}) ·
          Ablauf: „{formular.prozessName || "—"}“
        </p>
      </ZusammenfassungsBlock>

      <ZusammenfassungsBlock titel="Wer beteiligt ist" onEdit={() => springeZu(1)}>
        <p>{rollen.length ? rollen.map((r) => r.name).join(", ") : "—"}</p>
      </ZusammenfassungsBlock>

      <ZusammenfassungsBlock titel="Wie es abläuft" onEdit={() => springeZu(2)}>
        <ol>
          {schritte.map((s) => (
            <li key={s.id}>{s.beschreibung}</li>
          ))}
        </ol>
      </ZusammenfassungsBlock>

      <ZusammenfassungsBlock titel="Auslöser und Ergebnis" onEdit={() => springeZu(3)}>
        <p>Start: {formular.auslöser || "—"}</p>
        <p>Ende: {formular.ergebnis || "—"}</p>
      </ZusammenfassungsBlock>

      <ZusammenfassungsBlock titel="Probleme, die genannt wurden" onEdit={() => springeZu(5)}>
        <p>{probleme.length ? probleme.map((p) => p.symptom).join(" · ") : "—"}</p>
      </ZusammenfassungsBlock>
    </div>
  );
}

function ZusammenfassungsBlock({ titel, onEdit, children }) {
  return (
    <div className="zusammenfassung__block">
      <div className="zusammenfassung__kopf">
        <h3>{titel}</h3>
        <button type="button" className="link-btn" onClick={onEdit}>
          ändern
        </button>
      </div>
      {children}
    </div>
  );
}

function Err({ text }) {
  return <p className="err">{text}</p>;
}
