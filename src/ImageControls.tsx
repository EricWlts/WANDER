import { useRef, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Field, Picture } from "./components";
import { SegmentedControl } from "./EditorControls";
import { t } from "./I18n";
import type { Photo, ImageEdits, Ratio } from "./types";
export const ratios: Ratio[] = [
  "original",
  "free",
  "1:1",
  "3:2",
  "4:3",
  "4:5",
  "16:9",
];
export function ImageControls({
  photo,
  onChange,
  preview = true,
  children,
}: {
  photo: Photo;
  onChange: (patch: Partial<Photo>) => void;
  preview?: boolean;
  /** Actions shown after the basic settings and before the closed "Feinschliff". */
  children?: ReactNode;
}) {
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
      null,
    ),
    edits = photo.edits || {};
  const change = (value: Partial<ImageEdits>) =>
    onChange({ edits: { ...edits, ...value } });
  return (
    <div className="image-controls">
      <label className="check-field">
        <input
          type="checkbox"
          checked={edits.show_title || false}
          onChange={(e) => change({ show_title: e.target.checked })}
        />
        {t("Show title", "Titel anzeigen")}
      </label>
      <Field label={t("Photograph title", "Bildtitel")}>
        <input
          maxLength={160}
          value={photo.title === "Untitled photograph" ? "" : photo.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field
        label={t("Caption (optional)", "Bildunterschrift (optional)")}
        hint={t(
          "Appears below the photograph in the full-screen view.",
          "Erscheint unter dem Foto in der Großansicht.",
        )}
      >
        <textarea
          rows={2}
          maxLength={2000}
          value={photo.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
      <Field
        label={t("Description for screen readers", "Bildbeschreibung für Screenreader")}
        hint={t(
          "Not shown. Describes the image for people who cannot see it and for search engines. One sentence is enough, e.g. “Gulls above red roofs by the sea”.",
          "Wird nicht angezeigt. Beschreibt das Bild für Menschen, die nicht sehen können, und für Suchmaschinen. Ein Satz genügt, z. B. „Möwen über roten Dächern am Meer“.",
        )}
      >
        <textarea
          rows={2}
          maxLength={500}
          value={photo.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
        />
      </Field>
      <Field label={t("Aspect ratio", "Bildformat")}>
          <select
            value={edits.ratio || "original"}
            onChange={(e) => change({ ratio: e.target.value as Ratio })}
          >
            {ratios.map((r) => (
              <option key={r} value={r}>
                {r === "original"
                  ? t("Original", "Originalformat")
                  : r === "free"
                    ? t("Free crop", "Freier Zuschnitt")
                    : r}
              </option>
            ))}
          </select>
        </Field>
        {edits.ratio === "free" && (
          <Field label={t("Free aspect ratio", "Freies Seitenverhältnis")}>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.01"
              value={edits.free_ratio || 1.5}
              onChange={(e) => change({ free_ratio: Number(e.target.value) })}
            />
          </Field>
        )}
      <SegmentedControl
        label={t("Display", "Darstellung")}
        value={edits.fit || "cover"}
        options={[
          { value: "contain", label: t("Show whole photo", "Ganzes Foto zeigen") },
          { value: "cover", label: t("Fill the frame", "Flächenfüllend") },
        ]}
        onChange={(fit) => change({ fit })}
      />
      {children}
      <details className="inspector-section inspector-fine">
        <summary>{t("Fine-tuning", "Feinschliff")}</summary>
        {preview && (
          <div
            className="crop-surface"
            role="group"
            aria-label={t(
              "Drag the image to adjust the crop; click to set focus",
              "Bild ziehen für den Ausschnitt; klicken für den Fokuspunkt",
            )}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                px: edits.x ?? 50,
                py: edits.y ?? 50,
              };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const r = e.currentTarget.getBoundingClientRect();
              change({
                x: Math.max(
                  0,
                  Math.min(
                    100,
                    drag.current.px -
                      ((e.clientX - drag.current.x) / r.width) * 100,
                  ),
                ),
                y: Math.max(
                  0,
                  Math.min(
                    100,
                    drag.current.py -
                      ((e.clientY - drag.current.y) / r.height) * 100,
                  ),
                ),
              });
            }}
            onPointerUp={(e) => {
              if (
                drag.current &&
                Math.hypot(
                  e.clientX - drag.current.x,
                  e.clientY - drag.current.y,
                ) < 4
              ) {
                const r = e.currentTarget.getBoundingClientRect();
                change({
                  x: ((e.clientX - r.left) / r.width) * 100,
                  y: ((e.clientY - r.top) / r.height) * 100,
                });
              }
              drag.current = null;
            }}
            onPointerCancel={() => (drag.current = null)}
          >
            <Picture photo={photo} eager sizes="600px" />
            <span
              className="focus-point"
              style={{ left: `${edits.x ?? 50}%`, top: `${edits.y ?? 50}%` }}
            />
          </div>
        )}
        {(
          [
            ["x", t("Horizontal focus", "Horizontaler Fokus")],
            ["y", t("Vertical focus", "Vertikaler Fokus")],
            ["zoom", t("Zoom", "Zoom")],
          ] as const
        ).map(([key, label]) => (
          <Field
            key={key}
            label={`${label} · ${key === "zoom" ? (edits[key] || 1).toFixed(2) : Math.round(edits[key] ?? 50) + "%"}`}
          >
            <input
              type="range"
              min={key === "zoom" ? 1 : 0}
              max={key === "zoom" ? 3 : 100}
              step={key === "zoom" ? 0.01 : 1}
              value={edits[key] ?? (key === "zoom" ? 1 : 50)}
              disabled={edits.fit === "contain"}
              onChange={(e) => change({ [key]: Number(e.target.value) })}
            />
          </Field>
        ))}
        <button
          type="button"
          className="text-link"
          onClick={() =>
            onChange({
              edits: {
                ratio: "original",
                fit: "cover",
                x: 50,
                y: 50,
                zoom: 1,
                free_ratio: 1.5,
                show_title: edits.show_title || false,
                hover_zoom: edits.hover_zoom,
              },
            })
          }
        >
          <RotateCcw size={15} />
          {t("Reset crop", "Zuschnitt zurücksetzen")}
        </button>
        <p className="inspector-note">
          {t(
            "The original stays unchanged. Reset crop restores this placement to its original framing; titles and descriptions belong to the source photograph.",
            "Das Original bleibt unverändert. Zuschnitt zurücksetzen stellt diese Bildverwendung auf den ursprünglichen Ausschnitt zurück; Titel und Beschreibungen gehören zum Ausgangsfoto.",
          )}
        </p>
      </details>
    </div>
  );
}
