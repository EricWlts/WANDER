import { useState } from "react";
import { Play } from "lucide-react";
import { Reveal, resolveReveal, revealOptions, textMotion } from "./Reveal";
import { t } from "./I18n";
import type { RevealConfig } from "./types";
const motionLabels: Record<string, [string, string]> = {
  inherit: ["Journey default", "Reisevorgabe"],
  none: ["No animation", "Ohne Animation"],
  fade: ["Fade in", "Einblenden"],
  up: ["Fade in from below", "Einblenden von unten"],
  down: ["Fade in from above", "Einblenden von oben"],
  left: ["Slide in from left", "Von links einschieben"],
  right: ["Slide in from right", "Von rechts einschieben"],
  zoom: ["Gentle zoom", "Sanfter Zoom"],
  parallax: ["Parallax", "Parallax"],
};
export function MotionControl({
  value,
  onChange,
  fallback = textMotion,
  text = "Some moments stay with us.",
  label = "Text motion",
  inherit = true,
  allowParallax = false,
}: {
  value?: RevealConfig;
  onChange: (v: RevealConfig) => void;
  fallback?: RevealConfig;
  text?: string;
  label?: string;
  inherit?: boolean;
  allowParallax?: boolean;
}) {
  const [replay, setReplay] = useState(0),
    resolved = resolveReveal(value, fallback),
    selected = value?.effect || (inherit ? "inherit" : resolved.effect);
  function change(next: RevealConfig) {
    onChange({ ...value, ...next });
    setReplay((v) => v + 1);
  }
  return (
    <details className="motion-control">
      <summary>
        {t(label)}
        <span>{t(...motionLabels[selected])}</span>
      </summary>
      <div className="motion-fields">
        <label>
          {t("Movement", "Bewegung")}
          <select
            aria-label={t("Module animation", "Modulanimation")}
            value={selected}
            onChange={(e) =>
              change({
                effect: e.target.value as RevealConfig["effect"],
                duration: resolved.duration,
              })
            }
          >
            {revealOptions
              .filter(
                (o) =>
                  (inherit || o.value !== "inherit") &&
                  (allowParallax || o.value !== "parallax"),
              )
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {t(...motionLabels[o.value])}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="inspector-note">
        {t(
          "During scrolling, duration controls smoothing. Delay applies to playback previews.",
          "Beim Scrollen steuert die Dauer die Glättung. Die Verzögerung gilt für Wiedergabevorschauen.",
        )}
      </p>
      <details className="motion-advanced">
        <summary>{t("Advanced settings", "Erweiterte Einstellungen")}</summary>
        {(
          [
            [
              "duration",
              600,
              4000,
              100,
              t("Duration / scroll smoothing", "Dauer / Scrollglättung"),
            ],
            ["delay", 0, 3000, 100, t("Preview delay", "Vorschauverzögerung")],
            ["intensity", 0, 100, 1, t("Intensity", "Intensität")],
          ] as const
        ).map(([key, min, max, step, name]) => (
          <label key={key}>
            {name} ·{" "}
            {key === "intensity"
              ? resolved[key]
              : `${(resolved[key] / 1000).toFixed(1)} s`}
            <input
              aria-label={name}
              type="range"
              min={min}
              max={max}
              step={step}
              value={resolved[key]}
              disabled={selected === "inherit" || selected === "none"}
              onChange={(e) => change({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </details>
      <div className="motion-preview">
        <Reveal
          key={`${replay}-${resolved.effect}-${resolved.duration}`}
          config={resolved}
          playback="preview"
        >
          <p>
            {text.trim().slice(0, 200) ||
              t("Some moments stay with us.", "Manche Momente bleiben.")}
          </p>
        </Reveal>
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setReplay((v) => v + 1);
            onChange({ ...value });
          }}
        >
          <Play size={13} />
          {t("Replay in page", "Auf der Seite abspielen")}
        </button>
      </div>
      <small>
        {t(
          "Respects reduced motion and the movement switch.",
          "Berücksichtigt reduzierte Bewegung und den Bewegungsschalter.",
        )}
      </small>
    </details>
  );
}
