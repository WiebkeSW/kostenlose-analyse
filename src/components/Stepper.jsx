export default function Stepper({ steps, current, istErledigt, onSelect }) {
  return (
    <ol className="stepper">
      {steps.map((s, i) => {
        const erledigt = istErledigt(i);
        const erreicht = i <= current;
        const klickbar = i <= current && i !== current;
        let zustand = "is-upcoming";
        if (i === current) {
          zustand = erledigt ? "is-current is-current--ok" : "is-current is-current--offen";
        } else if (erreicht) {
          zustand = erledigt ? "is-done" : "is-warn";
        }
        return (
          <li key={s.key} className={`stepper__item ${zustand}`}>
            <button
              type="button"
              className="stepper__button"
              onClick={() => klickbar && onSelect(i)}
              disabled={!klickbar}
              title={klickbar ? "Zurück zu diesem Schritt" : undefined}
            >
              <span className="stepper__badge">
                {erreicht && erledigt && i !== current ? "✓" : s.w ?? i + 1}
              </span>
              <span className="stepper__label">{s.label}</span>
              {erreicht && !erledigt && i !== current && (
                <span className="stepper__flag" title="Hier fehlt noch etwas">
                  !
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
