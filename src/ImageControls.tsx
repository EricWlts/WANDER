import { useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Field, Picture } from "./components";
import { t } from "./I18n";
import type { Photo, ImageEdits, Ratio } from "./types";
import { HoverZoomControl } from "./HoverZoomControl";
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
}: {
  photo: Photo;
  onChange: (patch: Partial<Photo>) => void;
  preview?: boolean;
}) {
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
      null,
    ),
    edits = photo.edits || {};
  const change = (value: Partial<ImageEdits>) =>
    onChange({ edits: { ...edits, ...value } });
  return (
    <div className="image-controls">
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
      <Field label={t("Image fit", "Bilddarstellung")}>
        <select
          value={edits.fit || "cover"}
          onChange={(e) => change({ fit: e.target.value as ImageEdits["fit"] })}
        >
          <option value="cover">
            {t("Fill the frame", "Flächenfüllend zuschneiden")}
          </option>
          <option value="contain">
            {t("Show entire image", "Vollständig anzeigen")}
          </option>
        </select>
      </Field>
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
      <HoverZoomControl
        value={edits.hover_zoom}
        onChange={(hover_zoom) => change({ hover_zoom })}
      />
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
      <Field label={t("Caption / memory", "Bildunterschrift / Erinnerung")}>
        <textarea
          rows={2}
          maxLength={2000}
          value={photo.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
      <Field
        label={t("Alternative description", "Alternative Bildbeschreibung")}
        hint={t(
          "Describes the photograph for assistive technology. Independent of its visible title.",
          "Beschreibt das Foto für assistive Technik, unabhängig vom sichtbaren Titel.",
        )}
      >
        <textarea
          rows={2}
          maxLength={500}
          value={photo.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
        />
      </Field>
      <p className="inspector-note">
        {t(
          "The original image stays unchanged. All adjustments can be reset.",
          "Das Originalbild bleibt unverändert. Alle Anpassungen lassen sich zurücksetzen.",
        )}
      </p>
    </div>
  );
}
