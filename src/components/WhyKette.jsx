import { MAX_WHY_TIEFE } from "../../shared/interviewSchema.js";

const LABELS = ["Wieso?", "Weshalb?", "Warum?", "Warum noch?", "Und im Kern: warum?"];

export default function WhyKette({ kette, index, onChange, onRemove, removable }) {
  const warums = kette.warums;

  function setSymptom(value) {
    onChange({ ...kette, symptom: value });
  }

  function setWarum(i, value) {
    const next = [...warums];
    next[i] = value;
    onChange({ ...kette, warums: next });
  }

  function addWarum() {
    if (warums.length >= MAX_WHY_TIEFE) return;
    onChange({ ...kette, warums: [...warums, ""] });
  }

  function removeWarum(i) {
    if (warums.length <= 1) return;
    onChange({ ...kette, warums: warums.filter((_, j) => j !== i) });
  }

  return (
    <div className="why-kette">
      <div className="why-kette__head">
        <label>
          Was nervt an dieser Stelle am meisten?
          <input
            type="text"
            value={kette.symptom}
            onChange={(e) => setSymptom(e.target.value)}
            placeholder="z. B. „Die Freigabe dauert immer mehrere Tage.“"
          />
        </label>
        {removable && (
          <button type="button" className="link-btn" onClick={onRemove}>
            Problem entfernen
          </button>
        )}
      </div>

      {warums.map((w, i) => (
        <label key={i} className="why-kette__step">
          {LABELS[Math.min(i, LABELS.length - 1)]}
          <div className="why-kette__row">
            <textarea
              value={w}
              onChange={(e) => setWarum(i, e.target.value)}
              rows={2}
              placeholder="Kurz antworten — es geht um den Grund, nicht um Details."
            />
            {warums.length > 1 && i === warums.length - 1 && (
              <button type="button" className="link-btn" onClick={() => removeWarum(i)}>
                zurück
              </button>
            )}
          </div>
        </label>
      ))}

      {warums.length < MAX_WHY_TIEFE && (
        <button type="button" className="secondary-btn" onClick={addWarum}>
          Noch tiefer fragen — warum ist das so?
        </button>
      )}
      {warums.length >= MAX_WHY_TIEFE && (
        <p className="hint">Nach fünf „Warum“ hat man meist den wirklichen Grund gefunden.</p>
      )}
    </div>
  );
}
