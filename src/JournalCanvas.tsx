import { readLayout } from "./editorPresets";
import { type CSSProperties, type ReactNode } from "react";
import { effectivePhotoRatio } from "./storyLayout";
import { pairOffsets, readTitlePosition, titleAlign } from "./imageFrame";
import { Camera, Pencil } from "lucide-react";
import { Picture, dateRange, dateLabel } from "./components";
import { formDateText, formOf } from "./journeyForm";
import { Reveal } from "./Reveal";
import { canPanImage } from "./imageParallax";
import { fixedMotion, fixedReveal, hoverScale } from "./fixedMotion";
import { Parallax } from "./Motion";
import { QuietAtlasChapterCompass } from "./QuietAtlasChapterCompass";
import { Filmstrip } from "./StoryExperience";
import { PhotoRail } from "./PhotoRail";
import { t } from "./I18n";
import {
  modulePhotos,
  rootPhotos,
  editionColors,
  surfaceColors,
  typePresets,
} from "./journalModel";
import { PhotoWall } from "./PhotoWall";
import { MediaLayout } from "./MediaLayout";
import {
  desktopWallColumns,
  usesAutomaticWallComposition,
} from "./storyLayout";
export { modulePhotos } from "./journalModel";
import type { Chapter, Journey, Layout, Photo } from "./types";
import { coverFocusVars } from "./editionOverrides";
import { coverTransitionAttr, coverTransitionStyle } from "./viewTransitions";
export type Selection =
  | { type: "hero" }
  | { type: "module"; id: number }
  | {
      type: "photo";
      id: number;
      moduleId?: number;
      placementId?: string;
      context?: "cover" | "loose" | "filmstrip";
    }
  | { type: "intro" };
export const moduleNames: Record<Chapter["kind"], [string, string]> = {
  chapter: ["Day / chapter", "Tag / Kapitel"],
  hero: ["Cover", "Titelbild"],
  image: ["Single photograph", "Einzelbild"],
  pair: ["Image pair / group", "Bildpaar / Gruppe"],
  rail: ["Horizontal sequence", "Horizontale Bildreihe"],
  filmstrip: ["Moving filmstrip", "Laufender Fotostreifen"],
  wall: ["Photo wall", "Fotowand"],
  gallery: ["Gallery", "Galerie"],
  text: ["Text", "Text"],
  quote: ["Quote", "Zitat"],
};
function layoutStyle(
  l: Layout,
  kind: Chapter["kind"],
  edition: string,
): CSSProperties {
  const chapter = kind === "chapter";
  const defaultGap = chapter && edition !== "after-hours" ? 24 : 18;
  const columns =
    l.columns ||
    (kind === "pair" ? 2 : kind === "image" || kind === "hero" ? 1 : 4);
  return {
    "--module-font":
      l.font === "sans" ? "Manrope, Arial, sans-serif" : "var(--serif)",
    "--module-text-size": `${l.text_size || (kind === "text" && !l.text_preset ? 16 : typePresets[l.text_preset || "medium"])}px`,
    "--module-text-width": `${l.text_width || (chapter ? 60 : 56)}ch`,
    "--module-font-weight": l.font_weight || 400,
    "--module-text-align": l.text_align || "left",
    "--module-inset": `${l.inset ?? 0}px`,
    "--module-cols": columns,
    "--module-gap": `${l.gap ?? defaultGap}px`,
    // Unset padding stays unset so story-polish.css can supply the rhythm scale.
    "--module-padding": l.padding === undefined ? undefined : `${l.padding}px`,
    "--module-offset": `${l.offset ?? 50}px`,
    "--module-mobile-cols": l.mobile_columns ?? Math.min(columns, 2),
    "--module-mobile-gap": `${l.mobile_gap ?? l.gap ?? defaultGap}px`,
    "--module-mobile-padding":
      (l.mobile_padding ?? l.padding) === undefined
        ? undefined
        : `${l.mobile_padding ?? l.padding}px`,
    "--module-title-size": l.title_size ? `${l.title_size}px` : undefined,
    "--module-ratio":
      l.ratio && l.ratio !== "original" ? l.ratio.replace(":", "/") : "auto",
  } as CSSProperties;
}
function Selectable({
  children,
  active,
  editing,
  label,
  onSelect,
  className = "",
  style,
  elementId,
}: {
  children: ReactNode;
  active?: boolean;
  editing?: boolean;
  label: string;
  onSelect: () => void;
  className?: string;
  style?: CSSProperties;
  elementId?: string;
}) {
  return (
    <section
      id={elementId}
      style={style}
      className={`${className} ${editing ? "canvas-editable" : ""} ${active && editing ? "canvas-selected" : ""}`}
      tabIndex={editing ? 0 : -1}
      aria-label={editing ? label : undefined}
      onClick={
        editing
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
      onKeyDown={
        editing
          ? (e) => {
              if (
                e.target === e.currentTarget &&
                (e.key === "Enter" || e.key === " ")
              ) {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      {editing && (
        <span className="canvas-module-label">
          <Pencil size={12} />
          {label}
        </span>
      )}
      {children}
    </section>
  );
}
export function JournalCanvas({
  journey,
  editing = false,
  selected,
  onSelect = () => {},
  onPhoto = () => {},
  onEmptyModule,
  onWriteText,
  replay = 0,
  dayId,
  emptyState,
  thumbnail = false,
}: {
  journey: Journey;
  editing?: boolean;
  selected?: Selection;
  onSelect?: (s: Selection) => void;
  onPhoto?: (p: Photo, sequence?: Photo[]) => void;
  onEmptyModule?: (id: number) => void;
  /** Editor only: the placeholder of an empty text asks to write in the settings panel. */
  onWriteText?: (moduleId: number) => void;
  replay?: number;
  dayId?: number;
  /** Editor only: shown instead of the loose-photo fallback while the story has no modules. */
  emptyState?: ReactNode;
  /** Editor only: a small variant preview of the module given in dayId (no element ids, small images). */
  thumbnail?: boolean;
}) {
  const l = journey.layout || {},
    edition = journey.story_template || "quiet-atlas",
    coverDate = formDateText(formOf(journey), journey.start_date, journey.end_date, {
      range: dateRange,
      day: (day) => dateLabel(day),
    });
  const titlePos = readTitlePosition(l);
  // Empty texts show a quiet invitation in the editor only; the public page renders nothing for them.
  const writeHint =
    formOf(journey) === "journey"
      ? t("What happened on this day?", "Was ist an diesem Tag passiert?")
      : t("One sentence about these pictures.", "Ein Satz zu diesen Bildern.");
  const placeholder = (moduleId: number) =>
    editing && onWriteText ? (
      <button
        type="button"
        className="module-placeholder"
        onClick={(e) => {
          e.stopPropagation();
          onWriteText(moduleId);
        }}
      >
        {writeHint}
      </button>
    ) : null;
  const cover =
    journey.photos.find((p) => p.id === journey.cover_id) || journey.cover;
  const roots = journey.chapters.filter(
    (c) =>
      !c.layout?.parent_id ||
      !journey.chapters.some((d) => d.id === c.layout?.parent_id),
  );
  const rootChapters = roots.filter((chapter) => chapter.kind === "chapter");
  // Photographs that sit in no module are library material, never story content: they are not
  // rendered automatically – not on the public page, not in the editor. Only modules show photos.
  const film = rootPhotos(journey, "filmstrip");
  function photoClick(
    p: Photo,
    moduleId?: number,
    sequence?: Photo[],
    context?: "cover" | "loose" | "filmstrip",
  ) {
    if (editing)
      onSelect({
        type: "photo",
        id: p.id,
        moduleId,
        placementId: p.placement_id,
        context,
      });
    else
      onPhoto(
        p,
        sequence ||
          (moduleId
            ? modulePhotos(
                journey.chapters.find((c) => c.id === moduleId)!,
                journey,
              )
            : journey.photos),
      );
  }
  function render(module: Chapter) {
    const layout = readLayout(module.kind, module.layout),
      photos = modulePhotos(module, journey),
      theme =
        layout.edition && layout.edition !== "inherit"
          ? layout.edition
          : edition;
    const kind = module.kind,
      isHero = kind === "hero",
      // Text and quote sit centred in a block of their own width: the text width (not a side margin) decides there.
      hasSideMargin = layout.margin_x !== undefined && !isHero && kind !== "text" && kind !== "quote",
      single = kind === "image" || isHero;
    const isText = kind === "text" || kind === "quote";
    // Bewegung ist fest (fixedMotion.ts): gespeicherte reveal-Werte werden ignoriert.
    const motion = fixedReveal(kind);
    // Surface colours always follow the edition; legacy custom colours are ignored.
    const surface = surfaceColors(editionColors[theme]);
    const filled =
      !!layout.edition_fill && !!layout.edition && layout.edition !== "inherit";
    const pick = (p: Photo) => photoClick(p, module.id);
    const image = (p: Photo, index = 0) => (
      <figure
        style={
          {
            "--column-offset":
              layout.align === "staggered" &&
              index % (layout.columns || 4) > 0 &&
              index % (layout.columns || 4) < (layout.columns || 4) - 1
                ? `-${layout.offset ?? 50}px`
                : "0px",
          } as CSSProperties
        }
        key={p.placement_id || `${p.id}:${index}`}
        data-photo-id={p.id}
        onClick={(e) => e.stopPropagation()}
        className={
          selected?.type === "photo" && selected.id === p.id && editing
            ? "photo-selected"
            : ""
        }
      >
        <Picture
          photo={
            layout.ratio && layout.ratio !== "original"
              ? {
                  ...p,
                  edits: {
                    ...p.edits,
                    ratio: layout.ratio,
                    fit: layout.fit || p.edits?.fit,
                  },
                }
              : p
          }
          onClick={() => pick(p)}
          sizes={thumbnail ? "240px" : "(max-width:760px) 100vw, 75vw"}
        />
        {p.edits?.show_title && p.title && <figcaption>{p.title}</figcaption>}
      </figure>
    );
    const showTitle = layout.show_title !== false;
    return (
      <Selectable
        elementId={thumbnail ? undefined : `canvas-module-${module.id}`}
        key={module.id}
        style={
          {
            ...layoutStyle(layout, kind, theme),
            "--module-bg": surface.background,
            "--canvas-ink": surface.ink,
            "--module-fill": filled ? editionColors[theme] : undefined,
            "--image-hover-scale": hoverScale(kind),
            "--module-margin-x":
              hasSideMargin ? `${layout.margin_x}px` : undefined,
          } as CSSProperties
        }
        editing={editing}
        active={selected?.type === "module" && selected.id === module.id}
        label={t(...moduleNames[kind])}
        onSelect={() => {
          if (
            !photos.length &&
            !["text", "quote", "chapter"].includes(kind) &&
            onEmptyModule
          )
            onEmptyModule(module.id);
          else onSelect({ type: "module", id: module.id });
        }}
        className={`journal-module module-${kind} module-theme-${theme} module-align-${layout.align || "flush"} module-title-overlay ${layout.frame ? "module-framed" : ""} ${filled ? "module-fill" : ""} ${hasSideMargin ? "has-margin-x" : ""} text-position-${layout.text_position || (kind === "chapter" ? "left" : "center")} ${kind === "chapter" && layout.font === undefined ? "chapter-prose-default-font" : ""} ${kind === "chapter" && layout.text_size === undefined && layout.text_preset === undefined ? "chapter-prose-default-size" : ""} ${kind === "chapter" && layout.text_width === undefined ? "chapter-prose-default-width" : ""} ${kind === "text" && layout.font === undefined ? "text-prose-default-font" : ""} ${kind === "text" && layout.text_size === undefined && layout.text_preset === undefined ? "text-prose-default-size" : ""} ${kind === "text" && layout.text_width === undefined ? "text-prose-default-width" : ""}`}
      >
        <Reveal
          key={`${replay}-${module.id}-${motion.effect}`}
          config={motion}
          textEffect={isText}
          playback="scroll"
        >
          {kind === "chapter" && (
            <div className="module-day-heading">
              {module.date && (
                <span className="eyebrow">
                  {dateLabel(module.date, {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
              <h2>{module.title}</h2>
              {module.story ? (
                <p className="module-prose">{module.story}</p>
              ) : (
                placeholder(module.id)
              )}
              {module.quote && <blockquote>{module.quote}</blockquote>}
            </div>
          )}
          {kind === "text" &&
            (showTitle || module.story || (editing && onWriteText)) && (
              <div className="module-prose">
                {showTitle && <h2>{module.title}</h2>}
                {module.story ? <p>{module.story}</p> : placeholder(module.id)}
              </div>
            )}
          {kind === "quote" && (
            <blockquote>
              {module.quote || module.story}
              {showTitle && <cite>{module.title}</cite>}
            </blockquote>
          )}
          {!["text", "quote", "chapter", "hero"].includes(kind) &&
            layout.show_title && <h2>{module.title}</h2>}
          <MediaLayout
            layout={layout}
            enabled={!isText && kind !== "filmstrip"}
          >
            {isHero ? (
              <div className="module-cover">
                <Parallax
                  intensity={fixedMotion("hero").parallax}
                  enabled={canPanImage(
                    photos[0]
                      ? {
                          ...photos[0],
                          edits: { ...photos[0].edits, fit: layout.fit || photos[0].edits?.fit },
                        }
                      : null,
                  )}
                >
                  {photos[0]
                    ? image(photos[0])
                    : editing && (
                        <div className="module-empty">
                          <Camera />
                          {t(
                            "Choose a cover photograph",
                            "Titelbild auswählen",
                          )}
                        </div>
                      )}
                </Parallax>
                {showTitle && (
                  <div className="module-cover-copy">
                    <h2>{module.title}</h2>
                    {module.story && <p>{module.story}</p>}
                  </div>
                )}
              </div>
            ) : kind === "rail" ||
              (kind === "chapter" && module.gallery_mode === "horizontal") ? (
              <PhotoRail photos={photos} onPhoto={pick} layout={layout} />
            ) : kind === "filmstrip" ? (
              photos.length > 0 ? (
                <Filmstrip
                  photos={photos}
                  onExplore={() => photos[0] && pick(photos[0])}
                  onPhoto={pick}
                  speed={layout.speed}
                />
              ) : null
            ) : (
              photos.length > 0 && (
kind === "image" ? (
                <div className="single-image">
                  <div
                    className="single-image-frame"
                    style={
                      {
                        "--single-ratio": effectivePhotoRatio(
                          layout.ratio && layout.ratio !== "original"
                            ? { ...photos[0], edits: { ...photos[0].edits, ratio: layout.ratio } }
                            : photos[0],
                        ),
                      } as CSSProperties
                    }
                  >
                                    <PhotoWall
                  photos={single ? photos.slice(0, 1) : photos}
                  layout={{
                    ...layout,
                    // Parallax is no longer an author setting.
                    image_parallax: undefined,
                    parallax: undefined,
                    columns: single
                      ? 1
                      : desktopWallColumns(layout, kind, photos.length),
                  }}
                  autoComposition={
                    !single &&
                    ["chapter", "pair", "wall", "gallery"].includes(kind) &&
                    usesAutomaticWallComposition(layout)
                  }
                  onPhoto={pick}
                  selectedId={
                    selected?.type === "photo"
                      ? selected.placementId
                      : undefined
                  }
                />
                  </div>
                </div>
              ) : (
                                <PhotoWall
                  photos={single ? photos.slice(0, 1) : photos}
                  layout={{
                    ...layout,
                    // Parallax is no longer an author setting.
                    image_parallax: undefined,
                    parallax: undefined,
                    ...(kind === "pair" ? { column_offsets: pairOffsets(layout) } : {}),
                    columns: single
                      ? 1
                      : desktopWallColumns(layout, kind, photos.length),
                  }}
                  autoComposition={
                    !single &&
                    ["chapter", "pair", "wall", "gallery"].includes(kind) &&
                    usesAutomaticWallComposition(layout)
                  }
                  onPhoto={pick}
                  selectedId={
                    selected?.type === "photo"
                      ? selected.placementId
                      : undefined
                  }
                />
              )
              )
            )}
          </MediaLayout>
          {!photos.length &&
            !["text", "quote", "chapter", "hero"].includes(kind) &&
            editing && (
              <div className="module-empty">
                <Camera />
                {t("Choose / upload image", "Bild auswählen / hochladen")}
              </div>
            )}
          {kind === "chapter" &&
            journey.chapters
              .filter((c) => c.layout?.parent_id === module.id)
              .map(render)}
        </Reveal>
      </Selectable>
    );
  }
  if (dayId !== undefined) {
    const day = journey.chapters.find((c) => c.id === dayId);
    return (
      <div className={`journal-canvas canvas-theme-${edition}${thumbnail ? " is-thumbnail" : ""}`}>
        <div className="journal-content">{day && render(day)}</div>
      </div>
    );
  }
  return (
    <div
      className={`journal-canvas canvas-theme-${edition} ${editing ? "is-editing" : ""}`}
      style={
        {
          "--canvas-paper": editionColors[edition],
          "--canvas-ink": surfaceColors(editionColors[edition]).ink,
        } as CSSProperties
      }
    >
      <Selectable
        editing={editing}
        active={selected?.type === "hero"}
        label={t("Story cover", "Titelbild")}
        onSelect={() => onSelect({ type: "hero" })}
        className={`journal-cover cover-overlay ${titlePos ? "has-title-pos" : ""}${journey.cover_focus ? " has-cover-focus" : ""}`}
        style={
          {
            "--cover-title-size": l.title_size ? `${l.title_size}px` : undefined,
            "--title-x": titlePos ? titlePos.x : undefined,
            "--title-y": titlePos ? titlePos.y : undefined,
            ...coverFocusVars(journey.cover_focus),
          } as CSSProperties
        }
      >
        <Parallax enabled={Boolean(cover)} intensity={fixedMotion("cover").parallax}>
          <div
            style={editing ? undefined : coverTransitionStyle()}
            {...(editing ? {} : coverTransitionAttr())}
            onClick={
              editing
                ? (e) => {
                    e.stopPropagation();
                    if (cover) photoClick(cover, undefined, undefined, "cover");
                  }
                : undefined
            }
          >
            <Picture
              photo={cover}
              eager
              priority="high"
              className="journal-cover-photo"
              onClick={
                cover
                  ? () => photoClick(cover, undefined, undefined, "cover")
                  : undefined
              }
              actionLabel={
                editing
                  ? t("Edit cover photograph", "Titelbild bearbeiten")
                  : t(
                      "View photograph full size",
                      "Foto in voller Größe ansehen",
                    )
              }
            />
          </div>
        </Parallax>
        <div
          className="journal-cover-copy"
          data-title-align={titlePos ? titleAlign(titlePos.x) : undefined}
        >
          {(journey.location || coverDate) && (
            <span className="eyebrow">
              {journey.location}
              {journey.location && coverDate ? " · " : ""}
              {coverDate}
            </span>
          )}
          <h1 tabIndex={-1}>{journey.title}</h1>
          {journey.subtitle && <p>{journey.subtitle}</p>}
        </div>
      </Selectable>
      {journey.introduction && (
        <Selectable
          editing={editing}
          active={selected?.type === "intro"}
          label={t("Introduction", "Einleitung")}
          onSelect={() => onSelect({ type: "intro" })}
          className="journal-intro"
        >
          <p>{journey.introduction}</p>
        </Selectable>
      )}
      {!editing && rootChapters.length > 1 && (
        <QuietAtlasChapterCompass chapters={rootChapters} />
      )}
      <div id="journal-content" className="journal-content">
        {emptyState && roots.length === 0 && (
          <div className="journal-empty-state">{emptyState}</div>
        )}
        {roots.map(render)}
      </div>
      {film.length > 0 && (
        <Filmstrip
          photos={film}
          onPhoto={(p) => photoClick(p, undefined, film, "filmstrip")}
          onExplore={() => {
            const p = film[0];
            if (p) photoClick(p, undefined, film, "filmstrip");
          }}
        />
      )}
      {(journey.reflection || journey.closing) && (
        <div className="journal-postscript">
          {journey.reflection && <p>{journey.reflection}</p>}
          {journey.closing && <p>{journey.closing}</p>}
        </div>
      )}
    </div>
  );
}
