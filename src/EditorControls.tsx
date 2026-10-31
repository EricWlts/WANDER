import { useEffect, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Field } from "./components";
import { t } from "./I18n";
export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => setRaw(String(value)), [value]);
  const commit = (text: string) => {
    const n = Number(text);
    const next =
      Number.isFinite(n) && text.trim()
        ? Math.max(min, Math.min(max, Math.round(n)))
        : value;
    setRaw(String(next));
    onChange(next);
  };
  return (
    <div className="number-control">
      <span>{label}</span>
      <div className="number-stepper">
        <button
          type="button"
          aria-label={`${label}: ${t("decrease", "verringern")}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus size={15} />
        </button>
        <input
          aria-label={label}
          inputMode="numeric"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            if (/^-?\d+$/.test(e.target.value)) {
              const n = Number(e.target.value);
              if (n >= min && n <= max) onChange(n);
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(raw);
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onChange(Math.min(max, value + step));
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              onChange(Math.max(min, value - step));
            }
          }}
        />
        <button
          type="button"
          aria-label={`${label}: ${t("increase", "erhöhen")}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
export function ColorControl({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value?: string;
  fallback: string;
  onChange: (v: string | undefined) => void;
}) {
  const [raw, setRaw] = useState(value || ""),
    [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setRaw(value || "");
    setInvalid(false);
  }, [value]);
  function change(s: string) {
    setRaw(s);
    const valid = /^#[\da-f]{3}([\da-f]{3})?$/i.test(s);
    setInvalid(!valid && s !== "");
    if (valid) onChange(s.toUpperCase());
    if (s === "") onChange(undefined);
  }
  return (
    <div className="color-control">
      <Field label={label}>
        <div className="color-input">
          <input
            type="color"
            aria-label={t("Choose colour", "Farbe wählen") + ": " + label}
            value={
              (value || fallback).length === 4
                ? "#" +
                  (value || fallback)
                    .slice(1)
                    .split("")
                    .map((c) => c + c)
                    .join("")
                : value || fallback
            }
            onChange={(e) => change(e.target.value)}
          />
          <input
            aria-label={t("HEX colour", "HEX-Farbwert") + ": " + label}
            aria-invalid={invalid}
            placeholder={fallback}
            value={raw}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => change(e.target.value)}
          />
        </div>
      </Field>
      {invalid && (
        <small className="form-error" role="alert">
          {t("Use #RGB or #RRGGBB.", "Bitte #RGB oder #RRGGBB eingeben.")}
        </small>
      )}
      <div className="color-swatches">
        {["#ECEDEB", "#F5F5F2", "#DCE2DE", "#C5CDC5", "#20241F", "#182722"].map(
          (c) => (
            <button
              type="button"
              key={c}
              aria-label={label + " " + c}
              aria-pressed={value?.toUpperCase() === c}
              style={{ background: c }}
              onClick={() => change(c)}
            />
          ),
        )}
      </div>
      <button
        type="button"
        className="text-link"
        onClick={() => {
          setRaw("");
          setInvalid(false);
          onChange(undefined);
        }}
      >
        <RotateCcw size={13} />
        {t("Reset to theme colour", "Theme-Farbe wiederherstellen")}
      </button>
    </div>
  );
}
