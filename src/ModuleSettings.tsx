import { useRef, useState } from "react";
import { Field } from "./components";
import { ColorControl, NumberStepper } from "./EditorControls";
import { t } from "./I18n";
import {
  editionColors,
  contrastRatio,
  surfaceColors,
  offsetsFor,
  typePresets,
} from "./journalModel";
import {
  FRAME_FORMATS,
  canMoveCrop,
  dragFrameFocus,
  focusPatch,
  formatFromRatio,
  frameRatio,
  isCentered,
  keyFrameFocus,
  ratioForFormat,
  readFocus,
  TITLE_DEFAULT,
  TITLE_GRID,
  dragTitlePosition,
  gridIndex,
  nudgeTitle,
  snapTitle,
  readTitlePosition,
  titleAlign,
  type FrameFormat,
} from "./imageFrame";
import { focusToPosition } from "./heroFocus";
import type { Chapter, Journey, Layout, Photo } from "./types";
export function AppearanceSettings({
  layout,
  edition,
  inherited,
  moduleScope = false,
  onChange,
}: {
  layout: Layout;
  edition: Journey["story_template"];
  inherited?: string;
  moduleScope?: boolean;
  onChange: (p: Partial<Layout>) => void;
}) {
  return (
    <details className="inspector-section">
      <summary>{t("Surface colour", "Hintergrundfarbe")}</summary>
      <ColorControl
        label={t("Background", "Hintergrund")}
        resetLabel={
          moduleScope
            ? t("Use inherited surface", "Geerbte Fläche verwenden")
            : undefined
        }
        value={layout.background}
        fallback={inherited || editionColors[edition]}
        onChange={(background) => onChange({ background })}
      />
      <p className="inspector-note">
        {moduleScope
          ? t(
              "This module: empty colour follows the story or its own edition.",
              "Dieses Modul: Eine leere Farbe folgt der Geschichte oder ihrer eigenen Edition.",
            )
          : t(
              "Story default: modules inherit this surface unless they choose their own colour or edition.",
              "Vorgabe der Geschichte: Module übernehmen diese Fläche, sofern sie keine eigene Farbe oder Edition wählen.",
            )}
      </p>
    </details>
  );
}
export function TypographySettings({
  layout,
  onChange,
  open = true,
  background = "#EEECE6",
}: {
  layout: Layout;
  open?: boolean;
  background?: string;
  onChange: (p: Partial<Layout>) => void;
}) {
  const ratio = layout.text_color
    ? contrastRatio(layout.text_color, background)
    : undefined;
  return (
    <details className="inspector-section" open={open}>
      <summary>{t("Typography & position", "Typografie & Position")}</summary>
      <Field label={t("Position in layout", "Position im Layout")}>
        <select
          value={layout.text_position || "center"}
          onChange={(e) =>
            onChange({
              text_position: e.target.value as Layout["text_position"],
            })
          }
        >
          <option value="left">{t("Left column", "Linke Spalte")}</option>
          <option value="center">{t("Centre", "Mittig")}</option>
          <option value="right">{t("Right column", "Rechte Spalte")}</option>
          <option value="full">{t("Full width", "Volle Breite")}</option>
        </select>
      </Field>
      <Field label={t("Text alignment", "Textausrichtung")}>
        <select
          value={layout.text_align || "left"}
          onChange={(e) =>
            onChange({ text_align: e.target.value as Layout["text_align"] })
          }
        >
          <option value="left">{t("Left", "Links")}</option>
          <option value="center">{t("Centre", "Zentriert")}</option>
          <option value="right">{t("Right", "Rechts")}</option>
        </select>
      </Field>
      <div className="type-presets">
        {Object.entries(typePresets).map(([key, size]) => (
          <button
            type="button"
            key={key}
            aria-pressed={
              layout.text_preset === key ||
              (!layout.text_preset && key === "medium")
            }
            onClick={() =>
              onChange({
                text_preset: key as Layout["text_preset"],
                text_size: size,
              })
            }
          >
            {
              (
                {
                  small: t("Small", "Klein"),
                  medium: t("Medium", "Mittel"),
                  large: t("Large", "Groß"),
                  display: "Display",
                } as Record<string, string>
              )[key]
            }
          </button>
        ))}
      </div>
      <Field label={t("Typeface", "Schriftstil")}>
        <select
          value={layout.font || "serif"}
          onChange={(e) => onChange({ font: e.target.value as Layout["font"] })}
        >
          <option value="serif">Editorial Serif</option>
          <option value="sans">Manrope Sans</option>
        </select>
      </Field>
      <Field label={t("Maximum line length", "Maximale Zeilenbreite")}>
        <input
          type="range"
          min={24}
          max={100}
          value={layout.text_width || 56}
          onChange={(e) => onChange({ text_width: Number(e.target.value) })}
        />
      </Field>
      <ColorControl
        label={t("Text colour", "Textfarbe")}
        value={layout.text_color}
        fallback={surfaceColors(background).ink}
        resetLabel={t(
          "Use automatic text colour",
          "Automatische Textfarbe verwenden",
        )}
        onChange={(text_color) => onChange({ text_color })}
      />
      <p className="inspector-note">
        {layout.text_color
          ? t(
              "This module uses an individual text colour.",
              "Dieses Modul verwendet eine eigene Textfarbe.",
            )
          : t(
              "Automatic text colour follows this module’s surface.",
              "Die automatische Textfarbe folgt der Fläche dieses Moduls.",
            )}
      </p>
      {ratio !== undefined && ratio < 4.5 && (
        <p className="inspector-note contrast-note">
          {t("Low text contrast", "Geringer Textkontrast")} · {ratio.toFixed(2)}
          :1.{" "}
          {t(
            "Aim for at least 4.5:1 for reading text. Your colour is kept.",
            "Für Lesetext sind mindestens 4,5:1 empfohlen. Deine Farbe bleibt erhalten.",
          )}
        </p>
      )}
      <details className="type-fine">
        <summary>{t("Fine adjustments", "Feineinstellungen")}</summary>
        <NumberStepper
          label={t("Text size", "Textgröße")}
          min={14}
          max={64}
          value={
            layout.text_size || typePresets[layout.text_preset || "medium"]
          }
          onChange={(text_size) => onChange({ text_size })}
        />
        <Field label={t("Heading size", "Überschriftengröße")}>
          <input
            type="range"
            min={28}
            max={160}
            value={layout.title_size || 72}
            onChange={(e) => onChange({ title_size: Number(e.target.value) })}
          />
        </Field>
        {layout.font === "sans" && (
          <Field label={t("Weight", "Schriftgewicht")}>
            <select
              value={layout.font_weight || 400}
              onChange={(e) =>
                onChange({ font_weight: Number(e.target.value) })
              }
            >
              <option value={400}>{t("Regular", "Normal")}</option>
              <option value={500}>Medium</option>
              <option value={600}>Semibold</option>
            </select>
          </Field>
        )}
        <Field label={t("Side margins", "Seitliche Abstände")}>
          <input
            type="range"
            min={0}
            max={120}
            value={layout.inset || 0}
            onChange={(e) => onChange({ inset: Number(e.target.value) })}
          />
        </Field>
      </details>
    </details>
  );
}
export function WallSettings({
  module,
  onChange,
}: {
  module: Chapter;
  onChange: (p: Partial<Layout>) => void;
}) {
  const layout = module.layout || {},
    columns = layout.columns || 4,
    offsets = offsetsFor(layout, columns);
  return (
    <>
      <div className="field-pair">
        <NumberStepper
          label={t("Columns", "Spalten")}
          value={columns}
          min={1}
          max={8}
          onChange={(columns) => onChange({ columns })}
        />
        <NumberStepper
          label={t("Rows per group", "Zeilen pro Gruppe")}
          value={layout.rows || 4}
          min={1}
          max={12}
          onChange={(rows) => onChange({ rows })}
        />
      </div>
      <details className="column-fine">
        <summary>
          {t("Spacing & column offsets", "Abstände & Spaltenversatz")}
        </summary>
        <p className="inspector-note">
          {t(
            "More images form the next group. The final row may remain incomplete.",
            "Weitere Bilder bilden eine neue Gruppe. Die letzte Zeile darf unvollständig bleiben.",
          )}
        </p>
        <Field
          label={`${t("Image gap / overlap", "Bildabstand / Überlagerung")} · ${layout.gap ?? 18} px`}
        >
          <input
            type="range"
            min={-64}
            max={80}
            value={layout.gap ?? 18}
            onChange={(e) => onChange({ gap: Number(e.target.value) })}
          />
        </Field>
        <p className="inspector-note">
          {t(
            "Negative values overlap images. Focused photographs move to the foreground.",
            "Negative Werte überlagern die Bilder. Fokussierte Fotos rücken nach vorne.",
          )}
        </p>
        <Field
          label={t("Middle column offset", "Versatz der mittleren Spalten")}
        >
          <input
            type="range"
            min={-160}
            max={160}
            value={layout.offset ?? 0}
            onChange={(e) =>
              onChange({
                offset: Number(e.target.value),
                align: "staggered",
                column_offsets: undefined,
              })
            }
          />
        </Field>
        <p className="inspector-note">
          {t(
            "Positive values raise the middle columns; negative values lower them.",
            "Positive Werte heben die mittleren Spalten an, negative senken sie ab.",
          )}
        </p>
        <details className="column-fine">
          <summary>
            {t("Adjust each column", "Spalten einzeln versetzen")}
          </summary>
          {offsets.map((value, i) => (
            <NumberStepper
              key={i}
              label={`${t("Column", "Spalte")} ${i + 1}`}
              min={-160}
              max={160}
              value={value}
              step={8}
              onChange={(v) =>
                onChange({
                  column_offsets: offsets.map((old, index) =>
                    i === index ? v : old,
                  ),
                })
              }
            />
          ))}
        </details>
        <button
          className="text-link"
          type="button"
          onClick={() =>
            onChange({
              offset: 0,
              column_offsets: undefined,
              align: "flush",
              gap: 18,
            })
          }
        >
          {t("Reset arrangement", "Anordnung zurücksetzen")}
        </button>
      </details>
    </>
  );
}

/** Shared image-content dimensions; legacy module padding remains independent. */
export function MediaLayoutSettings({
  layout,
  onChange,
}: {
  layout: Layout;
  onChange: (p: Partial<Layout>) => void;
}) {
  return (
    <>
      <Field label={t("Image area width", "Breite des Bildbereichs")}>
        <select
          value={layout.media_width || ""}
          onChange={(e) =>
            onChange({
              media_width: (e.target.value ||
                undefined) as Layout["media_width"],
            })
          }
        >
          <option value="">{t("Module default", "Modulvorgabe")}</option>
          <option value="cover-image">
            {t("Match cover photograph", "An Titelbild anpassen")}
          </option>
          <option value="cover-frame">
            {t(
              "Match cover including frame",
              "An Titelbild inklusive Rahmen anpassen",
            )}
          </option>
        </select>
      </Field>
      {(
        [
          ["media_spacing_top", t("Top outer spacing", "Außenabstand oben")],
          [
            "media_spacing_bottom",
            t("Bottom outer spacing", "Außenabstand unten"),
          ],
          ["media_spacing", t("Side outer spacing", "Seitlicher Außenabstand")],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={`${label} · ${layout[key] ?? 0} px`}>
          <input
            type="range"
            min={0}
            max={160}
            value={layout[key] ?? 0}
            onChange={(e) => onChange({ [key]: Number(e.target.value) })}
          />
        </Field>
      ))}
      <p className="inspector-note">
        {t(
          "Top, bottom and side spacing are independent. Side spacing is added inside the selected image width.",
          "Oben, unten und seitlich sind unabhängig steuerbar. Seitlicher Abstand liegt innerhalb der gewählten Bildbreite.",
        )}
      </p>
    </>
  );
}

export function RailSettings({
  layout,
  onChange,
}: {
  layout: Layout;
  onChange: (p: Partial<Layout>) => void;
}) {
  return (
    <>
      <Field label={t("Photograph framing", "Bilddarstellung")}>
        <select
          value={layout.rail_mode || "free"}
          onChange={(e) =>
            onChange({ rail_mode: e.target.value as Layout["rail_mode"] })
          }
        >
          <option value="free">{t("Use saved crops", "Gespeicherte Ausschnitte")}</option>
          <option value="single">
            {t("Show whole photographs", "Ganze Fotos zeigen")}
          </option>
        </select>
      </Field>
      <p className="inspector-note">
        {t(
          "Swipe, drag or use the arrow keys to move through the photographs in a loop.",
          "Wischen, ziehen oder die Pfeiltasten nutzen, um zyklisch durch die Fotos zu blättern.",
        )}
      </p>
    </>
  );
}

const formatShapes: Record<FrameFormat, [number, number]> = {
  original: [18, 13],
  "3:2": [18, 12],
  "16:9": [20, 11.25],
  "4:5": [12, 15],
  "1:1": [15, 15],
};
/** Picture format tiles plus a small draggable crop preview for the single-image module. */
export function SingleImageFrame({
  layout,
  photo,
  onChange,
}: {
  layout: Layout;
  photo?: Photo;
  onChange: (p: Partial<Layout>) => void;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    start: { x: number; y: number };
    w: number;
    h: number;
  } | null>(null);
  const format = formatFromRatio(layout.ratio);
  const focus = readFocus(photo?.edits);
  const ratio = photo && format ? frameRatio(format, photo) : undefined;
  const movable = !!photo && !!ratio && format !== "original" && canMoveCrop(ratio, photo);
  const move = (point: { x: number; y: number }) =>
    photo && onChange(focusPatch(layout, photo.id, point));
  const hintId = "single-frame-hint";
  return (
    <div className="single-frame-settings">
      <div
        className="single-frame-tiles"
        role="group"
        aria-label={t("Picture format", "Bildformat")}
      >
        {FRAME_FORMATS.map((option) => {
          const [w, h] = formatShapes[option.id];
          return (
            <button
              key={option.id}
              type="button"
              className="single-frame-tile"
              aria-pressed={format === option.id}
              onClick={() => onChange({ ratio: ratioForFormat(option.id) })}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <rect
                  x={12 - w / 2}
                  y={12 - h / 2}
                  width={w}
                  height={h}
                  rx="1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              <span>{t(...option.label)}</span>
            </button>
          );
        })}
      </div>
      {format === null && (
        <p className="inspector-note">
          {t(
            "A custom format is set; pick one here to replace it.",
            "Ein eigenes Format ist gesetzt; hier wählen ersetzt es.",
          )}
        </p>
      )}
      {photo && format && format !== "original" && ratio && (
        <div className="single-frame-crop">
          <div
            className="single-frame-preview"
            style={{ aspectRatio: String(ratio) }}
            tabIndex={movable ? 0 : -1}
            role="group"
            aria-label={t(
              "Image crop: drag or use arrow keys to move",
              "Bildausschnitt: Ziehen oder Pfeiltasten zum Verschieben",
            )}
            aria-describedby={hintId}
            data-movable={movable || undefined}
            onPointerDown={(e) => {
              if (!movable) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const box = e.currentTarget.getBoundingClientRect();
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                start: focus,
                w: box.width,
                h: box.height,
              };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              move(
                dragFrameFocus(
                  d.start,
                  { dx: e.clientX - d.x, dy: e.clientY - d.y },
                  { width: d.w, height: d.h },
                  photo,
                ),
              );
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onKeyDown={(e) => {
              if (!movable) return;
              if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                move(keyFrameFocus(focus, e.key, e.shiftKey));
              }
            }}
          >
            <img
              src={photo.url}
              srcSet={photo.srcset}
              sizes="320px"
              alt=""
              draggable={false}
              style={{ objectPosition: focusToPosition(focus) }}
            />
          </div>
          <p className="inspector-note" id={hintId}>
            {movable
              ? t("Drag to move the crop", "Zum Verschieben ziehen")
              : t("This format shows the whole image", "Dieses Format zeigt das ganze Bild")}
          </p>
          {movable && (
            <button
              type="button"
              className="text-link"
              disabled={isCentered(focus)}
              onClick={() => move({ x: 50, y: 50 })}
            >
              {t("Reset to centre", "Zurücksetzen")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const gridNames: [string, string][] = [
  ["Top left", "Oben links"],
  ["Top centre", "Oben Mitte"],
  ["Top right", "Oben rechts"],
  ["Middle left", "Mitte links"],
  ["Centre", "Mitte"],
  ["Middle right", "Mitte rechts"],
  ["Bottom left", "Unten links"],
  ["Bottom centre", "Unten Mitte"],
  ["Bottom right", "Unten rechts"],
];
/** Drag the title block over a small cover preview, or pick one of nine points. */
export function TitlePositionControl({
  layout,
  cover,
  title,
  subtitle,
  onChange,
}: {
  layout: Layout;
  cover?: Photo | null;
  title: string;
  subtitle?: string;
  onChange: (p: Partial<Layout>) => void;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    start: { x: number; y: number };
    frame: { width: number; height: number };
    block: { width: number; height: number };
  } | null>(null);
  const stored = readTitlePosition(layout);
  const point = stored ?? TITLE_DEFAULT;
  const [snap, setSnap] = useState<number | null>(null);
  const hintId = "title-position-hint";
  const set = (next: { x: number; y: number } | null) =>
    onChange(
      next
        ? { title_x: next.x, title_y: next.y }
        : { title_x: undefined, title_y: undefined },
    );
  const active = gridIndex(stored);
  return (
    <div className="title-position">
      <div
        className="title-position-preview"
        role="group"
        aria-label={t("Title position preview", "Vorschau der Titelposition")}
      >
        {cover && (
          <img src={cover.url} srcSet={cover.srcset} sizes="320px" alt="" draggable={false} />
        )}
        {TITLE_GRID.map((g, i) => (
          <button
            key={i}
            type="button"
            className="title-snap"
            aria-label={t(...gridNames[i])}
            aria-pressed={active === i}
            data-snap={snap === i || undefined}
            style={{
              left: `calc(8px + (100% - 16px) * ${g.x / 100})`,
              top: `calc(8px + (100% - 16px) * ${g.y / 100})`,
            }}
            onClick={() => set(i === 6 ? null : g)}
          />
        ))}
        <div
          className="title-position-block"
          tabIndex={0}
          role="group"
          aria-label={t(
            "Title block: drag or use arrow keys to move",
            "Titelblock: Ziehen oder Pfeiltasten zum Verschieben",
          )}
          aria-describedby={hintId}
          data-title-align={titleAlign(point.x)}
          style={{
            left: `calc(8px + (100% - 16px) * ${point.x / 100})`,
            top: `calc(8px + (100% - 16px) * ${point.y / 100})`,
            translate: `${-point.x}% ${-point.y}%`,
            textAlign: titleAlign(point.x),
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const box = e.currentTarget.getBoundingClientRect();
            const frame = e.currentTarget.parentElement!.getBoundingClientRect();
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              start: point,
              frame: { width: frame.width - 16, height: frame.height - 16 },
              block: { width: box.width, height: box.height },
            };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const moved = snapTitle(
              dragTitlePosition(
                d.start,
                { dx: e.clientX - d.x, dy: e.clientY - d.y },
                d.frame,
                d.block,
              ),
            );
            setSnap(moved.index);
            set(moved.point);
          }}
          onPointerUp={() => {
            drag.current = null;
            setSnap(null);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setSnap(null);
          }}
          onKeyDown={(e) => {
            if (
              ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              set(nudgeTitle(stored, e.key, e.shiftKey));
            }
          }}
        >
          {title || t("Title", "Titel")}
          {subtitle && <small>{subtitle}</small>}
        </div>
      </div>
      <p className="inspector-note" id={hintId}>
        {t(
          "Drag the title to place it; it snaps to nine positions",
          "Titel ziehen; er rastet an neun Positionen ein",
        )}
      </p>
      <div className="title-position-tools">
        <button
          type="button"
          className="text-link"
          disabled={!stored}
          onClick={() => set(null)}
        >
          {t("Reset", "Zurücksetzen")}
        </button>
      </div>
    </div>
  );
}
