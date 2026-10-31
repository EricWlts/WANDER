import { tr } from "./I18n";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Share2,
} from "lucide-react";
import { sequenceIndex } from "./journalModel";
import { useRailHint } from "./useRailHint";
import { JournalCanvas } from "./JournalCanvas";
import { useMotionOff } from "./Motion";
import { t, useLocale } from "./I18n";
import { api } from "./api";
import { PageState, useApp } from "./App";
import { dateLabel, Modal, Picture } from "./components";
import { Reveal } from "./Reveal";
import type {
  Chapter,
  Journey,
  Photo,
  RevealConfig,
  StoryTemplate,
} from "./types";

export function Inspiration() {
  useLocale();
  const [edition, setEdition] = useState("quiet-atlas");
  const [templates, setTemplates] = useState<StoryTemplate[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<StoryTemplate[]>("/templates")
      .then(setTemplates)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main id="main" className="inspiration-page page-width">
      <div className="editorial-heading">
        <span className="eyebrow">
          {tr("THE WANDER EDITIONS / TWO WAYS TO SEE")}
        </span>
        <h1>
          {t("Your rhythm.", "Dein Rhythmus.")}
          <br />
          <em>{t("Your journey.", "Deine Reise.")}</em>
        </h1>
        <p>
          {t(
            "Two editions to start with. Combine them in any day or module.",
            "Zwei Editionen als Anfang. Kombiniere sie in jedem Tag und Modul.",
          )}
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      <div
        className="edition-mobile-switch"
        aria-label={t("Compare editions", "Editionen vergleichen")}
      >
        {templates.map((template) => (
          <button
            key={template.id}
            className={edition === template.id ? "active" : ""}
            aria-pressed={edition === template.id}
            onClick={() => setEdition(template.id)}
          >
            {template.name}
          </button>
        ))}
      </div>
      <div className="edition-grid" data-active={edition}>
        {templates.map((template, index) => (
          <article
            key={template.id}
            className={`edition-card edition-${template.id}`}
          >
            <Link to={`/inspiration/${template.id}`} className="edition-cover">
              <img
                src="/images/forest-1280.webp"
                alt={
                  t("Edition preview", "Editionsvorschau") +
                  ": " +
                  template.name
                }
              />
              <span>EDITION 0{index + 1}</span>
              <span className="edition-sample-title">
                {t("A little closer.", "Ein Stück näher.")}
              </span>
            </Link>
            <div className="edition-copy">
              <span className="eyebrow">{t(template.kicker)}</span>
              <h2>{template.name}</h2>
              <p>{t(template.description)}</p>
              <Link to={`/inspiration/${template.id}`} className="text-link">
                {tr("Read the photo essay")}
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="reference-note">
        {tr(
          "Original fictional essays, illustrated with credited stock photography. Your photographs and writing remain entirely your own.",
        )}
      </p>
    </main>
  );
}
export function ExampleStory() {
  const { templateId } = useParams();
  return <StoryLoader path={`/templates/${templateId}/example`} />;
}
export function JourneyStory() {
  const { slug } = useParams();
  return <StoryLoader path={`/journeys/${slug}?public=1`} />;
}
function StoryLoader({ path }: { path: string }) {
  const [journey, setJourney] = useState<Journey | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setJourney(null);
    setError("");
    api<Journey>(path)
      .then((j) => {
        if (alive) {
          setJourney(j);
          document.title = `${j.title} — WANDER`;
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      document.title = "WANDER — Every journey deserves to be remembered.";
    };
  }, [path]);
  if (error)
    return <PageState title={tr("This story is out of reach.")} text={error} />;
  if (!journey)
    return (
      <PageState title={tr("Opening a little world…")}>
        <p>{tr("Loading photographs")}</p>
      </PageState>
    );
  return <StoryExperience key={journey.slug} journey={journey} />;
}
export function DayTeaser({
  day,
  photos,
  index,
  onOpen,
  onPhoto,
  motion,
  textMotion,
}: {
  day: Chapter;
  photos: Photo[];
  index: number;
  onOpen: () => void;
  onPhoto: (photo: Photo) => void;
  motion?: RevealConfig;
  textMotion?: RevealConfig;
}) {
  const favorites = photos.filter((photo) => photo.featured);
  const shown = favorites.length ? favorites : photos.slice(0, 1);
  const more = photos.length > shown.length;
  return (
    <section
      className={`day-spread day-spread-${index % 2} ${shown.length === 1 ? "single-frame" : ""}`}
      id={`day-${day.id}`}
    >
      <div className="day-heading">
        <Reveal config={textMotion || day.reveal}>
          <span className="eyebrow">
            {tr("DAY")}
            {String(index + 1).padStart(2, "0")}
            {day.date
              ? ` / ${dateLabel(day.date, { day: "2-digit", month: "long" })}`
              : ""}
          </span>
          <h2>
            {more ? (
              <button onClick={onOpen}>
                {day.title}
                <ArrowUpRight size={23} strokeWidth={1} />
              </button>
            ) : (
              day.title
            )}
          </h2>
          {day.story && <p>{day.story}</p>}
          {day.quote && <blockquote>{day.quote}</blockquote>}
        </Reveal>
        {more && (
          <button className="text-link day-open" onClick={onOpen}>
            {tr("Inside this day")}
            <span>
              {photos.length} {tr("photographs")}
            </span>
            <ArrowUpRight size={18} />
          </button>
        )}
      </div>
      <div className="day-favorites">
        {shown.map((photo, i) => (
          <figure
            key={photo.id}
            className={`favorite-frame ${i % 2 ? "detail-frame" : "main-frame"}`}
          >
            <Picture
              photo={photo}
              animate
              motion={motion}
              actionLabel={
                more
                  ? `Explore ${day.title}: ${photos.length} photographs`
                  : undefined
              }
              onClick={more ? onOpen : () => onPhoto(photo)}
              sizes="(max-width: 760px) 100vw, 70vw"
            />
            <figcaption>
              {photo.edits?.show_title && <span>{photo.title}</span>}
              <span>{String(i + 1).padStart(2, "0")}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
export function PhotoRail({
  photos,
  onPhoto,
}: {
  photos: Photo[];
  onPhoto: (photo: Photo) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; left: number; active: boolean } | null>(null),
    suppress = useRef(false);
  useRailHint(ref, photos.map((p) => p.placement_id || p.id).join(","));
  if (!photos.length) return null;
  return (
    <div className="photo-rail-shell">
      <div
        className="photo-rail free-rail"
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label={t("Horizontal photographs", "Horizontale Bildreihe")}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            e.currentTarget.scrollLeft +=
              (e.key === "ArrowRight" ? 1 : -1) * 80;
          }
          if (e.key === "Home") {
            e.preventDefault();
            e.currentTarget.scrollLeft = 0;
          }
          if (e.key === "End") {
            e.preventDefault();
            e.currentTarget.scrollLeft = e.currentTarget.scrollWidth;
          }
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button === 0) {
            drag.current = {
              x: e.clientX,
              left: e.currentTarget.scrollLeft,
              active: false,
            };
            suppress.current = false;
          }
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const distance = e.clientX - d.x;
          if (Math.abs(distance) > 6) {
            d.active = true;
            suppress.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.scrollLeft = d.left - distance;
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
          suppress.current = false;
        }}
        onClickCapture={(e) => {
          if (suppress.current) {
            e.preventDefault();
            e.stopPropagation();
            suppress.current = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {photos.map((photo, index) => (
          <figure
            onClick={(e) => e.stopPropagation()}
            key={photo.placement_id || `${photo.id}:${index}`}
            style={
              {
                "--frame-ratio": Math.min(
                  1.65,
                  Math.max(0.65, photo.width / photo.height),
                ),
              } as CSSProperties
            }
          >
            <Picture
              photo={photo}
              eager
              onClick={() => onPhoto(photo)}
              sizes="90vw"
            />
            {photo.edits?.show_title && <figcaption>{photo.title}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}
export function Filmstrip({
  photos,
  onExplore,
  speed,
  onPhoto,
}: {
  photos: Photo[];
  onExplore: () => void;
  speed?: number;
  onPhoto?: (photo: Photo) => void;
}) {
  const off = useMotionOff();
  const ref = useRef<HTMLElement>(null),
    group = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false),
    [inView, setInView] = useState(false),
    [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    );
    observer.observe(element);
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    const measure = () =>
      element.style.setProperty(
        "--film-duration",
        `${speed || Math.max(38, (group.current?.getBoundingClientRect().width || 1200) / 32)}s`,
      );
    const resize = new ResizeObserver(measure);
    if (group.current) resize.observe(group.current);
    measure();
    return () => {
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [speed]);
  if (photos.length < 1) return null;
  const frames = (duplicate = false) =>
    photos.map((photo, index) => (
      <div
        className="film-frame"
        key={photo.placement_id || `${photo.id}:${index}`}
        onClick={(e) => {
          e.stopPropagation();
          if (duplicate) {
            if (onPhoto) onPhoto(photo);
            else onExplore();
          }
        }}
      >
        <Picture
          photo={photo}
          sizes="280px"
          onClick={
            duplicate
              ? undefined
              : () => (onPhoto ? onPhoto(photo) : onExplore())
          }
        />
        {photo.edits?.show_title && <span>{photo.title}</span>}
      </div>
    ));
  return (
    <section
      className="filmstrip-section"
      ref={ref}
      aria-label={tr("Moving photographic filmstrip")}
    >
      <div className="filmstrip-heading page-width">
        <button
          className="text-link film-pause"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused || off}
          disabled={off}
          aria-label={
            paused || off
              ? t("Play movement", "Bewegung starten")
              : t("Pause movement", "Bewegung anhalten")
          }
          title={
            paused || off
              ? t("Play movement", "Bewegung starten")
              : t("Pause movement", "Bewegung anhalten")
          }
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
      <div className="film-window">
        <div
          className="film-track"
          style={{
            animationPlayState:
              paused || off || !inView || !visible ? "paused" : "running",
          }}
        >
          <div className="film-group" ref={group}>
            {frames()}
          </div>
          <div className="film-group film-duplicate" aria-hidden="true">
            {frames(true)}
          </div>
        </div>
      </div>
      <div className="filmstrip-foot page-width">
        <span>
          {photos.length} {tr("PHOTOGRAPHS / A CONTINUOUS SEQUENCE")}
        </span>
        <button className="text-link" onClick={onExplore}>
          {tr("Explore the still frames")}
          <ArrowUpRight size={17} />
        </button>
      </div>
    </section>
  );
}
export function PhotoViewer({
  photos,
  initial,
  onClose,
}: {
  photos: Photo[];
  initial: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initial),
    root = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose),
    id = useRef(crypto.randomUUID()),
    gesture = useRef({ total: 0, last: 0, locked: false }),
    touch = useRef<{ x: number; y: number } | null>(null);
  closeRef.current = onClose;
  const next = (direction: number) =>
    setIndex((i) => (i + direction + photos.length) % photos.length);
  useEffect(() => {
    if (history.state?.wanderLightbox !== id.current)
      history.pushState(
        {
          ...history.state,
          idx: (history.state?.idx || 0) + 1,
          wanderLightbox: id.current,
        },
        "",
      );
    const pop = () => {
      if (history.state?.wanderLightbox !== id.current) closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex(
          (i) =>
            (i + (e.key === "ArrowRight" ? 1 : -1) + photos.length) %
            photos.length,
        );
      }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("keydown", key);
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now(),
        g = gesture.current;
      if (now - g.last > 280) {
        g.total = 0;
        g.locked = false;
      }
      g.last = now;
      if (g.locked) return;
      g.total += e.deltaX;
      if (Math.abs(g.total) > 45) {
        g.locked = true;
        setIndex(
          (i) => (i + (g.total > 0 ? 1 : -1) + photos.length) % photos.length,
        );
      }
    };
    const el = root.current;
    el?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("keydown", key);
      el?.removeEventListener("wheel", wheel);
    };
  }, [photos.length]);
  function close() {
    if (history.state?.wanderLightbox === id.current) history.back();
    else onClose();
  }
  const photo = photos[index];
  if (!photo) return null;
  return (
    <Modal
      title={t("Photograph viewer", "Fotoansicht")}
      className="lightbox"
      onClose={close}
    >
      <div
        ref={root}
        className="lightbox-gesture"
        onTouchStart={(e) => {
          if (e.touches.length === 1)
            touch.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || !e.changedTouches[0]) return;
          const dx = e.changedTouches[0].clientX - start.x,
            dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3)
            next(dx < 0 ? 1 : -1);
        }}
      >
        <div className="lightbox-image" key={photo.id}>
          <img src={photo.large_url} alt={photo.alt || ""} />
        </div>
        <div className="lightbox-caption">
          <div>
            {photo.edits?.show_title && <p>{photo.title}</p>}
            {photo.description && <span>{photo.description}</span>}
            {photo.source_url && (
              <a href={photo.source_url} target="_blank" rel="noreferrer">
                {t("Photo", "Foto")}: {photo.credit} ↗
              </a>
            )}
          </div>
          <span aria-live="polite">
            {index + 1} / {photos.length}
          </span>
        </div>
        {photo.original_url && (
          <a
            className="original-link"
            href={photo.original_url}
            target="_blank"
            rel="noreferrer"
          >
            {t("Open full-resolution copy", "Vollauflösung öffnen")} ↗
          </a>
        )}
        {photos.length > 1 && (
          <div className="lightbox-controls">
            <button
              aria-label={t("Previous photograph", "Vorheriges Foto")}
              onClick={() => next(-1)}
            >
              <ChevronLeft />
            </button>
            <button
              aria-label={t("Next photograph", "Nächstes Foto")}
              onClick={() => next(1)}
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
export function DayGallery({
  title,
  day,
  journey,
  photos,
  onClose,
}: {
  title: string;
  day?: Chapter;
  journey?: Journey;
  photos: Photo[];
  onClose: () => void;
}) {
  const [viewerPhotos, setViewerPhotos] = useState<Photo[]>(photos);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const open = (photo: Photo, sequence: Photo[] = photos) => {
    setViewerPhotos(sequence);
    setLightbox(sequenceIndex(sequence, photo));
  };
  return (
    <Modal title={title} className="day-gallery" onClose={onClose}>
      <header className="day-gallery-heading">
        <span className="eyebrow">
          {day?.date
            ? dateLabel(day.date, {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : tr("THE COMPLETE COLLECTION")}{" "}
          / {photos.length}
          {tr("PHOTOGRAPHS")}
        </span>
        <h2>{title}</h2>
        {day?.story && <p>{day.story}</p>}
      </header>
      {day && journey ? (
        <JournalCanvas journey={journey} dayId={day.id} onPhoto={open} />
      ) : day?.gallery_mode === "horizontal" ? (
        <PhotoRail photos={photos} onPhoto={open} />
      ) : (
        <div className="day-gallery-grid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              <Picture
                photo={photo}
                onClick={() => open(photo)}
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              {photo.edits?.show_title && (
                <figcaption>{photo.title}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
      <p className="day-gallery-end">{tr("A day worth keeping.")}</p>
      {lightbox !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initial={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </Modal>
  );
}
function StoryExperience({ journey }: { journey: Journey }) {
  const { authenticated, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const [viewerPhotos, setViewerPhotos] = useState<Photo[]>(journey.photos);
  const [lightbox, setLightbox] = useState<number | null>(null),
    [collection, setCollection] = useState<"all" | "film" | null>(null),
    [shareLink, setShareLink] = useState("");
  const dayId = Number(params.get("day"));
  const day = journey.chapters.find(
    (chapter) => chapter.kind === "chapter" && chapter.id === dayId,
  );
  const film = journey.filmstrip_ids
    .map((id) => journey.photos.find((photo) => photo.id === id))
    .filter((photo): photo is Photo => Boolean(photo));
  function closeDay() {
    const next = new URLSearchParams(params);
    next.delete("day");
    setParams(next, { replace: true, preventScrollReset: true });
  }
  function openPhoto(photo: Photo, sequence: Photo[] = journey.photos) {
    setViewerPhotos(sequence);
    setLightbox(sequenceIndex(sequence, photo));
  }
  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      notify(tr("Story link copied."));
    } catch {
      setShareLink(url);
    }
  }
  return (
    <main
      id="main"
      className={`story-experience template-${journey.story_template || "quiet-atlas"}`}
    >
      {journey.is_example && (
        <div className="example-banner">
          <Link to="/inspiration">
            <ArrowLeft size={14} />
            {tr("All editions")}
          </Link>
          <span>
            {tr("ORIGINAL FICTIONAL ESSAY /")}{" "}
            {journey.story_template === "after-hours"
              ? "AFTER HOURS"
              : "QUIET ATLAS"}
          </span>
          <Link to={`/studio/new?template=${journey.story_template}`}>
            {tr("Make it yours")}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      {!journey.published && (
        <div className="draft-banner">
          {tr("PRIVATE PREVIEW — Only visible to you.")}
          <Link to={`/studio/${journey.slug}`}>{tr("Return to studio ↗")}</Link>
        </div>
      )}
      <div className="story-facts page-width">
        <span>
          {journey.location} · {journey.photos.length}{" "}
          {t("photographs", "Fotos")}
        </span>
        <div>
          {authenticated && !journey.is_example && (
            <Link to={`/studio/${journey.slug}`}>
              {t("Edit story", "Reise bearbeiten")} ↗
            </Link>
          )}
          <button onClick={share}>
            <Share2 size={14} />
            {t("Share", "Teilen")}
          </button>
        </div>
      </div>
      <JournalCanvas journey={journey} onPhoto={openPhoto} />
      <div className="story-end page-width">
        <Link
          className="text-link"
          to={journey.is_example ? "/inspiration" : "/archive"}
        >
          <ArrowLeft size={17} />{" "}
          {journey.is_example
            ? tr("Explore the other edition")
            : tr("Back to the archive")}
        </Link>
        <button className="text-link" onClick={() => setCollection("all")}>
          {tr("All")}
          {journey.photos.length} {tr("photographs")} <ArrowUpRight size={17} />
        </button>
      </div>
      {journey.demo && (
        <p className="reference-note page-width">
          {tr(
            "An imagined essay, illustrated with stock photography. Photographer credits accompany each full-size image.",
          )}
        </p>
      )}
      {day && (
        <DayGallery
          title={day.title}
          day={day}
          journey={journey}
          photos={journey.photos}
          onClose={closeDay}
        />
      )}
      {collection && (
        <DayGallery
          title={
            collection === "film"
              ? tr("The contact sheet")
              : tr("The complete collection")
          }
          photos={collection === "film" ? film : journey.photos}
          onClose={() => setCollection(null)}
        />
      )}
      {lightbox !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initial={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
      {shareLink && (
        <Modal title={tr("Share this story")} onClose={() => setShareLink("")}>
          <h2>{tr("A little world to share.")}</h2>
          <input
            aria-label={tr("Story link")}
            readOnly
            value={shareLink}
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </Modal>
      )}
    </main>
  );
}
export function HomeDays({ slug }: { slug: string }) {
  const [journey, setJourney] = useState<Journey | null>(null);
  useEffect(() => {
    let alive = true;
    api<Journey>(`/journeys/${slug}?public=1`)
      .then((value) => {
        if (alive) setJourney(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);
  const days =
    journey?.chapters.filter(
      (day) =>
        day.kind === "chapter" &&
        journey.photos.some((photo) => photo.chapter_id === day.id),
    ) || [];
  if (!journey || !days.length) return null;
  return (
    <section className="home-days page-width">
      <div className="section-index">
        <span>{tr("INSIDE THE JOURNEY / THE DAYS")}</span>
        <Link to={`/journeys/${slug}`}>{tr("The complete story ↗")}</Link>
      </div>
      <div className="home-day-grid">
        {days.map((day, index) => {
          const photos = journey.photos.filter(
            (photo) => photo.chapter_id === day.id,
          );
          const favorite = photos.find((photo) => photo.featured) || photos[0];
          return (
            <Link
              to={`/journeys/${slug}?day=${day.id}`}
              className="home-day-card"
              key={day.id}
            >
              <Picture
                photo={favorite}
                animate
                sizes="(max-width: 760px) 100vw, 33vw"
              />
              <span className="eyebrow">
                {tr("DAY")}
                {String(index + 1).padStart(2, "0")} / {photos.length}{" "}
                {tr("PHOTOGRAPHS")}
              </span>
              <h3>
                {day.title}
                <ArrowUpRight size={19} />
              </h3>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
