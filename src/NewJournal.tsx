import { useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, json } from "./api";
import { Upload } from "./Upload";
import { getLocale, t } from "./I18n";
import { photoDateRange, shouldAdoptDates } from "./journeyDates";
import { isPlaceholderTitleOfAnyForm, placeholderTitle, withForm } from "./journeyForm";
import {
  FLOW_STEPS,
  STRUCTURE_OPTIONS,
  EMPTY_WORDS,
  canContinue,
  canOpenStation,
  compactWords,
  coverCandidate,
  filmFill,
  stationState,
  structurePreview,
  defaultStructure,
  editionFromParam,
  editorStartQuery,
  needsDaysNote,
  nextStep,
  presetFor,
  previousStep,
  stepFromParam,
  storyDays,
  wordsKey,
  structureFor,
  type FlowStep,
  PREVIEW_FRAME,
  type StructurePreview,
  type StoryEdition,
  type StoryWords,
  type StructureOption,
} from "./newStoryFlow";
import { dayOf } from "./storyDraft";
import { readLights, type PhotoLight } from "./photoMood";
import { editionTraits } from "./editionCopy";
import { StoryCreating } from "./StoryCreating";
import { prefersReducedMotion, storyCreatingPlan } from "./storyCreatingPlan";
import type { Journey } from "./types";
import "./edition-editor.css";
import "./new-story.css";

/** A print mounts blurred and pale and "develops" once its image has loaded. */
const develop = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.setAttribute("data-developed", "");

/** "Neue Geschichte": an assistant with four steps, shown one at a time. */
export function NewJournal() {
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [journey, setJourney] = useState<Journey | null>(null),
    [busy, setBusy] = useState(false),
    [step, setStep] = useState<FlowStep>(1),
    [edition, setEdition] = useState<StoryEdition>(editionFromParam(params.get("template"))),
    [structure, setStructure] = useState<StructureOption | null>(null),
    [words, setWords] = useState<StoryWords>(EMPTY_WORDS),
    [working, setWorking] = useState(false),
    [creating, setCreating] = useState<{ title: string; photos: string[] } | null>(null),
    [error, setError] = useState(""),
    // Set when composing failed: "Try again" repeats it with the same title and words (they stay in this state).
    [failedCompose, setFailedCompose] = useState<boolean | null>(null),
    [resuming, setResuming] = useState(params.get("journey") !== null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  /** Latest journey and the running date update, readable from the upload callbacks. */
  const latest = useRef<Journey | null>(null),
    datesSaved = useRef<Promise<void>>(Promise.resolve());
  const creation = useRef<Promise<Journey> | null>(null);

  const photos = journey?.photos ?? [];
  const dated = photos.filter((p) => dayOf(p.taken_at)).length;
  const chosenStructure = structure ?? defaultStructure(dated);
  const days = storyDays(photos);
  const coverId = journey?.cover_id ?? null;
  /** Light of each photograph (smallest variant, read in the browser): arc "by mood" and placeholder colour. */
  const [lights, setLights] = useState<Record<number, PhotoLight | null>>({});
  const lightKey = photos.map((p) => `${p.id}:${p.srcset || p.url}`).join("|");
  useEffect(() => {
    if (!photos.length) return;
    let cancelled = false;
    void readLights(photos).then((values) => {
      if (!cancelled) setLights(values);
    });
    return () => {
      cancelled = true;
    };
  }, [lightKey]);
  /** Mean colour of a photograph as background while it loads. */
  const tint = (id: number): CSSProperties | undefined => {
    const color = lights[id]?.color;
    return color ? { backgroundColor: color } : undefined;
  };
  const previews = useMemo(() => {
    const input = photos.map((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      taken_at: p.taken_at,
      position: p.position,
      featured: p.featured,
    }));
    const locale = getLocale() === "de" ? "de" : "en";
    // First Light shows the page in its frame, Last Light runs to the edge.
    const frame = edition === "after-hours" ? PREVIEW_FRAME.bleed : PREVIEW_FRAME.framed;
    return Object.fromEntries(
      STRUCTURE_OPTIONS.map((id) => [id, structurePreview(input, id, { locale, coverPhotoId: coverId, light: lights, frame })]),
    ) as Record<StructureOption, StructurePreview>;
  }, [photos, coverId, lights, edition]);

  /** Resume: /studio/new?journey=<slug>&step=2|3 loads the story and its photographs. */
  useEffect(() => {
    const slug = params.get("journey");
    if (!slug) return;
    let cancelled = false;
    api<Journey>(`/journeys/${encodeURIComponent(slug)}`)
      .then((loaded) => {
        if (cancelled) return;
        latest.current = loaded;
        creation.current = Promise.resolve(loaded);
        setJourney(loaded);
        if (!params.get("template")) setEdition(loaded.story_template);
        setStep(stepFromParam(params.get("step"), loaded.photos.length));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setResuming(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A new step: focus the heading (screen readers) and start at the top. */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  async function ensureJourney() {
    if (journey) return journey;
    if (!creation.current) {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      creation.current = api<Journey>(
        "/journeys",
        json("POST", {
          title: placeholderTitle("journey", getLocale()),
          start_date: date,
          end_date: date,
          layout: withForm({ dates_from_photos: true }, "journey"),
          story_template: edition,
          preset: presetFor(edition),
        }),
      );
    }
    try {
      const j = await creation.current;
      latest.current = latest.current ?? j;
      setJourney(j);
      return j;
    } catch (e) {
      creation.current = null;
      throw e;
    }
  }

  /** Travel dates follow the capture dates of the uploaded photographs (until edited by hand). */
  async function saveJourney(next: Journey) {
    const before = journey ? photoDateRange(journey.photos) : null;
    const after = photoDateRange(next.photos);
    latest.current = next;
    setJourney(next);
    if (!after || !shouldAdoptDates(next.layout?.dates_from_photos, before, after)) return;
    const update = (async () => {
      try {
        const saved = await api<Journey>(
          `/journeys/${next.id}`,
          json("PATCH", {
            start_date: after.start,
            end_date: after.end,
            layout: { ...next.layout, dates_from_photos: true },
          }),
        );
        setJourney((current) =>
          current ? { ...current, ...saved, photos: current.photos } : current,
        );
      } catch {
        /* the editor offers the capture dates again */
      }
    })();
    datesSaved.current = datesSaved.current.then(() => update);
  }

  async function continueFrom(from: FlowStep) {
    setError("");
    if (from === 2 && journey && journey.story_template !== edition) {
      setWorking(true);
      try {
        await datesSaved.current;
        const saved = await api<Journey>(
          `/journeys/${journey.id}`,
          json("PATCH", { story_template: edition, preset: presetFor(edition) }),
        );
        setJourney((current) =>
          current ? { ...current, story_template: saved.story_template, preset: saved.preset } : current,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setWorking(false);
        return;
      }
      setWorking(false);
    }
    setStep(nextStep(from));
  }

  /** Sets the form and the edition, then opens the editor, which designs the draft once. */
  async function compose(withWords: boolean) {
    const current = latest.current ?? journey;
    if (!current || working) return;
    setWorking(true);
    setError("");
    setFailedCompose(null);
    setCreating({
      title: isPlaceholderTitleOfAnyForm(current.title) ? "" : current.title,
      photos: current.photos.map((p) => p.url).filter(Boolean),
    });
    const minimum = new Promise<void>((resolve) =>
      window.setTimeout(resolve, storyCreatingPlan(prefersReducedMotion(), edition).totalMs),
    );
    try {
      await datesSaved.current;
      const { form, mode } = structureFor(chosenStructure);
      const range = photoDateRange(current.photos);
      await api<Journey>(
        `/journeys/${current.id}`,
        json("PATCH", {
          layout: withForm({ ...current.layout, dates_from_photos: current.layout?.dates_from_photos ?? true }, form),
          story_template: edition,
          preset: presetFor(edition),
          ...(range && form === "moment" ? { start_date: range.start, end_date: range.start } : {}),
        }),
      );
      // The words wait in sessionStorage until the editor has designed the draft (it reads and removes them).
      try {
        const key = wordsKey(current.slug);
        const compact = withWords ? compactWords(words, chosenStructure, days) : null;
        if (compact) window.sessionStorage.setItem(key, JSON.stringify(compact));
        else window.sessionStorage.removeItem(key);
      } catch {
        /* storage unavailable: the story starts without words */
      }
      await minimum;
      navigate(`/studio/${current.slug}/edit?${editorStartQuery(mode)}`);
    } catch (e) {
      setCreating(null);
      setError(e instanceof Error ? e.message : String(e));
      setFailedCompose(withWords);
      setWorking(false);
    }
  }

  const ready = canContinue(1, { photos: photos.length, uploading: busy });
  const cover = photos[0];
  const landscape = coverCandidate(photos);
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const stations: Record<FlowStep, string> = {
    1: t("Photographs", "Fotos"),
    2: t("Light", "Licht"),
    3: t("Structure", "Aufbau"),
    4: t("Words", "Worte"),
  };
  const editions: Array<{ id: StoryEdition; roof: string; name: string; text: string }> = [
    {
      id: "quiet-atlas",
      roof: t("EDITION I", "EDITION I"),
      name: t("First Light", "Erstes Licht"),
      text: t("Light, with margins. Calm and clear.", "Hell, mit Rändern. Ruhig und klar."),
    },
    {
      id: "after-hours",
      roof: t("EDITION II", "EDITION II"),
      name: t("Last Light", "Letztes Licht"),
      text: t("Dark, edge to edge. Cinematic.", "Dunkel, randlos. Filmisch."),
    },
  ];
  const options: Record<StructureOption, { title: string; text: string }> = {
    days: { title: t("By days", "Nach Tagen"), text: t("A journey, day by day.", "Eine Reise, Tag für Tag.") },
    mood: {
      title: t("By mood", "Nach Stimmung"),
      text: t(
        "From first to last light. WANDER arranges by brightness and colour.",
        "Vom ersten zum letzten Licht. WANDER ordnet nach Helligkeit und Farbe.",
      ),
    },
    moment: {
      title: t("As a moment", "Als Moment"),
      text: t("A few pictures, one instant.", "Wenige Bilder, ein Augenblick."),
    },
  };
  const titles: Record<FlowStep, string> = {
    1: t("Begin with a photograph.", "Am Anfang steht ein Foto."),
    2: t("Which light fits?", "Welches Licht passt?"),
    3: t("How should it be told?", "Wie soll erzählt werden?"),
    4: t("Would you like to write something?", "Möchtest du etwas dazu schreiben?"),
  };
  const storyTitle = isPlaceholderTitleOfAnyForm(journey?.title) ? t("Your story", "Deine Geschichte") : journey!.title;
  const range = photoDateRange(photos);
  const dayLabel = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(getLocale() === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const setDay = (date: string, patch: Partial<{ title: string; text: string }>) =>
    setWords((w) => ({ ...w, days: { ...w.days, [date]: { ...{ title: "", text: "" }, ...w.days[date], ...patch } } }));

  return (
    <main id="main" className="new-journal new-story page-width" data-step={step} data-light={edition}>
      <nav
        className="new-story-film"
        aria-label={t("Progress", "Fortschritt")}
        style={{ "--film-fill": filmFill(step) } as CSSProperties}
      >
        <Link className="new-story-film-studio" to="/studio" aria-label={t("Back to the studio", "Zurück zum Studio")}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="new-story-film-studio-text">{t("Studio", "Studio")}</span>
        </Link>
        <div className="new-story-film-rail">
          <span className="new-story-film-track" aria-hidden="true" />
          <span className="new-story-film-fill" aria-hidden="true" />
          <ol>
          {FLOW_STEPS.map((n) => {
            const state = stationState(n, step);
            const label = (
              <>
                <span className="new-story-film-no">{String(n).padStart(2, "0")}</span>
                <span className="new-story-film-name">{stations[n]}</span>
                <span className="sr-only">
                  {state === "done"
                    ? t(" (done)", " (erledigt)")
                    : state === "active"
                      ? t(` (step ${n} of 4)`, ` (Schritt ${n} von 4)`)
                      : t(" (ahead)", " (folgt)")}
                </span>
              </>
            );
            return (
              <li key={n} className={`is-${state}`} aria-current={state === "active" ? "step" : undefined}>
                {canOpenStation(n, step) ? (
                  <button type="button" disabled={working} onClick={() => setStep(n)}>
                    {label}
                  </button>
                ) : (
                  <span>{label}</span>
                )}
              </li>
            );
          })}
          </ol>
        </div>
      </nav>
      <div className="new-story-heading">
        <h1 ref={heading} tabIndex={-1} key={step}>
          {titles[step]}
        </h1>
        {step === 4 && (
          <p>
            {t(
              "One sentence per day is enough. You can skip this and add it later in the editor.",
              "Ein Satz pro Tag genügt. Du kannst das auch überspringen und später im Editor ergänzen.",
            )}
          </p>
        )}
        {step === 1 && (
          <p>
            {t(
              "Lay out your photographs. You can add more later.",
              "Leg deine Fotos auf den Leuchttisch. Weitere kannst du später ergänzen.",
            )}
          </p>
        )}
      </div>

      {resuming && (
        <p className="inspector-note" role="status">
          {t("Opening your story…", "Deine Geschichte wird geöffnet …")}
        </p>
      )}

      <section className="new-story-panel" hidden={step !== 1}>
        <Upload
          journeyId={journey?.id}
          ensureJourney={ensureJourney}
          removable
          variant="lighttable"
          photos={photos}
          pageDrop={step === 1}
          lead={
            landscape && (
              <figure className="light-table-cover" key={landscape.id}>
                <figcaption>
                  <span className="light-table-kicker">{t("Cover", "Titelbild")}</span>
                  <span className="light-table-title">{storyTitle}</span>
                </figcaption>
                <span className="light-table-cover-print">
                  <img
                    src={landscape.url}
                    srcSet={landscape.srcset || undefined}
                    style={tint(landscape.id)}
                    sizes="(max-width: 760px) 92vw, 1200px"
                    alt=""
                    onLoad={develop}
                  />
                </span>
              </figure>
            )
          }
          onSave={(next) => void saveJourney(next)}
          onBusy={setBusy}
        />
        <div className="new-story-actions">
          <button
            type="button"
            className="button"
            disabled={!ready || working}
            onClick={() => void continueFrom(1)}
          >
            {t("Continue", "Weiter")}
          </button>
        </div>
      </section>

      {step === 2 && (
        <section className="new-story-panel" aria-labelledby="new-story-editions">
          <p id="new-story-editions" className="sr-only">{t("Choose an edition", "Edition wählen")}</p>
          <div className="new-story-editions" role="radiogroup" aria-labelledby="new-story-editions">
            {editions.map((e) => (
              <label key={e.id} className={`new-story-edition ${e.id} ${edition === e.id ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="story-edition"
                  value={e.id}
                  checked={edition === e.id}
                  onChange={() => setEdition(e.id)}
                />
                <span className="new-story-card" aria-hidden="true">
                  {cover && (
                    <img
                      className="new-story-card-image"
                      src={cover.url}
                      srcSet={cover.srcset || undefined}
                      style={tint(cover.id)}
                      sizes="(max-width: 760px) 90vw, 520px"
                      alt=""
                    />
                  )}
                  <span className="new-story-card-type">
                    <span className="new-story-card-kicker">{e.roof}</span>
                    <strong>{e.name}</strong>
                    <span className="new-story-card-sample">
                      {range ? `${dayLabel(range.start)} · ` : ""}
                      {storyTitle}
                    </span>
                    <span className="new-story-card-foot">
                      <span className="new-story-card-traits">
                        {editionTraits(e.id, getLocale() === "de" ? "de" : "en").map((trait) => (
                          <span key={trait}>{trait}</span>
                        ))}
                      </span>
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="new-story-actions">
            <p className="new-story-hint">
            {t(
              "You can change the light at any time later and even mix it module by module in the editor.",
              "Du kannst das Licht später jederzeit wechseln und im Editor auch Modul für Modul mischen.",
            )}
            </p>
            <button type="button" className="new-story-back" onClick={() => setStep(previousStep(2))}>
              <ArrowLeft size={16} aria-hidden="true" />
              {t("Back", "Zurück")}
            </button>
            <button type="button" className="button" disabled={working} onClick={() => void continueFrom(2)}>
              {edition === "after-hours"
                ? t("Continue with Last Light", "Weiter mit Letztes Licht")
                : t("Continue with First Light", "Weiter mit Erstes Licht")}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="new-story-panel">
          <div className="new-form-options" role="radiogroup" aria-label={t("How should it be told?", "Wie soll erzählt werden?")}>
            {STRUCTURE_OPTIONS.map((id) => (
              <label key={id} className={`new-form-option ${chosenStructure === id ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="story-structure"
                  value={id}
                  checked={chosenStructure === id}
                  onChange={() => setStructure(id)}
                />
                <strong>{options[id].title}</strong>
                <span className="new-form-text">{options[id].text}</span>
                <span className={`new-story-preview preview-${id} ${edition}`} aria-hidden="true">
                  {id === "moment" && range && <em className="preview-date">{dayLabel(range.start)}</em>}
                  {previews[id].modules.map((m, i) =>
                    m.kind === "chapter" ? (
                      <em key={i} className="preview-chapter">
                        {m.title || (m.date ? dayLabel(m.date) : "")}
                      </em>
                    ) : (
                      <span
                        key={i}
                        className={`preview-module preview-${m.kind}`}
                        style={{ "--pv-w": m.width } as CSSProperties}
                      >
                        {m.rows.map((n, r) => {
                          const from = m.rows.slice(0, r).reduce((a, b) => a + b, 0);
                          return (
                            <span key={r} className="preview-row">
                              {m.photoIds.slice(from, from + n).map((pid, k) => {
                                const p = photoById.get(pid);
                                const ratio = m.ratios[from + k];
                                const style = { ...tint(pid), "--pv-r": ratio } as CSSProperties;
                                return p ? (
                                  <img key={pid} src={p.url} alt="" loading="lazy" style={style} />
                                ) : (
                                  <i key={pid} style={style} />
                                );
                              })}
                            </span>
                          );
                        })}
                      </span>
                    ),
                  )}
                </span>
                <small className="new-story-preview-more" aria-hidden="true">
                  {previews[id].more > 0 &&
                    (previews[id].more === 1
                      ? t("+ 1 more module", "+ 1 weiteres Modul")
                      : t(`+ ${previews[id].more} more modules`, `+ ${previews[id].more} weitere Module`))}
                </small>
                {needsDaysNote(id, dated) && (
                  <small className="new-story-note">
                    {t(
                      "Your photographs carry no capture dates; the days are guessed.",
                      "Deine Fotos haben keine Aufnahmedaten; die Tage sind geschätzt.",
                    )}
                  </small>
                )}
              </label>
            ))}
          </div>
          {working && (
            <p className="inspector-note" role="status">
              {t("Designing your story…", "Deine Geschichte wird gestaltet …")}
            </p>
          )}
          <div className="new-story-actions">
            <button
              type="button"
              className="new-story-back"
              disabled={working}
              onClick={() => setStep(previousStep(3))}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {t("Back", "Zurück")}
            </button>
            <button type="button" className="button" disabled={working} onClick={() => void continueFrom(3)}>
              {t("Continue", "Weiter")}
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="new-story-panel new-story-words">
          <label className="new-words-field new-words-title">
            <span className="new-words-label">{t("Title of the story", "Titel der Geschichte")}</span>
            <input
              type="text"
              value={words.title}
              maxLength={120}
              placeholder={storyTitle}
              onChange={(e) => setWords((w) => ({ ...w, title: e.target.value }))}
            />
          </label>
          {chosenStructure === "days" && days.length > 0 ? (
            <ol className="new-words-days">
              {days.map((d) => {
                const photo = photos.find((p) => p.id === d.photoId);
                return (
                  <li key={d.date} className="new-words-day">
                    {photo && (
                      <img className="new-words-thumb" src={photo.url} alt="" loading="lazy" width={64} height={80} style={tint(photo.id)} />
                    )}
                    <div className="new-words-day-fields">
                      <span className="new-words-roof">{dayLabel(d.date)}</span>
                      <label className="new-words-field">
                        <span className="sr-only">{t("Heading", "Überschrift")}</span>
                        <input
                          type="text"
                          className="new-words-day-title"
                          value={words.days[d.date]?.title ?? ""}
                          maxLength={120}
                          placeholder={t(`Day ${d.number}`, `Tag ${d.number}`)}
                          aria-label={t("Heading", "Überschrift")}
                          onChange={(e) => setDay(d.date, { title: e.target.value })}
                        />
                      </label>
                      <label className="new-words-field">
                        <span className="sr-only">{t("Text", "Text")}</span>
                        <textarea
                          rows={2}
                          value={words.days[d.date]?.text ?? ""}
                          placeholder={t("What happened on this day?", "Was ist an diesem Tag passiert?")}
                          aria-label={t("What happened on this day?", "Was ist an diesem Tag passiert?")}
                          onChange={(e) => setDay(d.date, { text: e.target.value })}
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <label className="new-words-field">
              <span className="new-words-label">{t("Introduction", "Einleitung")}</span>
              <textarea
                rows={3}
                value={words.intro}
                placeholder={t("One sentence about these pictures.", "Ein Satz zu diesen Bildern.")}
                onChange={(e) => setWords((w) => ({ ...w, intro: e.target.value }))}
              />
            </label>
          )}
          {working && (
            <p className="inspector-note" role="status">
              {t("Designing your story…", "Deine Geschichte wird gestaltet …")}
            </p>
          )}
          <div className="new-story-actions">
            <button type="button" className="new-story-back" disabled={working} onClick={() => setStep(previousStep(4))}>
              <ArrowLeft size={16} aria-hidden="true" />
              {t("Back", "Zurück")}
            </button>
            <button type="button" className="new-story-back new-story-skip" disabled={working} onClick={() => void compose(false)}>
              {t("Skip", "Überspringen")}
            </button>
            <button type="button" className="button" disabled={working} onClick={() => void compose(true)}>
              {t("Compose your story", "Geschichte gestalten")}
            </button>
          </div>
        </section>
      )}

      {creating && <StoryCreating title={creating.title} edition={edition} photos={creating.photos} />}

      {error && (
        <p className="inspector-note new-story-error" role="alert">
          {error}
          {failedCompose !== null && (
            <>
              {" "}
              <button type="button" className="text-link" disabled={working} onClick={() => void compose(failedCompose)}>
                {t("Try again", "Noch einmal versuchen")}
              </button>
            </>
          )}
        </p>
      )}
    </main>
  );
}
