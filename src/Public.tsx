import { t, tr, useLocale } from "./I18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, List, Grid2X2 } from "lucide-react";
import { api } from "./api";
import { Reveal } from "./Reveal";
import { dateLabel, dateRange, Picture } from "./components";
import { BrandMonogram } from "./SignatureBrand";
import type { Journey } from "./types";

const showcaseReveal = { effect: "up", intensity: 18 } as const;

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
export function Home() {
  const { journeys, loading, error } = useJourneys();
  const { locale } = useLocale();
  const [showcaseResult, setShowcaseResult] = useState<{
    locale: typeof locale;
    story: Journey | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<Journey>(`/showcase/quiet-atlas?lang=${locale}`, {
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
  const showcase =
    showcaseResult?.locale === locale ? showcaseResult.story : null;
  const journey = showcase ?? journeys[0];
  const otherJourneys = showcase ? journeys.slice(0, 4) : journeys.slice(1, 4);
  const featureUrl = showcase
    ? "/showcase/quiet-atlas"
    : `/journeys/${journey?.slug}`;
  const featureLabel = showcase
    ? t("Featured photo essay", "Fotoessay im Fokus")
    : tr("Latest journey");
  const readLabel = showcase ? tr("Read the photo essay") : tr("Read the journey");
  return (
    <main id="main" className="home-page">
      <section className="home-intro page-width">
        <div className="intro-composition">
          <h1>
            <Reveal as="span">
              {tr("Journeys in photographs and stories")}
            </Reveal>
          </h1>
          <div className="intro-aside">
            <p>
              {tr(
                "A personal travel journal for photographs, notes and the moments worth keeping.",
              )}
            </p>
            <div className="home-paths">
              <Link to="/archive" className="text-link home-reader-link">
                {tr("Explore the archive")} <ArrowUpRight size={18} />
              </Link>
              <Link to="/studio" className="home-studio-link">
                {tr("Open the studio")} <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section
        className={`home-feature page-width${showcase ? " home-showcase" : ""}`}
        id="latest"
        aria-label={featureLabel}
      >
        {(!showcase && loading) || showcaseResult?.locale !== locale ? (
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
          <article className="home-feature-story">
            <Link
              to={featureUrl}
              state={
                !showcase && journey.cover
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
                  : undefined
              }
              className="home-feature-image-link"
              aria-label={`${readLabel}: ${journey.title}`}
            >
              <Picture
                photo={journey.cover}
                eager
                className="home-feature-image"
                sizes="(max-width: 760px) calc(100vw - 44px), (min-width: 1455px) 616px, calc(50vw - 4.2vw - 24px)"
              />
              {!showcase && (
                <span className="home-feature-image-label">
                  {tr("THE LATEST JOURNEY")}
                </span>
              )}
              <span className="home-feature-image-arrow" aria-hidden="true">
                <ArrowUpRight />
              </span>
            </Link>
            <div className="home-feature-copy">
              {!showcase && (
                <span className="eyebrow">
                  {journey.country} / {dateLabel(journey.start_date, {
                    month: "long",
                    year: "numeric",
                  })}
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
              <Link className="text-link" to={featureUrl}>
                {readLabel} <ArrowUpRight size={18} />
              </Link>
              {showcase && (
                <div className="home-showcase-details">
                  {/* Water and the walker foreshadow the essay's change in scale. */}
                  {[showcase.photos[3], showcase.photos[5]].map((photo) => photo && (
                    <Picture key={photo.id} photo={photo} animate sizes="(max-width: 480px) 40vw, 200px" />
                  ))}
                </div>
              )}
            </div>
          </article>
        ) : (
          <div className="home-feature-empty">
            <BrandMonogram />
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
      {showcase && error && (
        <div className="home-more page-width">
          <p className="inline-error" role="alert">{error}</p>
          <Link to="/archive" className="text-link">
            {tr("Explore the archive")} <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      {otherJourneys.length > 0 && (
        <section
          className="home-more page-width"
          aria-labelledby="home-more-title"
        >
          <div className="home-more-heading">
            <h2 id="home-more-title">{tr("More from the journal")}</h2>
            <Link to="/archive" className="text-link">
              {tr("View all journeys")} <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="home-more-grid">
            {otherJourneys.map((item) => (
              <Link
                key={item.id}
                to={`/journeys/${item.slug}`}
                className="home-more-entry"
              >
                <Picture
                  photo={item.cover}
                  sizes="(max-width: 760px) calc(100vw - 44px), (min-width: 1455px) 616px, calc(50vw - 4.2vw - 24px)"
                />
                <div className="home-more-copy">
                  <h3>{item.title}</h3>
                  {item.subtitle && <p>{item.subtitle}</p>}
                  <small className="home-journey-meta">
                    {item.country} / {dateLabel(item.start_date, { year: "numeric" })}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
export function Archive() {
  const { journeys, loading, error } = useJourneys();
  const [view, setView] = useState<"editorial" | "index">("editorial"),
    [order, setOrder] = useState("newest");
  const sorted = [...journeys].sort((a, b) =>
    order === "newest"
      ? b.start_date.localeCompare(a.start_date)
      : a.start_date.localeCompare(b.start_date),
  );
  return (
    <main id="main" className="archive-page page-width">
      <div className="archive-heading">
        <span className="eyebrow">
          {tr("THE COLLECTION /")}
          {String(journeys.length).padStart(2, "0")}
          {tr("JOURNEYS")}
        </span>
        <h1>
          <Reveal as="span">
            {tr("A life,")}
            <br />
            <em>{tr("well wandered.")}</em>
          </Reveal>
        </h1>
        <p>
          <Reveal as="span">
            {tr("Every place leaves a little of itself with us.")}
            <br />
            {tr("Here is where those little things live.")}
          </Reveal>
        </p>
      </div>
      <div className="archive-toolbar">
        <div className="view-switch" aria-label={tr("Archive view")}>
          <button
            className={view === "editorial" ? "selected" : ""}
            onClick={() => setView("editorial")}
            aria-pressed={view === "editorial"}
          >
            <Grid2X2 size={15} />
            {tr("Editorial")}
          </button>
          <button
            className={view === "index" ? "selected" : ""}
            onClick={() => setView("index")}
            aria-pressed={view === "index"}
          >
            <List size={16} />
            {tr("Index")}
          </button>
        </div>
        <label className="sort-control">
          {tr("SORT BY")}{" "}
          <select
            aria-label={tr("Sort journeys")}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="newest">{tr("Newest first")}</option>
            <option value="oldest">{tr("Oldest first")}</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p className="loading-text">{tr("Opening the archive…")}</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : sorted.length ? (
        <div className={`archive-entries ${view}`}>
          {sorted.map((j, i) => (
            <Link
              key={j.id}
              to={`/journeys/${j.slug}`}
              className={`archive-entry${view === "editorial" && i === 0 ? " archive-entry--lead" : ""}`}
            >
              <div className="entry-number">
                {String(i + 1).padStart(2, "0")}
              </div>
              <Picture
                animate
                photo={j.cover}
                sizes="(max-width: 760px) 100vw, 60vw"
              />
              <div className="archive-entry-copy">
                <span className="eyebrow">
                  {j.country} / {dateLabel(j.start_date, { year: "numeric" })}
                </span>
                <h2>
                  <Reveal as="span">{j.title}</Reveal>
                </h2>
                <p>
                  <Reveal as="span">{j.subtitle}</Reveal>
                </p>
                <div className="entry-foot">
                  <span>{dateRange(j.start_date, j.end_date)}</span>
                  <ArrowUpRight />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BrandMonogram />
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
      {sorted.length > 0 && (
        <div className="archive-end">
          <span className="small-line" />
          <p>
            <Reveal as="span">{tr("And so much still to discover.")}</Reveal>
          </p>
          <BrandMonogram />
        </div>
      )}
    </main>
  );
}
export function About() {
  return (
    <main id="main" className="about-page page-width">
      <div className="eyebrow">{tr("A NOTE ABOUT WANDER")}</div>
      <h1>
        <Reveal as="span">
          {tr("For the places.")}
          <br />
          {tr("For the feelings.")}
          <br />
          <em>{tr("For the remembering.")}</em>
        </Reveal>
      </h1>
      <div className="about-content">
        <BrandMonogram />
        <div>
          <p className="about-lead">
            {tr("A photograph holds a place.")}
            <br />
            {tr("A story brings you back.")}
          </p>
          <p>
            <Reveal as="span">
              {tr(
                "WANDER is a personal travel journal, shaped like a little magazine. A quiet home for photographs, field notes and the moments that rarely make it onto a map.",
              )}
            </Reveal>
          </p>
          <p>
            <Reveal as="span">
              {tr(
                "Some journeys take us far away. Others are just an afternoon down an unfamiliar path. What matters is what stays with us.",
              )}
            </Reveal>
          </p>
          <p>
            <Reveal as="span">
              {tr(
                "The two WANDER editions are original, fictional photo essays. Their stock photographs illustrate an atmosphere. Your own journeys, photographs and words live independently in your journal.",
              )}
            </Reveal>
          </p>
          <Link className="text-link" to="/studio">
            {tr("Make it your own")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
      <section className="credits" id="credits">
        <span className="eyebrow">{tr("PHOTOGRAPHY & TYPE")}</span>
        <h2>
          <Reveal as="span">
            {tr("A little credit,")}
            <br />
            <em>{tr("where it is due.")}</em>
          </Reveal>
        </h2>
        <p>
          <Reveal as="span">
            {tr("Demo photographs are used under the")}{" "}
            <a
              href="https://unsplash.com/license"
              target="_blank"
              rel="noreferrer"
            >
              {tr("Unsplash License ↗")}
            </a>{" "}
            {tr(
              "and stored locally. Your own journeys can use your own photographs.",
            )}
          </Reveal>
        </p>
        <ul>
          <li>
            <a
              href="https://unsplash.com/photos/u8bo8dmhGMc"
              target="_blank"
              rel="noreferrer"
            >
              Mike Tilley — Light along a forest road ↗
            </a>
          </li>
          <li>
            <a
              href="https://unsplash.com/photos/sRsc98Giz5I"
              target="_blank"
              rel="noreferrer"
            >
              T — Moss-covered trees beside a river ↗
            </a>
          </li>
          <li>
            <a
              href="https://unsplash.com/photos/rwiUgwQyi5s"
              target="_blank"
              rel="noreferrer"
            >
              Ewan Z — A figure in the morning light ↗
            </a>
          </li>
          <li>
            <a
              href="https://unsplash.com/photos/8oj7ls-3G9I"
              target="_blank"
              rel="noreferrer"
            >
              Takashi Miyazaki — Moss and flowing water ↗
            </a>
          </li>
          <li>
            <a
              href="https://unsplash.com/photos/JonGFaeFPgg"
              target="_blank"
              rel="noreferrer"
            >
              Lili Kovac — Pine trees surrounded by fog ↗
            </a>
          </li>
          <li>
            <a
              href="https://unsplash.com/photos/84YI_5TWAiU"
              target="_blank"
              rel="noreferrer"
            >
              Jon Flobrant — Forested mountains ↗
            </a>
          </li>
          <li>
            <a
              href="https://unsplash.com/photos/HDdoBRocjD0"
              target="_blank"
              rel="noreferrer"
            >
              paws and prints — A misty landscape ↗
            </a>
          </li>
          <li>
            <a
              href="https://unsplash.com/photos/d6lFoNdyeo8"
              target="_blank"
              rel="noreferrer"
            >
              Damien Schnorhk — Pines in the mist ↗
            </a>
          </li>
        </ul>
        <p>
          <Reveal as="span">
            {tr(
              "Instrument Serif by Rodrigo Fuenzalida. Manrope by Mikhail Sharanda.",
            )}
            <br />
            {tr(
              "Locally served, open-source typefaces under the SIL Open Font License.",
            )}
          </Reveal>
        </p>
      </section>
    </main>
  );
}
