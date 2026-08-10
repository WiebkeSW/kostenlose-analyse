import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { validiereFormular } from "../shared/interviewSchema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data", "submissions");
fs.mkdirSync(DATA_DIR, { recursive: true });

const PORT = 4110;
const app = express();
app.use(express.json({ limit: "200kb" }));

// Sehr einfache Rate-Begrenzung pro IP, um Formular-Spam auszubremsen.
const letzteAnfrage = new Map();
const SPERRZEIT_MS = 30_000;

function istGesperrt(ip) {
  const letzte = letzteAnfrage.get(ip);
  return letzte && Date.now() - letzte < SPERRZEIT_MS;
}

app.post("/api/analyse", (req, res) => {
  const ip = req.ip;
  if (istGesperrt(ip)) {
    return res.status(429).json({ ok: false, fehler: { _rate: "Bitte kurz warten." } });
  }

  const formular = req.body;
  const pruefung = validiereFormular(formular ?? {});

  if (!pruefung.ok) {
    const status = pruefung.verdacht === "bot" ? 400 : 422;
    return res.status(status).json({ ok: false, fehler: pruefung.fehler });
  }

  letzteAnfrage.set(ip, Date.now());

  const eingereichtAm = new Date().toISOString();
  const id =
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const eintrag = { id, eingereichtAm, formular };
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(eintrag, null, 2), "utf-8");

  res.json({ ok: true, id });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Analyse-Server läuft auf http://localhost:${PORT}`);
});
