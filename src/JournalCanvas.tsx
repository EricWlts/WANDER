import { type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, Camera, Pencil } from "lucide-react";
import { Picture, dateRange, dateLabel } from "./components";
import { Reveal, resolveReveal, journeyReveal } from "./Reveal";
import { Parallax } from "./Motion";
import { PhotoRail, Filmstrip } from "./StoryExperience";
import { t } from "./I18n";
import {
  modulePhotos,
  rootPhotos,
  editionColors,
  surfaceColors,
  typePresets,
} from "./journalModel";
import { PhotoWall } from "./PhotoWall";
import { desktopWallColumns, usesAutomaticWallComposition } from "./storyLayout";
export { modulePhotos } from "./journalModel";
import type { Chapter, Journey, Layout, Photo } from "./types";
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
  const defaultPadding = chapter && edition !== "after-hours" ? 48 : 32;
  const columns =
    l.columns ||
    (kind === "pair" ? 2 : kind === "image" || kind === "hero" ? 1 : 4);
  return {
    "--module-hover-scale":
      l.hover_zoom === undefined ? undefined : 1 + l.hover_zoom / 100,
    "--module-font":
      l.font === "sans" ? "Manrope, Arial, sans-serif" : "var(--serif)",
    "--module-text-size": `${l.text_size || (kind === "text" && !l.text_preset ? 16 : typePresets[l.text_preset || "medium"])}px`,
    "--module-text-width": `${l.text_width || (chapter ? 60 : 56)}ch`,
    "--module-font-weight": l.font_weight || 400,
    "--module-text-align": l.text_align || "left",
    "--module-inset": `${l.inset ?? 0}px`,
    "--module-cols": columns,
    "--module-gap": `${l.gap ?? defaultGap}px`,
    "--module-padding": `${l.padding ?? defaultPadding}px`,
    "--module-offset": `${l.offset ?? 50}px`,
    "--module-mobile-cols": l.mobile_columns ?? Math.min(columns, 2),
    "--module-mobile-gap": `${l.mobile_gap ?? l.gap ?? defaultGap}px`,
    "--module-mobile-padding": `${l.mobile_padding ?? l.padding ?? (chapter ? (edition === "after-hours" ? 12 : 32) : 36)}px`,
    "--module-title-size": `${l.title_size || 72}px`,
    "--module-ratio":
      l.ratio && l.ratio !== "original" ? l.ratio.replace(":", "/") : "auto",
  } as CSSProperties;
}
function followChapterLink(event: MouseEvent<HTMLAnchorElement>) {
  const ownerDocument = event.currentTarget.ownerDocument;
  const view = ownerDocument.defaultView;
  event.preventDefault();
  const target = ownerDocument.getElementById(
    event.currentTarget.hash.slice(1),
  );
  if (!target) return;

  target.focus({ preventScroll: true });
  target.scrollIntoView({
    block: "start",
    behavior: view?.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
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
  replay = 0,
  dayId,
}: {
  journey: Journey;
  editing?: boolean;
  selected?: Selection;
  onSelect?: (s: Selection) => void;
  onPhoto?: (p: Photo, sequence?: Photo[]) => void;
  replay?: number;
  dayId?: number;
}) {
  const l = journey.layout || {},
    edition = journey.story_template || "quiet-atlas";
  const cover =
    journey.photos.find((p) => p.id === journey.cover_id) || journey.cover;
  const roots = journey.chapters.filter(
    (c) =>
      !c.layout?.parent_id ||
      !journey.chapters.some((d) => d.id === c.layout?.parent_id),
  );
  const rootChapters = roots.filter((chapter) => chapter.kind === "chapter");
  const loose = rootPhotos(journey, "loose"),
    film = rootPhotos(journey, "filmstrip");
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
    const layout = module.layout || {},
      photos = modulePhotos(module, journey),
      theme =
        layout.edition && layout.edition !== "inherit"
          ? layout.edition
          : edition;
    const kind = module.kind,
      isHero = kind === "hero",
      single = kind === "image" || isHero;
    const isText = kind === "text" || kind === "quote";
    const motion =
      isText && journey.layout?.text_animations === false
        ? resolveReveal({ effect: "none" })
        : resolveReveal(
            module.reveal,
            isText
              ? { effect: "none", duration: 1000 }
              : journeyReveal(journey.reveal_settings, "images"),
          );
    const surface = surfaceColors(
      layout.background ||
        (layout.edition && layout.edition !== "inherit"
          ? editionColors[theme]
          : journey.layout?.background || editionColors[theme]),
    );
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
        {motion.effect === "parallax" && !isHero ? (
          <Parallax intensity={motion.intensity}>
            <Picture photo={p} onClick={() => pick(p)} sizes="75vw" />
          </Parallax>
        ) : (
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
            sizes="(max-width:760px) 100vw, 75vw"
          />
        )}
        {p.edits?.show_title && p.title && <figcaption>{p.title}</figcaption>}
      </figure>
    );
    const showTitle = layout.show_title !== false;
    return (
      <Selectable
        elementId={`canvas-module-${module.id}`}
        key={module.id}
        style={
          {
            ...layoutStyle(layout, kind, theme),
            "--module-bg": surface.background,
            "--canvas-ink": layout.text_color || surface.ink,
          } as CSSProperties
        }
        editing={editing}
        active={selected?.type === "module" && selected.id === module.id}
        label={t(...moduleNames[kind])}
        onSelect={() => onSelect({ type: "module", id: module.id })}
        className={`journal-module module-${kind} module-theme-${theme} module-align-${layout.align || "flush"} module-title-${layout.title_style || "overlay"} text-position-${layout.text_position || (kind === "chapter" ? "left" : "center")} ${kind === "chapter" && layout.font === undefined ? "chapter-prose-default-font" : ""} ${kind === "chapter" && layout.text_size === undefined && layout.text_preset === undefined ? "chapter-prose-default-size" : ""} ${kind === "chapter" && layout.text_width === undefined ? "chapter-prose-default-width" : ""}`}
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
              {module.story && <p className="module-prose">{module.story}</p>}
              {module.quote && <blockquote>{module.quote}</blockquote>}
            </div>
          )}
          {kind === "text" && (
            <div className="module-prose">
              {showTitle && <h2>{module.title}</h2>}
              <p>{module.story}</p>
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
          {isHero ? (
            <div className="module-cover">
              <Parallax
                enabled={layout.parallax ?? true}
                intensity={layout.parallax_intensity ?? 90}
              >
                {photos[0]
                  ? image(photos[0])
                  : editing && (
                      <div className="module-empty">
                        <Camera />
                        {t("Choose a cover photograph", "Titelbild auswählen")}
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
            <PhotoRail photos={photos} onPhoto={pick} />
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
              <PhotoWall
                photos={single ? photos.slice(0, 1) : photos}
                layout={{
                  ...layout,
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
                  selected?.type === "photo" ? selected.placementId : undefined
                }
              />
            )
          )}
          {!photos.length &&
            !["text", "quote", "chapter", "hero"].includes(kind) &&
            editing && (
              <div className="module-empty">
                <Camera />
                {t(
                  "Select photographs in the inspector",
                  "Bilder in den Einstellungen auswählen",
                )}
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
      <div className={`journal-canvas canvas-theme-${edition}`}>
        <div className="journal-content">{day && render(day)}</div>
      </div>
    );
  }
  return (
    <div
      className={`journal-canvas canvas-theme-${edition} ${editing ? "is-editing" : ""}`}
      style={
        {
          "--module-hover-scale":
            l.hover_zoom === undefined ? undefined : 1 + l.hover_zoom / 100,
          "--canvas-paper": l.background || editionColors[edition],
          "--canvas-ink": surfaceColors(l.background || editionColors[edition])
            .ink,
        } as CSSProperties
      }
    >
      <Selectable
        editing={editing}
        active={selected?.type === "hero"}
        label={t("Journey cover", "Reisetitelbild")}
        onSelect={() => onSelect({ type: "hero" })}
        className={`journal-cover cover-${l.title_style || "overlay"}`}
        style={
          { "--cover-title-size": `${l.title_size || 100}px` } as CSSProperties
        }
      >
        <Parallax
          enabled={l.parallax ?? true}
          intensity={l.parallax_intensity ?? 90}
        >
          <div
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
        <div className="journal-cover-copy">
          <span className="eyebrow">
            {journey.location}
            {journey.location ? " · " : ""}
            {dateRange(journey.start_date, journey.end_date)}
          </span>
          <h1>{journey.title}</h1>
          {journey.subtitle && <p>{journey.subtitle}</p>}
        </div>
        <a
          className="cover-continue"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.ownerDocument
              .getElementById("journal-content")
              ?.scrollIntoView({ behavior: "instant" });
          }}
          href="#journal-content"
          aria-label={t("Continue to photographs", "Weiter zu den Fotos")}
        >
          <ArrowDown size={20} />
        </a>
      </Selectable>
      {!editing && rootChapters.length > 1 && (
        <details className="chapter-overview">
          <summary>
            {t("Chapters", "Kapitel")}
            <span>{rootChapters.length}</span>
          </summary>
          <ol>
            {rootChapters.map((chapter) => (
              <li key={chapter.id}>
                <a
                  href={`#canvas-module-${chapter.id}`}
                  onClick={followChapterLink}
                >
                  {chapter.date && (
                    <time dateTime={chapter.date}>
                      {dateLabel(chapter.date, {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  )}
                  <span>{chapter.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </details>
      )}
      <div id="journal-content" className="journal-content">
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
        {loose.length > 0 && (
          <div className="journal-loose">
            <PhotoRail
              photos={loose}
              onPhoto={(p) => photoClick(p, undefined, loose, "loose")}
            />
          </div>
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
