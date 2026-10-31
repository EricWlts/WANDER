import { tr } from "./I18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUpRight,
  List,
  Grid2X2,
} from "lucide-react";
import { api } from "./api";
import { Reveal, journeyReveal } from "./Reveal";
import { Compass, dateLabel, dateRange, dayCount, Picture } from "./components";
import type { Journey } from "./types";
import { Parallax } from "./Motion";
import { HomeDays } from "./StoryExperience";

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
  const journey = journeys[0];
  return (
    <main id="main">
      <section className="home-intro page-width">
        <div className="intro-composition">
          <h1>
            <Reveal as="span">
              {tr("Somewhere,")}
              <br />
              <em>{tr("worth remembering.")}</em>
            </Reveal>
          </h1>
          <div className="intro-aside">
            <Compass />
            <p>
              <Reveal as="span">
                {tr("Not just the places we go.")}
                <br />
                {tr("But the way they make us feel.")}
              </Reveal>
            </p>
            <a href="#latest" className="scroll-link">
              {tr("SCROLL TO WANDER")} <ArrowDown size={15} />
            </a>
          </div>
        </div>
      </section>
      <section
        className="home-cover page-width"
        aria-label={tr("Latest journey")}
      >
        {loading ? (
          <div className="loading-photo" aria-label={tr("Loading journeys")} />
        ) : error ? (
          <div className="inline-error" role="alert">
            {error}
            <button onClick={() => location.reload()}>{tr("Try again")}</button>
          </div>
        ) : journey ? (
          <Link to={`/journeys/${journey.slug}`} className="cover-link">
            <Parallax enabled={journey.layout?.parallax ?? true}>
              <Picture
                photo={journey.cover}
                eager
                className="home-cover-image"
              />
            </Parallax>
            <div className="cover-shade" />
            <div className="cover-top">
              <span>
                {tr("FIELD NOTES — VOL.")}
                {String(journey.id).padStart(3, "0")}
              </span>
              <span>
                {journey.country.toUpperCase()} ·{" "}
                {dateLabel(journey.start_date, {
                  month: "long",
                  year: "numeric",
                }).toUpperCase()}
              </span>
            </div>
            <div className="cover-title">
              <div className="eyebrow">
                {tr("THE LATEST JOURNEY")}{" "}
                <span>01 / {String(journeys.length).padStart(2, "0")}</span>
              </div>
              <h2>
                <Reveal
                  as="span"
                  config={journeyReveal(journey.reveal_settings, "title")}
                >
                  {journey.title}
                </Reveal>
              </h2>
              <p>
                <Reveal
                  as="span"
                  config={journeyReveal(journey.reveal_settings, "title")}
                >
                  {journey.subtitle}
                </Reveal>
              </p>
            </div>
            <span className="cover-arrow" aria-hidden="true">
              <ArrowUpRight />
            </span>
            <span className="cover-side">
              {tr("SOME MOMENTS STAY WITH YOU.")}
            </span>
          </Link>
        ) : (
          <div className="empty-cover">
            <Compass />
            <h2>
              <Reveal as="span">{tr("Every story starts somewhere.")}</Reveal>
            </h2>
            <Link to="/studio" className="text-link">
              {tr("Begin your first journey")}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        )}
        <div className="cover-caption">
          <span>{tr("A DIGITAL KEEPSAKE. A WINDOW BACK.")}</span>
          <span>
            EST. 2026 <span className="caption-star">✳</span>
            {tr("ALWAYS WANDERING")}
          </span>
        </div>
      </section>
      <section className="manifesto page-width" id="latest">
        <div className="section-index">
          <span>{tr("01 — THE JOURNAL")}</span>
          <span>{tr("COLLECTING MOMENTS, NOT MILES.")}</span>
        </div>
        <div className="manifesto-content">
          <ArrowDownLeft strokeWidth={1} className="manifesto-arrow" />
          <h2>
            <Reveal as="span">
              {tr("Life moves.")}
              <br />
              <em>{tr("Some things should stay.")}</em>
            </Reveal>
          </h2>
          <div>
            <p>
              <Reveal as="span">
                {tr(
                  "A fleeting light. An unfamiliar path. The kind of quiet you wish you could take home.",
                )}
              </Reveal>
            </p>
            <p>
              <Reveal as="span">
                {tr(
                  "This is a place for those things. Photographs, field notes, and little pieces of a life well wandered.",
                )}
              </Reveal>
            </p>
            <Link to="/about" className="text-link">
              {tr("A note about WANDER")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      {journey && (
        <section className="selected-story page-width">
          <Link
            to={`/journeys/${journey.slug}`}
            className="selected-image-link"
          >
            <Picture
              animate
              photo={journey.cover}
              sizes="(max-width: 760px) 100vw, 56vw"
            />
            <span className="selected-tag">{tr("FROM THE JOURNAL")}</span>
          </Link>
          <div className="selected-copy">
            <span className="eyebrow">
              {journey.country} /{" "}
              {dateLabel(journey.start_date, { year: "numeric" })}
            </span>
            <h2>
              <Reveal as="span">
                {journey.title}
                <em>{journey.subtitle}</em>
              </Reveal>
            </h2>
            <p>
              <Reveal as="span">{journey.description}</Reveal>
            </p>
            <div className="journey-facts">
              <span>
                {String(
                  dayCount(journey.start_date, journey.end_date),
                ).padStart(2, "0")}{" "}
                {tr("DAYS")}
              </span>
              <span>
                {String(journey.photo_count).padStart(2, "0")}
                {tr("PHOTOGRAPHS")}
              </span>
            </div>
            <Link className="text-link" to={`/journeys/${journey.slug}`}>
              {tr("Step inside the story")}
              <ArrowUpRight size={18} />
            </Link>
            {journey.demo && (
              <span className="demo-caption">
                {tr("An imagined journey · Illustrative photography")}
              </span>
            )}
          </div>
        </section>
      )}
      {journey && <HomeDays slug={journey.slug} />}
      <section className="home-interlude">
        <Compass />
        <p>
          <Reveal as="span">
            {tr("Go slowly.")}
            <br />
            {tr("Look closely.")}
            <br />
            <em>{tr("Remember how it felt.")}</em>
          </Reveal>
        </p>
        <span className="eyebrow">
          {tr("THE BEAUTY IS IN THE IN-BETWEEN.")}
        </span>
      </section>
      <section className="archive-invite page-width">
        <div>
          <span className="eyebrow">
            {tr("THERE IS ALWAYS ANOTHER CHAPTER.")}
          </span>
          <h2>
            <Reveal as="span">
              {tr("The places become")}
              <br />
              <em>{tr("part of us.")}</em>
            </Reveal>
          </h2>
        </div>
        <Link to="/archive" className="large-link">
          {tr("Explore the archive")}{" "}
          <span className="round-arrow">
            <ArrowUpRight />
          </span>
        </Link>
      </section>
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
              className="archive-entry"
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
          <Compass />
          <h2>
            <Reveal as="span">{tr("Room for your first adventure.")}</Reveal>
          </h2>
          <Link className="text-link" to="/studio">
            {tr("Create a journey")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
      )}
      <div className="archive-end">
        <span className="small-line" />
        <p>
          <Reveal as="span">{tr("And so much still to discover.")}</Reveal>
        </p>
        <Compass />
      </div>
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
        <Compass />
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
