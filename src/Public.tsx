import { BASE_URL } from "./staticSite";
import { t, tr, useLocale } from "./I18n";
import { archiveStats, issueNumbers, toRoman, travelDate } from "./issueLabel";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Link } from "react-router-dom";
import { ArrowDownUp, ArrowUpRight } from "lucide-react";
import { api } from "./api";
import { Reveal } from "./Reveal";
import { dateLabel, dateRange, Picture } from "./components";
import { formDateText, formOf } from "./journeyForm";
import { SignatureWordmark } from "./SignatureBrand";
import { useMotionOff } from "./Motion";
import type { Journey, Photo, SiteHero } from "./types";
import { coverFocusVars } from "./editionOverrides";
import { heroCopyOpacity, heroDim } from "./editionCompare";
import { focusToPosition, normalizeFocus } from "./heroFocus";
import { coverLinkProps } from "./viewTransitions";
import { FocusView } from "./FocusView";
import { ArchiveMagazine } from "./ArchiveMagazine";
import { HomeTransformation } from "./HomeTransformation";
import { usePageTitle } from "./App";
import { prefersReducedMotion } from "./motionState";
import { nextArchiveOrder, sortArchiveJourneys, type ArchiveOrder } from "./studioSort";
/** Label of the archive's sort toggle (cycles: recently created → latest trip → earliest trip). */
function archiveOrderLabel(order: ArchiveOrder): string {
  if (order === "created") return t("Recently created", "Zuletzt erstellt");
  return order === "newest" ? t("Latest trip first", "Neueste Reise zuerst") : t("Earliest trip first", "Älteste Reise zuerst");
}
function archiveOrderAria(order: ArchiveOrder): string {
  const next = archiveOrderLabel(nextArchiveOrder(order));
  return t(`Sorted: ${archiveOrderLabel(order)}. Switch to ${next}`, `Sortiert: ${archiveOrderLabel(order)}. Umschalten auf ${next}`);
}


const showcaseReveal = { effect: "up", intensity: 18 } as const;

const dateFormats = { range: dateRange, day: (day: string) => dateLabel(day) };
/** Date line of a card: journeys keep their own wording, other forms follow their form. */
function cardDate(item: Journey, journeyText: string): string {
  return formOf(item) === "journey" ? journeyText : formDateText(formOf(item), item.start_date, item.end_date, dateFormats);
}

function useJourneys() {
  const [journeys, setJourneys] = useState<Journey[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    api<Journey[]>("/journeys?public=1")
      .then(setJourneys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return { journeys, loading, error };
}

/**
 * Hero parallax: the photograph drifts slower than the page and swells very slightly,
 * the copy leaves faster and fades, the shade deepens. Only transform/opacity are driven
 * (through custom properties), one rAF per scroll burst, and only while the hero is visible.
 */
function useHeroParallax(target: RefObject<HTMLElement | null>, off: boolean) {
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    // data-scrolled marks that the reader has started scrolling.
    const markScrolled = () => {
      el.toggleAttribute("data-scrolled", window.scrollY > 24);
    };
    markScrolled();
    window.addEventListener("scroll", markScrolled, { passive: true });
    const reduced = prefersReducedMotion();
    const props = ["--hero-y", "--hero-scale", "--hero-copy-y", "--hero-copy-o", "--hero-dim"];
    const reset = () => props.forEach((name) => el.style.removeProperty(name));
    reset();
    if (off || reduced || typeof IntersectionObserver === "undefined") {
      return () => window.removeEventListener("scroll", markScrolled);
    }
    const compact = window.matchMedia("(max-width: 760px)");
    let frame = 0;
    let visible = true;
    const draw = () => {
      frame = 0;
      const height = el.offsetHeight || 1;
      const progress = Math.min(1, Math.max(0, window.scrollY / height));
      const calm = compact.matches ? 0.6 : 1;
      // Depth staggering (calmer): image slowest (net ~0.74), copy in between (~0.88), page 1.
      el.style.setProperty("--hero-y", `${(window.scrollY * 0.26 * calm).toFixed(1)}px`);
      el.style.setProperty("--hero-scale", "1");
      el.style.setProperty("--hero-copy-y", `${(-window.scrollY * 0.12 * calm).toFixed(1)}px`);
      el.style.setProperty("--hero-copy-o", heroCopyOpacity(progress).toFixed(3));
      el.style.setProperty("--hero-dim", heroDim(progress).toFixed(3));
    };
    const schedule = () => {
      if (visible && !frame) frame = window.requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
      },
      { threshold: 0 },
    );
    observer.observe(el);
    draw();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", markScrolled);
      reset();
    };
  }, [target, off]);
}
/** Calm parallax for the closing photograph: drifts with its position in the viewport. */
function useBackdropParallax(target: RefObject<HTMLElement | null>, off: boolean) {
  useEffect(() => {
    const el = target.current;
    if (!el || off || typeof IntersectionObserver === "undefined") return;
    if (prefersReducedMotion()) return;
    const compact = window.matchMedia("(max-width: 760px)");
    let frame = 0;
    let visible = false;
    const draw = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const span = window.innerHeight + rect.height;
      const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / span));
      const reach = rect.height * (compact.matches ? 0.05 : 0.1);
      el.style.setProperty("--close-y", `${((progress - 0.5) * reach).toFixed(1)}px`);
    };
    const schedule = () => {
      if (visible && !frame) frame = window.requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    });
    observer.observe(el);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.style.removeProperty("--close-y");
    };
  }, [target, off]);
}

// Bundled stills (public/images): fixed home-page pictures, independent of the journeys chosen as edition examples.
function bundled(id: number, name: string, width: number, height: number, title = "", alt = ""): Photo {
  return {
    id, chapter_id: null, position: 0, featured: false, demo: true,
    title, alt, description: "", credit: "", source_url: "", width, height,
    url: `${BASE_URL}images/${name}-1280.webp`, large_url: `${BASE_URL}images/${name}-2200.webp`, original_url: null,
    srcset: `${BASE_URL}images/${name}-640.webp 640w, ${BASE_URL}images/${name}-1280.webp 1280w, ${BASE_URL}images/${name}-2200.webp 2200w`,
  } as unknown as Photo;
}
const CLOSING_PHOTO = bundled(-904, "tf-wolken", 2200, 1467);

export function Home() {
  usePageTitle("WANDER — Manche Momente bleiben.", "WANDER — Some moments stay.");
  const { journeys, loading, error } = useJourneys();
  const { locale } = useLocale();
  const motionOff = useMotionOff();
  const [activeDetailPhoto, setActiveDetailPhoto] = useState<number | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  useHeroParallax(heroRef, motionOff);
  const closingRef = useRef<HTMLElement>(null);
  useBackdropParallax(closingRef, motionOff);
  const [activeLastPhoto, setActiveLastPhoto] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{
    locale: typeof locale;
    story: Journey | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<Journey>(`/templates/after-hours/example?lang=${locale}`, { signal: controller.signal })
      .then((story) => {
        if (!controller.signal.aborted) setLastResult({ locale, story });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLastResult({ locale, story: null });
      });
    return () => controller.abort();
  }, [locale]);
  const [showcaseResult, setShowcaseResult] = useState<{
    locale: typeof locale;
    story: Journey | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<Journey>(`/templates/quiet-atlas/example?lang=${locale}`, {
      signal: controller.signal,
    })
      .then((story) => {
        if (!controller.signal.aborted) setShowcaseResult({ locale, story });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setShowcaseResult({ locale, story: null });
        }
      });
    return () => controller.abort();
  }, [locale]);
  // Studio-chosen cover; undefined while loading, null when none (or unreachable).
  const [siteHero, setSiteHero] = useState<SiteHero | null | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    api<SiteHero>("/site/hero", { signal: controller.signal })
      .then((hero) => {
        if (!controller.signal.aborted) setSiteHero(hero);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSiteHero(null);
      });
    return () => controller.abort();
  }, []);
  const showcase =
    showcaseResult?.locale === locale ? showcaseResult.story : null;
  const journey = showcase ?? journeys[0];
  const featureUrl = showcase
    ? "/inspiration/quiet-atlas"
    : `/journeys/${journey?.slug}`;
  const featureLabel = showcase
    ? t("Featured photo essay", "Fotoessay im Fokus")
    : tr("Latest journey");
  const readLabel = showcase ? tr("Read the photo essay") : tr("Read the journey");
  const featureLoading =
    (!showcase && loading) ||
    showcaseResult?.locale !== locale ||
    siteHero === undefined;
  const customHero = siteHero?.photo ?? null;
  const lastStory = lastResult?.locale === locale ? lastResult.story : null;
  // Both edition covers are known: the hero cross-fades between them. The studio hero is the fallback.
  const heroPending = featureLoading || lastResult?.locale !== locale;
  const crossfade = !heroPending && Boolean(showcase?.cover && lastStory?.cover);
  // The studio hero comes from its own request and shows at once; showcases may load afterwards.
  const heroPhoto = heroPending
    ? null
    : crossfade
      ? (showcase?.cover ?? null)
      : customHero
        ? { ...customHero, edits: {} }
        : journey
          ? journey.cover
          : null;
  // Without an own cover the hero follows the featured edition's cover, including its studio-set focus.
  const heroFocus = customHero && !crossfade
    ? normalizeFocus(siteHero?.focus)
    : showcase?.cover_focus
      ? normalizeFocus(showcase.cover_focus)
      : null;
  const heroStyle = heroFocus
    ? ({
        "--hero-pos-desktop": focusToPosition(heroFocus.desktop),
        "--hero-pos-tablet": focusToPosition(heroFocus.tablet),
        "--hero-pos-mobile": focusToPosition(heroFocus.mobile),
      } as CSSProperties)
    : undefined;
  const linkState =
    !showcase && journey?.cover
      ? {
          storyCover: {
            slug: journey.slug,
            cover: {
              id: journey.cover.id,
              url: journey.cover.url,
              srcset: journey.cover.srcset,
              alt: journey.cover.alt,
              width: journey.cover.width,
              height: journey.cover.height,
            },
          },
        }
      : undefined;
  const detailPhotos = [
    bundled(-911, "ch-see", 2200, 1467, t("Still water", "Stilles Wasser"), t("A calm lake with a mountain range in haze", "Ein ruhiger See vor einer Bergkette im Dunst")),
    bundled(-912, "ch-bruecke", 2200, 1467, t("Bridge between the peaks", "Brücke zwischen den Gipfeln"), t("A suspension bridge between snow-covered summits", "Eine Hängebrücke zwischen verschneiten Gipfeln")),
  ];
  // A custom hero is editorially paired with the Tenerife essay unless it uses the featured cover.
  const heroStory = featureLoading
    ? null
    : customHero && !crossfade && customHero.id !== journey?.cover?.id
      ? lastStory
      : journey;
  const heroStoryUrl = heroStory === lastStory ? "/inspiration/after-hours" : featureUrl;
  const lastDetailPhotos = [
    bundled(-913, "tf-hoehle", 2200, 1467, t("In the cave arch", "Im Höhlenbogen"), t("A silhouette in the arch of a cave", "Eine Silhouette im Bogen einer Höhle")),
    bundled(-914, "tf-silhouette", 2200, 1467, t("Against the light", "Im Gegenlicht"), t("Silhouette of a man in backlight", "Silhouette eines Mannes im Gegenlicht")),
  ];
  // Hero: a very slow cross-fade between the light and the dark edition cover (second layer).
  const heroAlt = crossfade ? (lastStory?.cover ?? null) : null;
  const heroAltFocus = heroAlt && lastStory?.cover_focus ? normalizeFocus(lastStory.cover_focus) : null;
  const heroAltStyle = heroAltFocus
    ? ({
        "--hero-pos-desktop": focusToPosition(heroAltFocus.desktop),
        "--hero-pos-tablet": focusToPosition(heroAltFocus.tablet),
        "--hero-pos-mobile": focusToPosition(heroAltFocus.mobile),
      } as CSSProperties)
    : undefined;
  // Closing: fixed for now – the clouds over the ridge on Tenerife (a bundled image, independent of
  // whichever journey is chosen as an edition example).
  const closingPhoto = CLOSING_PHOTO;
  return (
    <main id="main" className="home-page" data-page-ready={heroPending ? "false" : "true"}>
      <section
        ref={heroRef}
        className={`home-hero${heroPhoto ? " has-image" : ""}${heroFocus ? " has-hero-focus" : ""}`}
        style={heroStyle}
      >
        {heroPhoto && (
          <div className="home-hero-media">
            <div className="home-hero-layer">
              <div className="home-hero-slide">
                <Picture
                  photo={heroPhoto}
                  eager
                  priority="high"
                  className="home-hero-image"
                  sizes="100vw"
                />
              </div>
              {heroAlt && (
                <div
                  className={`home-hero-slide is-alt${heroAltFocus ? " has-slide-focus" : ""}`}
                  style={heroAltStyle}
                  aria-hidden="true"
                >
                  <Picture photo={heroAlt} className="home-hero-image" sizes="100vw" />
                </div>
              )}
            </div>
          </div>
        )}
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-hero-copy">
          <span className="home-hero-kicker">
            {t("WANDER · Photo journal", "WANDER · Fotojournal")}
          </span>
          <h1>{t("Some moments stay.", "Manche Momente bleiben.")}</h1>
          <p>
            {t(
              "Journeys, collections and single moments – told like a magazine.",
              "Reisen, Sammlungen und einzelne Augenblicke – erzählt wie in einem Magazin.",
            )}
          </p>
          <div className="home-hero-links">
            <Link to="/studio" className="home-hero-link">
              {t("Design your own story", "Eigene Geschichte gestalten")} <ArrowUpRight size={18} />
            </Link>
            {crossfade && showcase && lastStory ? (
              /* Both links share one grid cell (width of the longer one) and the cover's 19 s cycle,
                 so text and target always match the visible photograph. Hidden = visibility: hidden,
                 which also takes it out of the tab order and the accessibility tree. */
              <span className="home-hero-swap">
                <Link to="/inspiration/quiet-atlas" className="home-hero-link is-quiet home-hero-swap-link is-first">
                  {t(`Read “${showcase.title}”`, `${showcase.title} lesen`)} <ArrowUpRight size={18} />
                </Link>
                <Link to="/inspiration/after-hours" className="home-hero-link is-quiet home-hero-swap-link is-alt">
                  {t(`Read “${lastStory.title}”`, `${lastStory.title} lesen`)} <ArrowUpRight size={18} />
                </Link>
              </span>
            ) : heroStory && (
              <Link to={heroStoryUrl} className="home-hero-link is-quiet">
                {t(`Read “${heroStory.title}”`, `${heroStory.title} lesen`)} <ArrowUpRight size={18} />
              </Link>
            )}
          </div>
        </div>
      </section>
      <section id="verwandlung" className="home-band is-light home-transform" aria-labelledby="home-transform-title">
        <HomeTransformation />
      </section>
      {/* 15.11. abends: ein ruhiger Block erzählt beide Editionen auf einmal; darunter stoßen
          die helle und die dunkle Geschichte mit harter Kante aneinander. */}
      <section id="editionen" className="home-band is-light home-lights-intro" aria-labelledby="editions-heading" tabIndex={-1}>
        <div className="page-width home-lights-intro-inner">
          <span className="eyebrow">{t("Two editions", "Zwei Editionen")}</span>
          <h2 id="editions-heading" className="home-lights-intro-title">{t("Every story has its light.", "Jede Geschichte hat ihr Licht.")}</h2>
          <div className="home-lights-diptych">
            <Link to="/inspiration/quiet-atlas" className="home-lights-panel is-first">
              {(
                <div className="home-lights-photo">
                  <Picture photo={bundled(-915, "ch-panorama", 2200, 1467, t("Alpine panorama", "Alpenpanorama"))} sizes="(max-width: 760px) 40vw, 240px" />
                </div>
              )}
              <div className="home-lights-copy">
              <span className="home-lights-edition">{t("Edition I", "Edition I")}</span>
              <strong>{t("First light", "Erstes Licht")}</strong>
              <p>{t("Bright, framed, quiet.", "Hell, gerahmt, still.")}</p>
              </div>
            </Link>
            <Link to="/inspiration/after-hours" className="home-lights-panel is-last">
              {(
                <div className="home-lights-photo">
                  <Picture photo={bundled(-916, "tf-calima", 2200, 1467, t("Calima sun", "Calima-Sonne"))} sizes="(max-width: 760px) 40vw, 280px" />
                </div>
              )}
              <div className="home-lights-copy">
              <span className="home-lights-edition">{t("Edition II", "Edition II")}</span>
              <strong>{t("Last light", "Letztes Licht")}</strong>
              <p>{t("Dark, borderless, cinematic.", "Dunkel, randlos, filmisch.")}</p>
              </div>
            </Link>
          </div>
          <p className="home-lights-choose">
            {t("Or combine both, module by module.", "Oder kombiniere beide, Modul für Modul.")}
            <Link to="/inspiration" className="text-link">
              {t("See both editions", "Beide Editionen ansehen")} <ArrowUpRight size={18} />
            </Link>
          </p>
        </div>
      </section>
      <div className="home-band is-light">
      <section
        className={`home-feature page-width${showcase ? " home-showcase" : ""}`}
        id="latest"
        aria-label={featureLabel}
      >
        {featureLoading ? (
          <div
            className="home-feature-loading"
            aria-label={tr("Loading journeys")}
          />
        ) : !showcase && error ? (
          <div className="home-feature-error inline-error" role="alert">
            {error}
            <button onClick={() => location.reload()}>{tr("Try again")}</button>
          </div>
        ) : journey ? (
          <article className="home-feature-story is-text-pair">
            <div className="home-feature-copy">
              {showcase ? (
                <span className="eyebrow">{t("First light", "Erstes Licht")}</span>
              ) : (
                <span className="eyebrow">
                  {[journey.country, cardDate(journey, dateLabel(journey.start_date, {
                    month: "long",
                    year: "numeric",
                  }))].filter(Boolean).join(" · ")}
                </span>
              )}
              <h2>
                {showcase ? <Reveal as="span" config={showcaseReveal}>{journey.title}</Reveal> : journey.title}
              </h2>
              {journey.subtitle && (
                <p className="home-feature-subtitle">
                  {showcase ? <Reveal as="span" config={showcaseReveal}>{journey.subtitle}</Reveal> : journey.subtitle}
                </p>
              )}
              {journey.description && (
                <p className="home-feature-description">
                  {showcase ? (
                    <Reveal as="span" config={showcaseReveal}>{journey.description}</Reveal>
                  ) : journey.description}
                  {showcase && (
                    <small className="home-showcase-note">{journey.country}</small>
                  )}
                </p>
              )}
              <Link className="text-link" to={featureUrl} state={linkState} {...coverLinkProps(journey.slug, journey.cover, ".home-hero-image img, img.home-hero-image")}>
                {readLabel} <ArrowUpRight size={18} />
              </Link>
            </div>
            {showcase && (
              <div className="home-showcase-details">
                {/* Still water and the bridge foreshadow the essay's change in scale. */}
                {detailPhotos.map((photo, i) => (
                  <figure key={photo.id} className="home-showcase-figure">
                    <Picture
                      photo={photo}
                      animate
                      sizes="(max-width: 760px) 50vw, 34vw"
                      onClick={() => setActiveDetailPhoto(i)}
                      actionLabel={t(
                        `View ${photo.title || photo.alt} full size`,
                        `${photo.title || photo.alt} in voller Größe ansehen`,
                      )}
                    />
                  </figure>
                ))}
              </div>
            )}
          </article>
        ) : (
          <div className="home-feature-empty">
            <SignatureWordmark tone="dark" />
            <div>
              <span className="eyebrow">{tr("THE JOURNAL")}</span>
              <h2>{tr("A place for journeys in photographs and stories.")}</h2>
              <p>{tr("No journeys have been published yet.")}</p>
              <Link className="text-link" to="/archive">
                {tr("Explore the archive")} <ArrowUpRight size={18} />
              </Link>
            </div>
          </div>
        )}
      </section>
      </div>
      {!featureLoading && lastStory && (
        <div className="home-band is-dark home-lastlight">
          <section className="home-feature home-showcase is-mirrored page-width" aria-label={t("Last light", "Letztes Licht")}>
            <article className="home-feature-story is-text-pair">
              <div className="home-feature-copy">
                <span className="eyebrow">{t("Last light", "Letztes Licht")}</span>
                <h2><Reveal as="span" config={showcaseReveal}>{lastStory.title}</Reveal></h2>
                {lastStory.subtitle && (
                  <p className="home-feature-subtitle"><Reveal as="span" config={showcaseReveal}>{lastStory.subtitle}</Reveal></p>
                )}
                {lastStory.description && (
                  <p className="home-feature-description">
                    <Reveal as="span" config={showcaseReveal}>{lastStory.description}</Reveal>
                    <small className="home-showcase-note">{lastStory.country}</small>
                  </p>
                )}
                <Link className="text-link" to="/inspiration/after-hours">
                  {tr("Read the photo essay")} <ArrowUpRight size={18} />
                </Link>
              </div>
              {lastDetailPhotos.length > 0 && (
                <div className="home-showcase-details">
                  {lastDetailPhotos.map((photo, i) => (
                    <figure key={photo.id} className="home-showcase-figure">
                      <Picture
                        photo={photo}
                        animate
                        sizes="(max-width: 760px) 50vw, 34vw"
                        onClick={() => setActiveLastPhoto(i)}
                        actionLabel={t(
                          `View ${photo.title || photo.alt} full size`,
                          `${photo.title || photo.alt} in voller Größe ansehen`,
                        )}
                      />
                    </figure>
                  ))}
                </div>
              )}
            </article>
          </section>
        </div>
      )}
      {!featureLoading && (
        <section id="how-it-works" ref={closingRef} className={`home-band is-dark home-closing${closingPhoto ? " has-image" : ""}`} aria-labelledby="home-closing-title">
          {closingPhoto && (
            <div className="home-closing-media" aria-hidden="true">
              <div className="home-closing-layer">
                <Picture photo={closingPhoto} className="home-closing-image" sizes="100vw" />
              </div>
            </div>
          )}
          <div className="home-closing-shade" aria-hidden="true" />
          <div className="home-closing-copy">
            <div className="home-steps">
              <ol className="home-steps-list" aria-label={t("How your story is made", "So entsteht deine Geschichte")}>
                {[
                  t("Upload photos", "Fotos hochladen"),
                  t("Choose the light", "Licht wählen"),
                  t("Choose the layout", "Aufbau wählen"),
                ].map((title, i) => (
                  <li key={i} className="home-step">
                    <Reveal as="div" config={showcaseReveal}>
                      <span className="home-step-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                      <h3>{title}</h3>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>
            <div className="home-closing-cta">
              <h2 id="home-closing-title"><Reveal as="span" config={showcaseReveal}>{t("Your pictures are already waiting.", "Deine Bilder warten schon.")}</Reveal></h2>
              <Link to="/studio" className="home-hero-link">
                {t("Start now", "Jetzt beginnen")} <ArrowUpRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}
      {activeLastPhoto !== null && lastDetailPhotos.length > 0 && (
        <FocusView
          photos={lastDetailPhotos}
          initial={activeLastPhoto}
          onClose={() => setActiveLastPhoto(null)}
        />
      )}
      {activeDetailPhoto !== null && detailPhotos.length > 0 && (
        <FocusView
          photos={detailPhotos}
          initial={activeDetailPhoto}
          onClose={() => setActiveDetailPhoto(null)}
        />
      )}
    </main>
  );
}
export function Archive() {
  usePageTitle("Archiv — WANDER", "Archive — WANDER");
  const { journeys, loading, error } = useJourneys();
  // 13.11.: the archive is always the magazine; the Magazin/Index switch is gone (index markup kept, unreachable).
  const view = "editorial" as "editorial" | "index";
  const [order, setOrder] = useState<ArchiveOrder>("created");
  const sorted = sortArchiveJourneys(journeys, order);
  const issues = issueNumbers(journeys);
  const stats = archiveStats(journeys);
  return (
    <main id="main" className="archive-page page-width" data-page-ready={loading ? "false" : "true"}>
      {view === "editorial" && !loading && !error && sorted.length > 0 ? (
        <section className="archive-overview" id="archive-top">
          <div className="archive-overview-top">
                <header className="archive-heading archive-masthead">
                  <span className="eyebrow">
                    {t("The archive", "Das Archiv")}
                  </span>
                  <h1>
                    <Reveal as="span">
                      {t("All journeys.", "Alle Reisen.")}{" "}
                      <em>{t("One collection.", "Eine Sammlung.")}</em>
                    </Reveal>
                  </h1>
                  <p className="page-lead am-lead">
                    {t(
                      "Every journey is an issue of its own – one after another.",
                      "Jede Reise ist eine eigene Ausgabe – eine nach der anderen.",
                    )}
                  </p>
                </header>
            <dl className="archive-stats">
              <div>
                <dt>{t("Journeys", "Reisen")}</dt>
                <dd>{stats.count}</dd>
              </div>
              {stats.countries > 0 && (
                <div>
                  <dt>{t("Countries", "Länder")}</dt>
                  <dd>{stats.countries}</dd>
                </div>
              )}
              {stats.since && (
                <div>
                  <dt>{t("Since", "Seit")}</dt>
                  <dd>{stats.since}</dd>
                </div>
              )}
            </dl>
          </div>
              <div className="archive-toolbar">
                <div className="am-meta">
                  <span className="am-count">
                    <strong>{String(journeys.length).padStart(2, "0")}</strong> {t("Journeys", "Reisen")}
                  </span>
                  <button
                      type="button"
                      className="sort-toggle"
                      onClick={() => setOrder(nextArchiveOrder(order))}
                      aria-label={archiveOrderAria(order)}
                    >
                      <span className="sort-toggle-label">{t("Sorted:", "Sortiert:")}</span>
                      <ArrowDownUp size={14} aria-hidden="true" className={order === "oldest" ? "is-flipped" : ""} />
                      {archiveOrderLabel(order)}
                    </button>
                </div>
              </div>
        </section>
      ) : (
        <>
                <header className="archive-heading archive-masthead">
                  <span className="eyebrow">
                    {t("The archive", "Das Archiv")}
                  </span>
                  <h1>
                    <Reveal as="span">
                      {t("All journeys.", "Alle Reisen.")}{" "}
                      <em>{t("One collection.", "Eine Sammlung.")}</em>
                    </Reveal>
                  </h1>
                  <p className="page-lead am-lead">
                    {t(
                      "Every journey is an issue of its own – one after another.",
                      "Jede Reise ist eine eigene Ausgabe – eine nach der anderen.",
                    )}
                  </p>
                </header>
                <div className="archive-toolbar">
                  <div className="am-meta">
                    <span className="am-count">
                      <strong>{String(journeys.length).padStart(2, "0")}</strong> {t("Journeys", "Reisen")}
                    </span>
                    <button
                      type="button"
                      className="sort-toggle"
                      onClick={() => setOrder(nextArchiveOrder(order))}
                      aria-label={archiveOrderAria(order)}
                    >
                      <span className="sort-toggle-label">{t("Sorted:", "Sortiert:")}</span>
                      <ArrowDownUp size={14} aria-hidden="true" className={order === "oldest" ? "is-flipped" : ""} />
                      {archiveOrderLabel(order)}
                    </button>
                  </div>
                </div>
        </>
      )}
      {loading ? (
        <p className="loading-text">{tr("Opening the archive…")}</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : sorted.length ? (
        view === "editorial" ? (
          <ArchiveMagazine journeys={sorted} issues={issues} />
        ) : (
          <div className={`archive-entries ${view}`}>
            {sorted.map((j, i) => (
              <Link
                key={j.id}
                to={`/journeys/${j.slug}`}
                {...coverLinkProps(j.slug, j.cover)}
                className={`archive-entry${j.cover_focus ? " has-cover-focus" : ""}`}
                style={coverFocusVars(j.cover_focus) as CSSProperties | undefined}
              >
                <div className="entry-number">
                  {toRoman(issues.get(j.id) ?? i + 1)}
                </div>
                <Picture
                  animate
                  photo={j.cover}
                  sizes="(max-width: 760px) 100vw, 66vw"
                />
                <div className="archive-entry-copy">
                  <span className="eyebrow">
                    {j.country} / {cardDate(j, dateLabel(travelDate(j), { year: "numeric" }))}
                  </span>
                  <h2>
                    <Reveal as="span">{j.title}</Reveal>
                  </h2>
                  <p>
                    <Reveal as="span">{j.subtitle}</Reveal>
                  </p>
                  <div className="entry-foot">
                    <span>{formDateText(formOf(j), j.start_date, j.end_date, dateFormats)}</span>
                    <ArrowUpRight />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="empty-state">
          <SignatureWordmark tone="light" />
          <h2>
            <Reveal as="span">
              {tr("No journeys have been published yet.")}
            </Reveal>
          </h2>
          <p>
            {tr(
              "The archive is a place for shared journeys in photographs and stories.",
            )}
          </p>
          <Link className="text-link" to="/">
            {tr("Back to the journal")}
            <ArrowUpRight size={18} />
          </Link>
          <Link className="archive-studio-link" to="/studio">
            {tr("Open the studio")}
          </Link>
        </div>
      )}
    </main>
  );
}
/** Eric's own photographs for the About page; only reachable when that journey is published. */
/** Eric's own photographs for "Hinter WANDER", shipped as static files (independent of any journey). */
const ABOUT_PORTRAITS = [
  { name: "about-portrait", w: 5152, h: 7728, alt: () => t("Eric, smiling into the camera", "Eric, lächelnd in die Kamera") },
  { name: "about-pair", w: 7728, h: 5152, alt: () => t("Eric and his partner on a lookout tower", "Eric und sein Partner auf einem Aussichtsturm") },
  { name: "about-silhouette", w: 7728, h: 5152, alt: () => t("Silhouette against the evening light on Tenerife", "Silhouette im Abendlicht auf Teneriffa") },
];

export function About() {
  usePageTitle("Über WANDER — WANDER", "About WANDER — WANDER");
  const motionOff = useMotionOff();
  const openingRef = useRef<HTMLElement>(null);
  const closingRef = useRef<HTMLElement>(null);
  useBackdropParallax(openingRef, motionOff);
  useBackdropParallax(closingRef, motionOff);
  const still = (name: string) => ({
    src: `${BASE_URL}images/${name}-1280.webp`,
    srcSet: `${BASE_URL}images/${name}-640.webp 640w, ${BASE_URL}images/${name}-1280.webp 1280w, ${BASE_URL}images/${name}-2200.webp 2200w`,
  });
  const jetty = still("ch-steg");
  const cave = still("tf-hoehle");
  const closing = still("tf-wolken");
  const items = [
    {
      title: t("Journeys", "Reisen"),
      text: t("Days, places, chapters – a whole journey as a story.", "Tage, Orte, Kapitel – eine ganze Reise als Geschichte."),
    },
    {
      title: t("Moments", "Momente"),
      text: t("A single day, an evening, a picture that should stay.", "Ein einzelner Tag, ein Abend, ein Bild, das bleiben soll."),
    },
    {
      title: t("Collections", "Sammlungen"),
      text: t("Pictures you love – across time.", "Bilder, die du magst – quer durch die Zeit."),
    },
  ];
  const trioPics: Array<{ name: string; width: number; height: number }> = [
    { name: "ch-panorama", width: 1280, height: 853 },
    { name: "ch-abendrot", width: 1280, height: 853 },
    { name: "ch-steinmann", width: 1280, height: 1920 },
  ];
  const promises = [
    t("Original quality – your photos stay exactly as you uploaded them.", "Originalqualität – deine Fotos bleiben genau so, wie du sie hochgeladen hast."),
    t("Drafts stay private. Nothing is visible until you publish.", "Entwürfe bleiben privat. Nichts ist sichtbar, bevor du veröffentlichst."),
    t("Published journeys are only reachable by link – not through a public feed.", "Veröffentlichte Reisen sind nur über einen Link erreichbar – nicht über einen öffentlichen Feed."),
    t("You can delete individual photos or entire journeys completely at any time.", "Du kannst einzelne Fotos oder gesamte Reisen jederzeit vollständig löschen."),
  ];
  const nots = [
    t("No feed.", "Kein Feed."),
    t("No likes.", "Keine Likes."),
    t("No ads.", "Keine Werbung."),
    t("No algorithm.", "Kein Algorithmus."),
  ];
  const faq = [
    [t("What does WANDER cost?", "Was kostet WANDER?"), t("WANDER is free for now. It is a small, personal project; how it sustains itself in the future is still open.", "Im Moment ist WANDER kostenlos. Es ist ein kleines, persönliches Projekt; wie es sich in Zukunft trägt, ist noch offen.")],
    [t("Can I create stories myself?", "Kann ich selbst Geschichten erstellen?"), t("Right now only Eric creates stories. The plan is that soon everyone can sign up and publish their own journeys.", "Gerade gestaltet nur Eric Geschichten. Geplant ist, dass sich bald jede und jeder anmelden und eigene Reisen veröffentlichen kann.")],
    [t("Who can see my journeys?", "Wer kann meine Reisen sehen?"), t("Drafts only you. Published journeys are only reachable by link – not through a public feed.", "Entwürfe nur du. Veröffentlichte Reisen sind nur über einen Link erreichbar – nicht über einen öffentlichen Feed.")],
    [t("Does it work on the phone?", "Funktioniert das auch am Handy?"), t("Yes. On the road you can upload your favourites every day, write a few words and share the whole journey at the end.", "Ja. Du kannst unterwegs jeden Tag deine Favoriten hochladen, ein paar Worte dazu schreiben und am Ende die ganze Reise teilen.")],
    [t("Can I delete my photos?", "Kann ich meine Fotos löschen?"), t("Yes. You can delete individual photos or entire journeys at any time – they are then removed completely.", "Ja. Du kannst einzelne Fotos oder ganze Reisen jederzeit löschen – sie sind dann vollständig entfernt.")],
    [t("Where are my photos stored?", "Wo liegen meine Fotos?"), t("Currently on a private server. A server in Germany is planned for later.", "Aktuell auf einem privaten Server. Für später ist ein Server in Deutschland geplant.")],
  ];
  const sizesBig = "(max-width: 760px) calc(100vw - 44px), 40vw";
  const sizesSmall = "(max-width: 760px) 44vw, 20vw";
  return (
    <main id="main" className="about-mag">
      <section ref={openingRef} className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-media" aria-hidden="true">
          <div className="about-hero-layer">
            <img src={jetty.src} srcSet={jetty.srcSet} sizes="100vw" alt="" width={1280} height={853} decoding="async" fetchPriority="high" />
          </div>
        </div>
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="about-hero-copy">
          <h1 id="about-title">
            <Reveal as="span">
              {t("Some moments stay.", "Manche Momente bleiben.")}
              <br />
              <em>{t("Here they find their place.", "Hier finden sie ihren Platz.")}</em>
            </Reveal>
          </h1>
        </div>
      </section>

      <section className="about-section about-behind" aria-labelledby="about-behind-title">
        <Reveal as="div" config={{ effect: "fade", duration: 1600 }} textEffect={false} className="about-behind-text">
          <h2 id="about-behind-title">{t("Behind WANDER", "Hinter WANDER")}</h2>
          <div className="about-prose">
            <p>
              {t(
                "Hi, I'm Eric. In our free time my partner and I love taking photographs. Sadly, countless beautiful pictures get lost among the thousands of photos on the phone. Yet some pictures deserve a special place. That is how the idea for WANDER came about – for now just a small project. Let's see what becomes of it.",
                "Hi, ich bin Eric. In unserer Freizeit fotografieren mein Partner und ich gerne. Leider gehen unzählige schöne Bilder zwischen den tausenden Fotos auf dem Handy unter. Dabei verdienen manche Bilder einen besonderen Platz. So entstand die Idee zu WANDER – erst einmal ein kleines Projekt. Mal schauen, was daraus noch wird.",
              )}
            </p>
          </div>
        </Reveal>
        <div className="about-portraits has-3">
          {ABOUT_PORTRAITS.map((photo, i) => (
            <figure key={photo.name} className={`about-portrait is-${i}`}>
              <Reveal as="div" config={{ effect: "fade", duration: 1400 }} textEffect={false}>
                <span className="picture">
                  <img
                    src={`${BASE_URL}images/${photo.name}-1280.webp`}
                    srcSet={`${BASE_URL}images/${photo.name}-640.webp 640w, ${BASE_URL}images/${photo.name}-1280.webp 1280w, ${BASE_URL}images/${photo.name}-2200.webp 2200w`}
                    sizes={i === 0 ? sizesBig : sizesSmall}
                    alt={photo.alt()}
                    width={photo.w}
                    height={photo.h}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              </Reveal>
            </figure>
          ))}
        </div>
      </section>

      <section className="about-section about-make" aria-labelledby="about-make-title">
        <h2 id="about-make-title">{t("What you can create", "Was du gestalten kannst")}</h2>
        <ul className="about-trio">
          {items.map((item, index) => {
            const pic = trioPics[index] ?? trioPics[0];
            return (
              <li key={item.title} className="about-trio-item">
                <img
                  className="about-trio-img"
                  src={`${BASE_URL}images/${pic.name}-1280.webp`}
                  srcSet={`${BASE_URL}images/${pic.name}-640.webp 640w, ${BASE_URL}images/${pic.name}-1280.webp 1280w`}
                  sizes="(max-width: 760px) calc(100vw - 44px), 30vw"
                  alt=""
                  width={pic.width}
                  height={pic.height}
                  loading="lazy"
                  decoding="async"
                />
                <Reveal as="div" className="about-trio-copy" config={{ effect: "up", intensity: 14 }}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </Reveal>
              </li>
            );
          })}
        </ul>
        <p className="about-note">
          {t(
            "It works on the phone, on the road: upload your favourites every day, add a few words if you like, and at the end share the whole journey – or keep it private.",
            "Es funktioniert auch am Handy, unterwegs: Lade jeden Tag deine Favoriten hoch, schreib ein paar Worte dazu, wenn du magst, und teile am Ende die ganze Reise – oder behalte sie für dich.",
          )}
        </p>
      </section>

      <section className="about-section about-yours" aria-labelledby="about-yours-title">
        <div className="about-yours-main">
          <h2 id="about-yours-title">{t("Your photos stay yours", "Deine Fotos bleiben deine")}</h2>
          <ul className="about-promises">
            {promises.map((text) => (
              <li key={text}>
                <Reveal as="span" config={{ effect: "up", intensity: 10 }}>{text}</Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="about-not" aria-labelledby="about-not-title">
        <div className="about-not-media" aria-hidden="true">
          <img src={cave.src} srcSet={cave.srcSet} sizes="100vw" alt="" width={1280} height={853} loading="lazy" decoding="async" />
        </div>
        <div className="about-not-shade" aria-hidden="true" />
        <div className="about-not-copy">
          <span className="about-kicker">{t("WHAT WANDER IS NOT", "WAS WANDER NICHT IST")}</span>
          <h2 id="about-not-title" className="sr-only">{t("What WANDER is not", "Was WANDER nicht ist")}</h2>
          <ul className="about-not-list">
            {nots.map((line) => (
              <li key={line}>
                <Reveal as="span" config={{ effect: "up", intensity: 16 }}>
                  <s>{line}</s>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className="about-not-final">
            <Reveal as="span" config={{ effect: "up", intensity: 16 }}>
              <em>{t("Just your journey, told in peace.", "Nur deine Reise, in Ruhe erzählt.")}</em>
            </Reveal>
          </p>
        </div>
      </section>

      <section className="about-section about-faq" aria-labelledby="about-faq-title">
        <h2 id="about-faq-title">{t("Frequently asked questions", "Häufige Fragen")}</h2>
        <div className="about-faq-list">
          {faq.map(([q, a]) => (
            <details key={q} className="about-q">
              <summary>
                <span>{q}</span>
                <span className="about-q-mark" aria-hidden="true" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section ref={closingRef} className="about-closing" aria-labelledby="about-closing-title">
        <div className="about-hero-media" aria-hidden="true">
          <div className="about-hero-layer">
            <img src={closing.src} srcSet={closing.srcSet} sizes="100vw" alt="" width={1280} height={853} loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="about-hero-shade is-closing" aria-hidden="true" />
        <div className="about-closing-copy">
          <h2 id="about-closing-title">{t("Create your first story.", "Gestalte deine erste Geschichte.")}</h2>
          <div className="about-cta-row">
            <Link className="about-cta" to="/studio">
              {t("Start now", "Jetzt beginnen")} <ArrowUpRight size={18} />
            </Link>
            <Link className="about-cta is-quiet" to="/archive">
              {t("To the archive", "Zum Archiv")} <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="credits about-credits" id="credits" aria-labelledby="about-credits-title">
        <h2 id="about-credits-title">{t("Credits", "Nachweise")}</h2>
        <p>{t("All photographs by Eric Wilts.", "Alle Fotografien: Eric Wilts.")}</p>
        <p>
          {tr("Instrument Serif by Rodrigo Fuenzalida. Manrope by Mikhail Sharanda.")}
          <br />
          {tr("Locally served, open-source typefaces under the SIL Open Font License.")}
        </p>
      </section>
    </main>
  );
}
