# Kostenlose Analyse

Lead-Funnel für die kostenlose Digitalisierungs-Analyse: ein Online-Fragebogen,
der einen Firmenprozess nach dem Prinzip einfacher W-Fragen (Wer? Wie? Was?
Wieso? Weshalb? Warum?) plus 5-Why-Vertiefung erfasst — strukturiert genug,
um daraus ein BPMN-Prozessmodell auf Prozessebene zu erstellen.

## Architektur

```text
src/          React 18 + Vite Frontend (Port 5195) — der Fragebogen-Wizard
server/       Express-Backend (Port 4110) — Validierung, Speicherung als JSON, Mailversand
shared/       Interview-Schema, Validierungsregeln und Mail-Inhalt — von Frontend, Backend UND Skripten genutzt
scripts/      export-prozessrohdaten.js, generate-antwort-mail.js — CLI-Werkzeuge pro Submission
docs/         generierte Prozess-Exporte (siehe unten), nicht versioniert
```

## Starten

```bash
npm install
cp .env.example .env   # SMTP-Zugangsdaten eintragen, siehe unten
npm run server    # Backend auf Port 4110
npm run dev        # Frontend auf Port 5195, proxied /api zum Backend
```

## Ablauf des Fragebogens

1. **Steckbrief** — Firma, Branche, Größe, Kontakt, Prozessname
2. **Wer?** — beteiligte Rollen/Akteure → werden zu BPMN-Lanes
3. **Wie?** — Prozessschritte in Reihenfolge, je mit Akteur + Werkzeug → BPMN-Tasks
4. **Was?** — Auslöser und Ergebnis → BPMN-Start-/End-Event
5. **Verzweigungen** (optional) — Fallunterscheidungen → BPMN-Gateways
6. **Wieso, weshalb, warum?** — pro Schmerzpunkt eine 5-Why-Kette bis zur Wurzelursache
7. **Absenden** — Einwilligung + Versand

Das Formular validiert live im Browser; die verbindliche Prüfung läuft aber
serverseitig (`shared/interviewSchema.js` → `validiereFormular`). Nie dem
Client vertrauen.

## Filterung unseriöser Anfragen

- Pflichtfeld- und Formatprüfung (E-Mail, Mindestlängen bei Freitext)
- Mindestens 2 Prozessschritte, mindestens 2 Warum-Ebenen pro Schmerzpunkt
- Unsichtbares Honeypot-Feld (`website_zweit`) — Bots füllen es meist blind aus
- Einfache IP-basierte Rate-Begrenzung (30 s zwischen Anfragen)

## Antwort-Mail

Nach einer erfolgreichen Submission verschickt das Backend automatisch die
Antwort-Mail an die im Formular angegebene E-Mail-Adresse — sofern SMTP in
`.env` konfiguriert ist (siehe `.env.example`). Ohne Konfiguration läuft die
App weiter normal, es wird nur eine Warnung geloggt und nichts versendet.

Der Mail-Inhalt (Anrede, IST-Prozess-Darstellung, vorsichtiger
Einsparungsvorschlag) liegt in `shared/mailBuilder.js` — dieselbe Logik nutzt
auch das CLI-Skript unten, um einen Entwurf ohne Versand zu erzeugen:

```bash
npm run mail -- latest        # Entwurf als Datei, kein Versand
npm run mail -- <submission-id>
```

## Prozess-Rohdaten für BPMN erzeugen

```bash
npm run export -- latest        # neueste Submission
npm run export -- <submission-id>
```

Erzeugt unter `docs/prozesse/<firma>--<prozess>/`:

- `bpmn-rohdaten.json` — Pool/Lanes/Tasks/Gateways/Events als strukturierte Basis
- `prozess-uebersicht.md` — lesbare Zusammenfassung inkl. 5-Why-Ursachen

Kein automatisch gerendertes Diagramm — das JSON ist die Grundlage für den
nächsten Schritt (BPMN-Modell von Hand oder mit einem weiteren Tool bauen).

## Datenschutz

`server/data/submissions/*.json` enthält reale Kontaktdaten von Interessenten
und ist bewusst nicht versioniert (`.gitignore`). Ebenso die generierten
Exporte unter `docs/prozesse/`.
