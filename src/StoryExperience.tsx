import { tr } from "./I18n";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Pause,
  PenLine,
  Play,
  Share2,
} from "lucide-react";
import { createPortal } from "react-dom";
import { sequenceIndex } from "./journalModel";
import { PhotoRail } from "./PhotoRail";
import { FocusView } from "./FocusView";
import "./edition-tilt.css";
import { JournalCanvas } from "./JournalCanvas";
import { useMotionOff } from "./Motion";
import { t, useLocale } from "./I18n";
import { api } from "./api";
import { PageState, useApp } from "./App";
import { dateLabel, dateRange, Modal, Picture } from "./components";
import { formDateText, formOf, type JourneyForm } from "./journeyForm";
import { Reveal } from "./Reveal";
import { fixedReveal } from "./fixedMotion";
import { clamp01, cloneOpacity, dockProgress, dockRange, flightPose, smoothDamp } from "./titleDock";
import { coverFocusVars } from "./editionOverrides";
import { editionSampleTitle, editionTraits } from "./editionCopy";
import { coverLinkProps } from "./viewTransitions";
import { isMotionOff } from "./motionState";
import { coverTransitionAttr, coverTransitionStyle } from "./viewTransitions";
import type {
  Chapter,
  Journey,
  Photo,
  RevealConfig,
  StoryTemplate,
} from "./types";

export function Inspiration({ embedded = false, intro }: { embedded?: boolean; intro?: ReactNode }) {
  const Container = embedded ? "section" : "main";
  const Heading = embedded ? "h2" : "h1";
  const CardHeading = embedded ? "h3" : "h2";
  const { locale } = useLocale();
  const [templates, setTemplates] = useState<StoryTemplate[]>([]),
    [error, setError] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const [edIndex, setEdIndex] = useState(0);
  const edMotionOff = useMotionOff();
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const cards = Array.from(grid.children) as HTMLElement[];
      let best = 0, dist = Infinity;
      cards.forEach((c, k) => {
        const d = Math.abs(c.offsetLeft - grid.offsetLeft - grid.scrollLeft);
        if (d < dist) { dist = d; best = k; }
      });
      if (grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 2) best = cards.length - 1;
      setEdIndex(best);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    grid.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => { grid.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [templates.length]);
  const goToEdition = (k: number) => {
    const card = gridRef.current?.children[k] as HTMLElement | undefined;
    const reduce = edMotionOff || isMotionOff();
    card?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "start" });
  };
  useEffect(() => {
    api<StoryTemplate[]>("/templates")
      .then(setTemplates)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Container
      id={embedded ? "editionen" : "main"}
      className="inspiration-page page-width"
      aria-labelledby={embedded ? "editions-heading" : undefined}
      tabIndex={embedded ? -1 : undefined}
    >
      <header className="inspiration-head">
        <span className="eyebrow">{t("Two editions", "Zwei Editionen")}</span>
        <Heading id="editions-heading">
          {t("Light or dark.", "Hell oder dunkel.")}{" "}
          <em>{t("Two lights, two moods.", "Zwei Lichter, zwei Stimmungen.")}</em>
        </Heading>
        <p className="page-lead">
          {t(
            "Choose the light that suits your journey – or combine both, module by module.",
            "Wähle das Licht, das zu deiner Reise passt – oder kombiniere beide Modul für Modul.",
          )}
        </p>
      </header>
      {!embedded && (
        /* Desktop: the headline reads across the seam between both halves (decorative copy; the real
           heading above stays for assistive tech). Hidden on small screens. */
        <div className="ed-seam-title" aria-hidden="true">
          {(["is-ink", "is-linen"] as const).map((tone) => (
            <span key={tone} className={`ed-seam-copy ${tone}`} aria-hidden="true">
              <span className="ed-seam-line">{t("Light or dark.", "Hell oder dunkel.")}</span>
              <span className="ed-seam-line is-italic">{t("Two lights, two moods.", "Zwei Lichter, zwei Stimmungen.")}</span>
            </span>
          ))}
        </div>
      )}
      {intro}
      {error && <p role="alert">{error}</p>}
      <div className="ed-grid" ref={gridRef}>
        {templates.map((template, i) => {
          const light = template.id === "quiet-atlas";
          const traits = editionTraits(template.id, locale);
          return (
            <Link
              key={template.id}
              to={`/inspiration/${template.id}`}
              className={`ed-card ed-${light ? "light" : "dark"}`}
              aria-labelledby={`edition-title-${template.id}`}
              onClick={(event) => {
                const selection = window.getSelection();
                if (event.detail > 0 && selection && !selection.isCollapsed &&
                    (event.currentTarget.contains(selection.anchorNode) || event.currentTarget.contains(selection.focusNode)))
                  event.preventDefault();
              }}
            >
              <img
                className={`ed-image${template.cover_focus ? " has-cover-focus" : ""}`}
                src={template.cover_photo?.url ?? template.cover}
                srcSet={template.cover_photo?.srcset}
                sizes={template.cover_photo ? "(max-width: 760px) 100vw, 50vw" : undefined}
                style={coverFocusVars(template.cover_focus) as CSSProperties | undefined}
                width={1280}
                height={853}
                alt={
                  template.cover_photo
                    ? template.cover_photo.alt || ""
                    : light
                    ? t(
                        "Alpine panorama over snow-covered peaks",
                        "Alpenpanorama über schneebedeckten Gipfeln",
                      )
                    : t(
                        "The sun in Calima haze above dark mountains",
                        "Die Sonne im Calima-Dunst über dunklen Bergen",
                      )
                }
              />
              <div className="ed-type">
                <span className="ed-kicker">
                  {t(`Edition ${i === 0 ? "I" : "II"}`, `Edition ${i === 0 ? "I" : "II"}`)}
                </span>
                <CardHeading id={`edition-title-${template.id}`}>{tr(template.name)}</CardHeading>
                <span className="ed-sample">
                  {editionSampleTitle(template.id, locale, template.title_override) || tr(template.name)}
                </span>
                <span className="ed-foot">
                  {traits.length > 0 && (
                    <span className="ed-traits">
                      {traits.map((trait) => (
                        <span key={trait}>{trait}</span>
                      ))}
                    </span>
                  )}
                  <span className="ed-link" aria-hidden="true">
                    {t("View photo essay", "Fotoessay ansehen")}
                    <ArrowUpRight size={16} />
                  </span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {templates.length > 1 && (
        <div className="ed-pager" role="group" aria-label={t("Choose edition", "Edition wählen")}>
          {templates.map((template, k) => (
            <button
              key={template.id}
              type="button"
              className="ed-dot"
              aria-label={t(`Show edition ${k + 1} of ${templates.length}`, `Edition ${k + 1} von ${templates.length} zeigen`)}
              aria-current={edIndex === k ? "true" : undefined}
              onClick={() => goToEdition(k)}
            />
          ))}
        </div>
      )}
    </Container>
  );
}
export function ExampleStory() {
  const { templateId } = useParams();
  const { locale } = useLocale();
  return <StoryLoader path={`/templates/${templateId}/example?lang=${locale}`} />;
}
export function JourneyStory() {
  const { slug } = useParams();
  return <StoryLoader path={`/journeys/${slug}?public=1`} slug={slug} />;
}
export function ShowcaseStory() {
  const { edition } = useParams();
  const { locale } = useLocale();
  return (
    <StoryLoader
      path={`/showcase/${encodeURIComponent(edition ?? "")}?lang=${locale}`}
      showcase
    />
  );
}
type StoryCover = Pick<
  Photo,
  "id" | "url" | "srcset" | "alt" | "width" | "height"
>;

// History state is optional UI context, never a substitute for the public response.
function linkedStoryCover(state: unknown, slug?: string): StoryCover | null {
  if (!slug || !state || typeof state !== "object" || !("storyCover" in state))
    return null;
  const link = state.storyCover;
  if (
    !link ||
    typeof link !== "object" ||
    !("slug" in link) ||
    link.slug !== slug ||
    !("cover" in link)
  )
    return null;
  const cover = link.cover;
  if (!cover || typeof cover !== "object") return null;
  const value = cover as Record<string, unknown>;
  if (
    !Number.isSafeInteger(value.id) ||
    Number(value.id) <= 0 ||
    typeof value.url !== "string" ||
    typeof value.srcset !== "string" ||
    typeof value.alt !== "string" ||
    value.alt.length > 2000 ||
    typeof value.width !== "number" ||
    !Number.isFinite(value.width) ||
    value.width <= 0 ||
    typeof value.height !== "number" ||
    !Number.isFinite(value.height) ||
    value.height <= 0
  )
    return null;
  // Only same-origin display variants; originals and arbitrary/external URLs are excluded.
  const displayUrl = (url: string) =>
    new RegExp(`^/media/${value.id}/(?:640|1280|2200|3840)$`).test(url) ||
    /^\/images\/[a-zA-Z0-9_-]+-(?:640|1280|2200|3840)\.webp$/.test(url);
  if (
    !displayUrl(value.url) ||
    value.srcset.length > 2000 ||
    (value.srcset &&
      !value.srcset.split(",").every((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        return (
          parts.length === 2 &&
          displayUrl(parts[0]) &&
          /^[1-9]\d*w$/.test(parts[1])
        );
      }))
  )
    return null;
  return {
    id: Number(value.id),
    url: value.url,
    srcset: value.srcset,
    alt: value.alt,
    width: value.width,
    height: value.height,
  };
}
function StoryLoader({
  path,
  slug,
  showcase,
}: {
  path: string;
  slug?: string;
  showcase?: boolean;
}) {
  const location = useLocation();
  const cover = linkedStoryCover(location.state, slug);
  const [result, setResult] = useState<{
    path: string;
    journey?: Journey;
    error?: string;
  } | null>(null);
  // Check identity while rendering too: a new route must never paint the old story.
  const current = result?.path === path ? result : null;
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setResult(null);
    api<Journey>(path, { signal: controller.signal })
      .then((journey) => {
        if (!alive) return;
        if (slug && journey.slug !== slug)
          throw new Error(tr("This story is out of reach."));
        setResult({ path, journey });
        document.title = `${journey.title} — WANDER`;
      })
      .catch((e) => {
        if (alive) setResult({ path, error: e.message });
      });
    return () => {
      alive = false;
      controller.abort();
      document.title = "WANDER — A photo journal for journeys, moments and collections.";
    };
  }, [path, slug]);
  useLayoutEffect(() => {
    // App's initial hash lookup can run before the asynchronous story exists.
    if (current?.journey && location.hash)
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ behavior: "instant" });
  }, [current?.journey, location.hash]);
  if (current?.error)
    return (
      <PageState
        title={tr("This story is out of reach.")}
        text={current.error}
      />
    );
  if (!current?.journey)
    return cover ? (
      <main id="main" className="story-cover-loading" aria-busy="true">
        <div className="story-cover-loading-status" role="status">
          <h1>{tr("Opening a little world…")}</h1>
          <p>{tr("Loading photographs")}</p>
        </div>
        <div className="story-cover-loading-frame" style={coverTransitionStyle()} {...coverTransitionAttr()}>
          <img
            src={cover.url}
            srcSet={cover.srcset}
            sizes="100vw"
            alt={cover.alt}
            width={cover.width}
            height={cover.height}
            loading="eager"
            decoding="async"
          />
        </div>
      </main>
    ) : (
      <PageState title={tr("Opening a little world…")}>
        <p>{tr("Loading photographs")}</p>
      </PageState>
    );
  return (
    <StoryExperience
      key={current.journey.slug}
      journey={current.journey}
      showcase={showcase}
    />
  );
}
export function DayTeaser({
  day,
  photos,
  index,
  onOpen,
  onPhoto,
  motion,
  textMotion,
  form = "journey",
}: {
  form?: JourneyForm;
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
        <Reveal config={textMotion || fixedReveal("chapter")}>
          <span className="eyebrow">
            {form === "journey" ? tr("DAY") : t("CHAPTER", "KAPITEL")}
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
                  ? t(`Explore ${day.title}: ${photos.length} photographs`, `Entdecken: ${day.title}, ${photos.length} Fotografien`)
                  : undefined
              }
              onClick={more ? onOpen : () => onPhoto(photo)}
              sizes="(max-width: 760px) 100vw, 75vw"
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
/** The photograph viewer is the focus view: it grows out of the story instead of replacing it. */
export function PhotoViewer(props: {
  photos: Photo[];
  initial: number;
  onClose: () => void;
}) {
  return <FocusView {...props} />;
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
        <PhotoRail photos={photos} onPhoto={open} layout={day.layout} />
      ) : (
        <div className="day-gallery-grid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              <Picture
                photo={photo}
                onClick={() => open(photo)}
                sizes="(max-width: 760px) 100vw, 55vw"
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
/** Hairline reading progress under the masthead; transform-only, rAF-throttled. */
function StoryProgress() {
  const bar = useRef<HTMLDivElement>(null);
  // Layout effect: --banner-h (the cover height derives from it) is set before the first paint.
  useLayoutEffect(() => {
    const el = bar.current;
    const main = el?.parentElement;
    if (!el || !main) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const total = main.offsetHeight - window.innerHeight;
      const done = total > 0 ? -main.getBoundingClientRect().top / total : 0;
      el.style.transform = `scaleX(${Math.min(1, Math.max(0, done))})`;
      el.dataset.idle = total > 0 && done > 0.002 ? "false" : "true";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const resize =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(main);
    // The sticky chapter bar sits beneath the edition bar, whatever its height.
    // The bar sits in a wrapper div; the story root (<main>) carries the layout variables.
    const story = el.closest<HTMLElement>("main") ?? main;
    const measure = () => {
      // Everything above the cover (slot, edition/draft bar, motion row): the real canvas offset.
      const canvas = story.querySelector<HTMLElement>(".journal-canvas");
      if (canvas)
        story.style.setProperty("--story-top", `${(canvas.getBoundingClientRect().top + window.scrollY).toFixed(2)}px`);
      story.style.setProperty(
        "--banner-h",
        `${[...story.querySelectorAll<HTMLElement>(":scope > .example-banner, :scope > .draft-banner")]
          .reduce((sum, el) => sum + el.offsetHeight, 0)}px`,
      );
    };
    // Lone photographs in a wall: tag their ratio so CSS can cap the height to the reading area.
    let tagFrame = 0;
    const tagRatios = () => {
      tagFrame = 0;
      story.querySelectorAll<HTMLElement>(".photo-wall:not(.wall-miniature) .wall-group > figure:only-child > .picture").forEach((pic) => {
        const m = /([\d.]+)\s*(?:\/\s*([\d.]+))?/.exec(pic.style.aspectRatio);
        const r = m ? Number(m[1]) / Number(m[2] ?? 1) : 0;
        if (r > 0 && pic.style.getPropertyValue("--pic-ratio") !== r.toFixed(4)) pic.style.setProperty("--pic-ratio", r.toFixed(4));
      });
    };
    // Nur hinzugefügte Bilder oder Wände sind relevant; Titel-Klon, Texte und Toasts lösen nichts aus.
    const relevant = (node: Node) =>
      node instanceof HTMLElement &&
      (node.matches(".photo-wall, .wall-group, figure, .picture") ||
        node.querySelector(".photo-wall, .picture") !== null);
    const tagObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver((records) => {
      if (tagFrame) return;
      if (records.some((record) => [...record.addedNodes].some(relevant)))
        tagFrame = requestAnimationFrame(tagRatios);
    });
    tagObserver?.observe(story, { childList: true, subtree: true });
    tagRatios();
    measure();
    window.addEventListener("resize", measure);
    const banners = [...story.querySelectorAll<HTMLElement>(":scope > .example-banner, :scope > .draft-banner")];
    const bannerResize =
      banners.length && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    banners.forEach((el) => bannerResize?.observe(el));
    return () => {
      window.removeEventListener("resize", measure);
      tagObserver?.disconnect();
      cancelAnimationFrame(tagFrame);
      bannerResize?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resize?.disconnect();
    };
  }, []);
  return (
    <div className="story-progress" aria-hidden="true">
      <div ref={bar} className="story-progress-bar" data-idle="true" />
    </div>
  );
}

/** Closing section: the other public journeys as tall image cards, title in the image
 *  (same format as "What you can shape" on the about page). Starts with the next older journey. */
function NextJourney({ journey }: { journey: Journey }) {
  const [others, setOthers] = useState<Journey[]>([]);
  useEffect(() => {
    let alive = true;
    api<Journey[]>("/journeys?public=1")
      .then((list) => {
        if (!alive) return;
        const sorted = list
          .filter((item) => !item.is_example)
          .sort((a, b) => b.start_date.localeCompare(a.start_date));
        const at = sorted.findIndex((item) => item.slug === journey.slug);
        const rest = at < 0 ? sorted : [...sorted.slice(at + 1), ...sorted.slice(0, at)];
        setOthers(rest.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [journey.slug]);
  if (!others.length) return null;
  return (
    <section className="next-journey more-journeys" aria-labelledby="next-journey-title">
      <div className="more-journeys-inner">
        <h2 id="next-journey-title" className="more-journeys-title">
          {t("More journeys", "Weitere Reisen")}
        </h2>
        <ul className="more-journeys-grid" data-count={others.length}>
          {others.map((item) => (
            <li key={item.id} className="more-journeys-item">
              <Link
                className="more-journeys-card"
                to={`/journeys/${item.slug}`}
                {...coverLinkProps(item.slug, item.cover)}
              >
                <span className="more-journeys-image">
                  <Picture photo={item.cover} sizes="(max-width: 760px) 100vw, 34vw" />
                </span>
                <span className="more-journeys-copy">
                  <span className="more-journeys-name">{item.title}</span>
                  <span className="more-journeys-meta">
                    {[item.location, formDateText(formOf(item), item.start_date, item.end_date, { range: dateRange, day: (day) => dateLabel(day) })]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
/** Closing page of the two edition examples: an invitation to the other edition, in its own mood. */
function OtherEdition({ journey, showcase }: { journey: Journey; showcase?: boolean }) {
  const { locale } = useLocale();
  const otherId = journey.story_template === "after-hours" ? "quiet-atlas" : "after-hours";
  const name = tr(otherId === "after-hours" ? "Last Light" : "First Light");
  const path = showcase
    ? `/showcase/${otherId}?lang=${locale}`
    : `/templates/${otherId}/example?lang=${locale}`;
  const [other, setOther] = useState<{ path: string; journey: Journey } | null>(null);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    api<Journey>(path, { signal: controller.signal })
      .then((value) => {
        if (alive) setOther({ path, journey: value });
      })
      .catch(() => {});
    return () => {
      alive = false;
      controller.abort();
    };
  }, [path]);
  const loaded = other?.path === path ? other.journey : null;
  const title = loaded?.title || editionSampleTitle(otherId, locale);
  return (
    <section
      className={`other-edition template-${otherId}`}
      aria-labelledby="other-edition-title"
    >
      <Link className="other-edition-link" to={`/${showcase ? "showcase" : "inspiration"}/${otherId}`}>
        <span className="eyebrow other-edition-kicker">
          {t("THE OTHER EDITION", "DIE ANDERE EDITION")}
        </span>
        <span className="other-edition-name">{name}</span>
        <h2 id="other-edition-title" className="other-edition-title">
          {title}
        </h2>
        <span className="other-edition-image" aria-hidden="true">
          {loaded?.cover ? <Picture photo={loaded.cover} sizes="(max-width: 760px) 100vw, 1100px" /> : null}
        </span>
        <span className="other-edition-cta">
          {t(`View in ${name}`, `In ${name} ansehen`)}
          <ArrowRight size={16} strokeWidth={1.25} aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}
/**
 * The public story page. `preview` renders the same page inside the editor: no header
 * actions, no draft banner, the URL and browser history stay untouched and links that
 * would leave the page do nothing (day galleries still open in place).
 */
export function StoryExperience({ journey, showcase, preview = false }: { journey: Journey; showcase?: boolean; preview?: boolean }) {
  const { authenticated: signedIn, notify } = useApp();
  const authenticated = signedIn && !preview;
  const [urlParams, setUrlParams] = useSearchParams();
  const [previewDay, setPreviewDay] = useState<number | null>(null);
  const params = preview ? new URLSearchParams(previewDay ? `day=${previewDay}` : "") : urlParams;
  const setParams = (next: URLSearchParams, options?: { replace?: boolean; preventScrollReset?: boolean }) => {
    if (preview) setPreviewDay(Number(next.get("day")) || null);
    else setUrlParams(next, options);
  };
  /** Preview: keep every click on the page; a day link opens its gallery in place. */
  const inertLinks = (e: ReactMouseEvent<HTMLElement>) => {
    const link = (e.target as Element).closest?.("a[href]");
    if (!link) return;
    e.preventDefault();
    const url = new URL(link.getAttribute("href") || "", window.location.href);
    const day = Number(url.searchParams.get("day"));
    if (day && url.pathname === window.location.pathname) setPreviewDay(day);
  };
  const [viewerPhotos, setViewerPhotos] = useState<Photo[]>(journey.photos);
  const [lightbox, setLightbox] = useState<number | null>(null),
    [collection, setCollection] = useState<"all" | "film" | null>(null),
    [shareLink, setShareLink] = useState("");
  // Share/edit live in the masthead instead of a separate bar above the story.
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [navSlot, setNavSlot] = useState<HTMLElement | null>(null);
  const [runningSlot, setRunningSlot] = useState<HTMLElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (preview) return;
    setActionsSlot(document.getElementById("header-actions"));
    setNavSlot(document.getElementById("nav-actions"));
    setRunningSlot(document.getElementById("header-running"));
  }, [preview]);
  useEffect(() => {
    // Ein Scroll-Burst = höchstens ein Lesevorgang pro Frame; setScrolled löst nur bei einem Wechsel ein Rendern aus.
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 120);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
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
    if (preview) return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      notify(tr("Story link copied."));
    } catch {
      setShareLink(url);
    }
  }
  const motionOff = useMotionOff();
  // Title docking: the cover title flies into the running line, scroll-coupled (no time tween).
  useEffect(() => {
    const main = document.getElementById("main");
    const line = main?.querySelector<HTMLElement>(".story-running-line");
    if (!main || !line) return;
    const reduce = () => motionOff || isMotionOff();
    let clone: HTMLElement | null = null;
    let cloneSource: HTMLElement | null = null;
    let natural = { w: 0, h: 0, font: 16 };
    let frame = 0;
    let flying = false;
    let lastP = -1;
    // Smoothed progress: eases toward the scroll-derived target so the flight never steps.
    let sp = 0;
    let spv = 0;
    let lastT = 0;
    let lastEdge = NaN;
    let lineOn = false;
    let primed = false;
    const setFlight = (on: boolean) => {
      if (on === flying) return;
      flying = on;
      main.toggleAttribute("data-title-flight", on);
    };
    const dropClone = () => {
      clone?.remove();
      clone = null;
      cloneSource = null;
    };
    const buildClone = (h1: HTMLElement) => {
      dropClone();
      const css = getComputedStyle(h1);
      clone = document.createElement("div");
      clone.className = "title-dock-clone";
      clone.setAttribute("aria-hidden", "true");
      clone.textContent = h1.textContent;
      Object.assign(clone.style, {
        font: css.font,
        letterSpacing: css.letterSpacing,
        lineHeight: css.lineHeight,
        textAlign: css.textAlign,
        textTransform: css.textTransform,
        color: css.color,
        textShadow: css.textShadow,
        width: `${h1.offsetWidth}px`,
      });
      main.appendChild(clone);
      cloneSource = h1;
      natural = { w: h1.offsetWidth, h: h1.offsetHeight, font: parseFloat(css.fontSize) || 16 };
    };
    const update = (ts?: number) => {
      frame = 0;
      const now = typeof ts === "number" ? ts : performance.now();
      const dt = lastT ? Math.min(64, Math.max(0, now - lastT)) : 16;
      lastT = now;
      const h1 = main.querySelector<HTMLElement>(".journal-cover h1");
      const lineRect = line.getBoundingClientRect();
      const edge = lineRect.bottom;
      const box = h1?.getBoundingClientRect();
      let p: number;
      let target: number;
      if (!h1 || !box || box.width === 0 || box.height === 0) {
        // No cover title: the line fades in with the first scroll.
        target = clamp01((window.scrollY - 60) / 60);
        p = target;
        sp = target;
        setFlight(false);
        dropClone();
      } else if (reduce()) {
        target = box.top < edge ? 1 : 0;
        p = target;
        sp = target;
        setFlight(false);
        dropClone();
      } else {
        target = dockProgress(box.top, edge, dockRange);
        // Critically damped spring (smoothTime 240 ms, capped speed); first frame snaps.
        if (primed) {
          const next = smoothDamp(sp, target, spv, 0.24, dt / 1000, 3);
          sp = next.value;
          spv = next.velocity;
        } else {
          sp = target;
          spv = 0;
        }
        if (Math.abs(target - sp) < 0.0015 && Math.abs(spv) < 0.02) {
          sp = target;
          spv = 0;
        }
        p = sp;
        if (p > 0 && (!clone || cloneSource !== h1 || natural.w !== h1.offsetWidth)) buildClone(h1);
        if (p > 0 && clone) {
          const span = line.firstElementChild?.getBoundingClientRect();
          const toX = span ? span.left + span.width / 2 : window.innerWidth / 2;
          const toY = span ? span.top + span.height / 2 : lineRect.top + lineRect.height / 2;
          const from = {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
            s: natural.w ? box.width / natural.w : 1,
          };
          const pose = flightPose(from, { x: toX, y: toY, s: Math.max(0.12, 15 / natural.font) }, p);
          clone.style.transform = `translate3d(${pose.x - natural.w / 2}px, ${pose.y - natural.h / 2}px, 0) scale(${pose.s})`;
          clone.style.opacity = String(cloneOpacity(p));
          setFlight(true);
        } else {
          setFlight(false);
          dropClone();
        }
      }
      primed = true;
      if (p !== lastP) {
        lastP = p;
        line.style.setProperty("--title-p", String(p));
        // Hysteresis: the glass only appears once the title is really on its way and leaves
        // as soon as it is back on the cover, so no empty bar is left over the picture.
        lineOn = lineOn ? p > 0.12 : p > 0.25;
        line.toggleAttribute("data-on", lineOn);
        // Kicker and subtitle on the cover step back while the title takes off.
        h1?.parentElement?.style.setProperty("--title-p", String(p));
      }
      // Keep animating while easing or while the running line is still moving (header collapse).
      if (!reduce() && (sp !== target || edge !== lastEdge)) schedule();
      lastEdge = edge;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      main.removeAttribute("data-title-flight");
      dropClone();
    };
  }, [motionOff, journey.id]);
  function backToStart(event: React.MouseEvent<HTMLButtonElement>) {
    const main = event.currentTarget.closest("main");
    const reduce = motionOff || isMotionOff();
    window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" });
    main?.querySelector<HTMLElement>(".journal-cover h1")?.focus({ preventScroll: true });
  }
  const afterHours = journey.story_template === "after-hours";
  const otherEdition = afterHours ? "quiet-atlas" : "after-hours";
  const editionLink = `/${showcase ? "showcase" : "inspiration"}/${otherEdition}`;
  const editionName = tr(afterHours ? "First Light" : "Last Light");
  const editionLabel = afterHours
    ? t("Last Light · Tenerife", "Letztes Licht · Teneriffa")
    : t("First Light · Switzerland", "Erstes Licht · Schweiz");
  return (
    <main
      id="main"
      className={`story-experience template-${journey.story_template || "quiet-atlas"}${showcase ? " showcase-story" : ""}${journey.cover_focus ? " has-cover-focus" : ""}${preview ? " is-story-preview" : ""}`}
      style={coverFocusVars(journey.cover_focus) as CSSProperties | undefined}
      data-scrolled={scrolled ? "true" : "false"}
      onClickCapture={preview ? inertLinks : undefined}
    >
      <StoryProgress />
      <div className="story-running-line" aria-hidden="true">
        <span>
          {journey.title}
          {journey.location ? <span className="story-running-place"> · {journey.location}</span> : null}
        </span>
      </div>
      {journey.is_example && (
        <div className="example-banner">
          <Link to={showcase ? "/" : "/inspiration"}>
            <ArrowLeft size={14} />
            {showcase ? t("Home", "Startseite") : tr("All editions")}
          </Link>
          <span>{editionLabel}</span>
          <Link to={editionLink}>
            {editionName}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      {!journey.published && !preview && (
        <div className="draft-banner">
          {tr("PRIVATE PREVIEW — Only visible to you.")}
          <Link to={`/studio/${journey.slug}`}>{tr("Return to studio ↗")}</Link>
        </div>
      )}
      {runningSlot && createPortal(
        <span>
          {journey.title}
          {journey.location ? <span className="header-running-place"> · {journey.location}</span> : null}
        </span>,
        runningSlot,
      )}
      {!showcase && actionsSlot && createPortal(
        <>
          {authenticated && !journey.is_example && (
            <Link
              to={`/studio/${journey.slug}`}
              className="header-action"
              aria-label={t("Edit story", "Geschichte bearbeiten")}
              title={t("Edit story", "Geschichte bearbeiten")}
            >
              <PenLine size={17} strokeWidth={1.25} />
            </Link>
          )}
          <button
            type="button"
            className="header-action"
            onClick={share}
            aria-label={t("Share", "Teilen")}
            title={t("Share", "Teilen")}
          >
            <Share2 size={17} strokeWidth={1.25} />
          </button>
        </>,
        actionsSlot,
      )}
      {!showcase && navSlot && createPortal(
        <>
          {authenticated && !journey.is_example && (
            <Link to={`/studio/${journey.slug}`} className="nav-action">
              <PenLine size={17} strokeWidth={1.25} />
              {t("Edit story", "Geschichte bearbeiten")}
            </Link>
          )}
          <button type="button" className="nav-action" onClick={share}>
            <Share2 size={17} strokeWidth={1.25} />
            {t("Share", "Teilen")}
          </button>
        </>,
        navSlot,
      )}
      <JournalCanvas journey={journey} onPhoto={openPhoto} />
      <div className={`story-end page-width${journey.is_example || showcase ? " story-end-editions" : ""}`}>
        {!journey.is_example && !showcase && (
          <Link className="text-link" to="/archive">
            <ArrowLeft size={17} /> {tr("Back to the archive")}
          </Link>
        )}
        {showcase && (
          <button className="text-link" onClick={share}>
            <Share2 size={14} /> {t("Share", "Teilen")}
          </button>
        )}
        <button className="text-link" onClick={() => setCollection("all")}>
          {tr("All")} {journey.photos.length} {tr("photographs")}{" "}
          <ArrowUpRight size={17} />
        </button>
        <div className="story-to-top">
          <button type="button" className="text-link" onClick={backToStart}>
            <ArrowUp size={15} strokeWidth={1} aria-hidden="true" />
            {t("Back to top", "Zum Anfang")}
          </button>
        </div>
      </div>
      {(journey.is_example || showcase) && <OtherEdition journey={journey} showcase={showcase} />}
      {!showcase && !journey.is_example && journey.published && (
        <NextJourney journey={journey} />
      )}
      {journey.demo && !journey.is_example && (
        <p className="reference-note page-width">
          {journey.story_template === "after-hours"
            ? t("Example journey · Tenerife", "Beispielreise · Teneriffa")
            : t("Example journey · Switzerland", "Beispielreise · Schweiz")}
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
                sizes="(max-width: 760px) 100vw, 38vw"
              />
              <span className="eyebrow">
                {formOf(journey) === "journey" ? tr("DAY") : t("CHAPTER", "KAPITEL")}
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
