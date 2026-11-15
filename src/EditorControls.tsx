import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Field } from "./components";
import { t } from "./I18n";
import { applyPreset, variantState, type StylePreset } from "./editorPresets";
import { JournalCanvas } from "./JournalCanvas";
import { editionColors } from "./journalModel";
import type { Chapter, Journey } from "./types";
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
  resetLabel,
}: {
  label: string;
  value?: string;
  fallback: string;
  resetLabel?: string;
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
        {["#EEECE6", "#F5F5F2", "#DCE2DE", "#C5CDC5", "#1A1D18", "#182722"].map(
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
        {resetLabel ||
          t("Reset to theme colour", "Theme-Farbe wiederherstellen")}
      </button>
    </div>
  );
}

/** Actions behind the variant controls; ModularEditor provides them (stage, inspector, undo). */
export type VariantActions = {
  /** Switches the module to the variant: one step for “Undo”, crossfaded on the stage. */
  apply: (moduleId: number, preset: StylePreset) => void;
  /** Undoes the last variant change of this module, if it is still the latest edit. */
  undo: (moduleId: number) => boolean;
  canUndo: (moduleId: number) => boolean;
};
export const VariantContext = createContext<VariantActions | null>(null);

/** Width the module is laid out at before it is shrunk into a preview. */
const THUMB_BASE = 960;

/** The real module, shrunk: same component, same photographs, only the variant differs. */
function VariantThumb({
  journey,
  module,
  preset,
}: {
  journey: Journey;
  module: Chapter;
  preset: StylePreset;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const [zoom, setZoom] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setZoom(el.clientWidth / THUMB_BASE);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const preview = useMemo<Journey>(
    () => ({
      ...journey,
      chapters: [{ ...module, layout: applyPreset(module.layout, preset) }],
    }),
    [journey, module, preset],
  );
  const edition =
    module.layout?.edition && module.layout.edition !== "inherit"
      ? module.layout.edition
      : journey.story_template || "quiet-atlas";
  return (
    <span
      ref={box}
      className="variant-thumb"
      aria-hidden="true"
      inert
      style={{ background: editionColors[edition] } as CSSProperties}
    >
      {zoom > 0 && (
        <span className="variant-thumb-stage" style={{ width: THUMB_BASE, zoom } as CSSProperties}>
          <JournalCanvas journey={preview} dayId={module.id} thumbnail />
        </span>
      )}
    </span>
  );
}

/**
 * „Gestaltung“: the variants of the module as a row of small real previews. The active one
 * carries a frame; a module with its own fine settings says „Angepasst“ with „Zurücksetzen“.
 */
export function VariantPicker({
  journey,
  module,
}: {
  journey: Journey;
  module: Chapter;
}) {
  const actions = useContext(VariantContext);
  const { list, index, customised } = variantState(module.layout, module.kind);
  if (list.length < 2 || !actions) return null;
  const current = list[index];
  return (
    <div className="variant-picker">
      <div
        className="variant-row"
        role="group"
        aria-label={t("Variants", "Varianten")}
        style={{ "--variant-count": list.length } as CSSProperties}
      >
        {list.map((preset, i) => (
          <button
            key={preset.id}
            type="button"
            className="variant-option"
            aria-pressed={i === index && !customised}
            data-base={i === index && customised ? "" : undefined}
            onClick={() => actions.apply(module.id, preset)}
          >
            <VariantThumb journey={journey} module={module} preset={preset} />
            <span className="variant-name">{t(...preset.label)}</span>
          </button>
        ))}
      </div>
      <div className="variant-status" role="status">
        {customised ? (
          <>
            <span className="variant-custom">{t("Customised", "Angepasst")}</span>
            <button
              type="button"
              className="text-link"
              onClick={() => actions.apply(module.id, current)}
            >
              <RotateCcw size={13} aria-hidden="true" />
              {t("Reset", "Zurücksetzen")}
            </button>
          </>
        ) : (
          <span className="variant-count">
            {t(
              `Variant ${index + 1} of ${list.length}`,
              `Variante ${index + 1} von ${list.length}`,
            )}
            <span aria-hidden="true"> · </span>
            {t(...current.label)}
          </span>
        )}
        {actions.canUndo(module.id) && (
          <button
            type="button"
            className="text-link variant-undo"
            onClick={() => actions.undo(module.id)}
          >
            {t("Undo", "Rückgängig")}
          </button>
        )}
      </div>
    </div>
  );
}


/** A small row of mutually exclusive buttons (aria-pressed), used for the basic settings. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field segmented-field">
      <span id={`${id}-label`}>{label}</span>
      <div className="segmented" role="group" aria-labelledby={`${id}-label`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => value !== option.value && onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Slider with its label on the left and the current value as a number on the right. */
export function RangeField({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: number;
  unit?: string;
  children: ReactElement<{ "aria-labelledby"?: string; "aria-valuetext"?: string }>;
}) {
  const id = useId();
  const text = unit ? `${value} ${unit}` : String(value);
  return (
    <div className="field range-field">
      <div className="range-field-head">
        <span id={`${id}-label`}>{label}</span>
        <output aria-hidden="true">{text}</output>
      </div>
      {cloneElement(children, { "aria-labelledby": `${id}-label`, "aria-valuetext": text })}
    </div>
  );
}
