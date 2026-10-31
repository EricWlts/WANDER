import { Field } from "./components";
import { ColorControl, NumberStepper } from "./EditorControls";
import { PhotoWall } from "./PhotoWall";
import { t } from "./I18n";
import {
  editionColors,
  modulePhotos,
  offsetsFor,
  typePresets,
} from "./journalModel";
import type { Chapter, Journey, Layout, Photo } from "./types";
export function AppearanceSettings({
  layout,
  edition,
  inherited,
  onChange,
}: {
  layout: Layout;
  edition: Journey["story_template"];
  inherited?: string;
  onChange: (p: Partial<Layout>) => void;
}) {
  return (
    <details className="inspector-section">
      <summary>{t("Surface colour", "Hintergrundfarbe")}</summary>
      <ColorControl
        label={t("Background", "Hintergrund")}
        value={layout.background}
        fallback={inherited || editionColors[edition]}
        onChange={(background) => onChange({ background })}
      />
    </details>
  );
}
export function TypographySettings({
  layout,
  onChange,
  open = true,
}: {
  layout: Layout;
  open?: boolean;
  onChange: (p: Partial<Layout>) => void;
}) {
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
        fallback="#26302B"
        onChange={(text_color) => onChange({ text_color })}
      />
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
  journey,
  onChange,
  onPhoto,
}: {
  module: Chapter;
  journey: Journey;
  onChange: (p: Partial<Layout>) => void;
  onPhoto: (p: Photo) => void;
}) {
  const layout = module.layout || {},
    columns = layout.columns || 4,
    photos = modulePhotos(module, journey),
    offsets = offsetsFor(layout, columns);
  return (
    <>
      <div
        className="wall-live-preview"
        aria-label={t("Live photo wall layout", "Live-Vorschau der Fotowand")}
      >
        <span>{t("Your wall, live", "Deine Fotowand, live")}</span>
        {photos.length ? (
          <div className="wall-preview-canvas">
            <PhotoWall mini photos={photos} layout={layout} onPhoto={onPhoto} />
          </div>
        ) : (
          <p>
            {t(
              "Add photographs to preview this layout.",
              "Füge Fotos hinzu, um das Layout zu sehen.",
            )}
          </p>
        )}
        <small>
          {columns} × {layout.rows || 4} · {photos.length}{" "}
          {t("image placements", "Bildverwendungen")}
        </small>
      </div>
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
      <Field label={t("Middle column offset", "Versatz der mittleren Spalten")}>
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
    </>
  );
}
