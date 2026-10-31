import { tr, t } from "./I18n";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ImagePlus,
  Plus,
  Star,
  Pencil,
  Trash2,
  LayoutTemplate,
  CalendarDays,
  Images,
  Camera,
} from "lucide-react";
import { api, json, uploadPhoto } from "./api";
import { PageState, useApp } from "./App";
import { Field, Modal, Picture, dateLabel } from "./components";
import { Confirm, PhotoForm, OrderButtons } from "./EditorDialogs";
import { Upload } from "./Upload";
import { MotionControl } from "./MotionControl";
import { imageMotion, journeyReveal } from "./Reveal";
import type { Chapter, Journey, Photo, StoryTemplate } from "./types";

const steps = [
  {
    title: "The photographs",
    short: "Photographs",
    hint: "Begin with what you saw.",
    icon: Camera,
  },
  {
    title: "Find the feeling.",
    short: "The feeling",
    hint: "Choose a rhythm for your photographs.",
    icon: LayoutTemplate,
  },
  {
    title: "Give the days a shape.",
    short: "The days",
    hint: "A few favourites on the surface. A whole day underneath.",
    icon: CalendarDays,
  },
  {
    title: "The final edit.",
    short: "Final edit",
    hint: "A name, a place, and a few words if you like.",
    icon: Images,
  },
];
export function StoryStudio() {
  const { slug } = useParams(),
    navigate = useNavigate(),
    { notify } = useApp();
  const [journey, setJourney] = useState<Journey | null>(null),
    [loading, setLoading] = useState(Boolean(slug)),
    [error, setError] = useState("");
  const [step, setStep] = useState(1),
    [templates, setTemplates] = useState<StoryTemplate[]>([]),
    [draft, setDraft] = useState<Partial<Journey>>({});
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState<{
      name: string;
      current: number;
      total: number;
      percent: number;
    } | null>(null);
  const [photoEdit, setPhotoEdit] = useState<Photo | null>(null),
    [deleting, setDeleting] = useState<{
      kind: "photos" | "chapters";
      id: number;
      title: string;
    } | null>(null);
  const [dayEdit, setDayEdit] = useState<Chapter | "new" | null>(null),
    [pendingRoute, setPendingRoute] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [finished, setFinished] = useState(false);
  const dirty = Object.keys(draft).length > 0;
  useEffect(() => {
    if (!loading) window.scrollTo({ top: 0, behavior: "instant" });
  }, [loading]);
  useEffect(() => {
    api<StoryTemplate[]>("/templates")
      .then(setTemplates)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let alive = true;
    setJourney(null);
    setDraft({});
    setError("");
    setStep(1);
    setLoading(Boolean(slug));
    if (slug)
      api<Journey>(`/journeys/${slug}`)
        .then((value) => {
          if (alive) {
            setJourney(value);
            setStep(value.published ? 4 : value.studio_step || 1);
            setFinished(
              value.studio_step === 4 && value.title !== tr("Untitled journey"),
            );
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    return () => {
      alive = false;
    };
  }, [slug]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        link.target === "_blank" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const url = new URL(link.href);
      if (
        url.origin === location.origin &&
        url.pathname !== location.pathname
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) setPendingRoute(url.pathname + url.search + url.hash);
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty, busy]);
  const current = journey ? { ...journey, ...draft } : null;
  const photos = journey?.photos || [],
    days = journey?.chapters.filter((day) => day.kind === "chapter") || [];
  const selectedFilm = current?.filmstrip_ids || [];
  const requestedTemplate =
    new URLSearchParams(location.search).get("template") === "after-hours"
      ? "after-hours"
      : "quiet-atlas";
  const invalidFilm = selectedFilm.length > 0 && selectedFilm.length < 6;
  const [filmEnabled, setFilmEnabled] = useState(false);
  useEffect(() => {
    setFilmEnabled(Boolean(journey?.filmstrip_ids?.length));
  }, [journey?.id, journey?.filmstrip_ids?.length]);
  const filmInvalid = filmEnabled && selectedFilm.length < 6;
  function change(value: Partial<Journey>) {
    setFinished(false);
    setDraft((previous) => ({ ...previous, ...value }));
  }
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, options: RequestInit) {
    return perform(async () => {
      setJourney(await api<Journey>(path, options));
    });
  }
  async function save(nextStep = step, finish = false) {
    if (!journey || invalidFilm || filmInvalid) {
      setError(
        tr("Choose at least 6 photographs for the filmstrip, or turn it off."),
      );
      return false;
    }
    return perform(async () => {
      const data = {
        ...draft,
        studio_step: Math.max(nextStep, journey.studio_step || 1),
      };
      const updated = await api<Journey>(
        `/journeys/${journey.id}`,
        json("PATCH", data),
      );
      setJourney(updated);
      setDraft({});
      setStep(nextStep);
      if (!slug) navigate(`/studio/${updated.slug}`, { replace: true });
      if (finish) {
        setFinished(true);
        notify(
          updated.published
            ? tr("Your journey is published.")
            : tr("Your private draft is saved."),
        );
      } else
        requestAnimationFrame(() => {
          document
            .querySelector(".studio-process")
            ?.scrollIntoView({ block: "start", behavior: "instant" });
          heading.current?.focus({ preventScroll: true });
        });
    });
  }
  async function upload(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length || busy) return;
    setBusy(true);
    setError("");
    let working = journey;
    try {
      if (!working) {
        const today = new Date().toLocaleDateString("en-CA");
        working = await api<Journey>(
          "/journeys",
          json("POST", {
            title: tr("Untitled journey"),
            start_date: today,
            end_date: today,
            story_template: requestedTemplate,
            preset: requestedTemplate === "after-hours" ? "cinematic" : "quiet",
          }),
        );
        setJourney(working);
      }
      for (let index = 0; index < selected.length; index++) {
        const file = selected[index];
        setUploading({
          name: file.name,
          current: index + 1,
          total: selected.length,
          percent: 0,
        });
        working = await uploadPhoto<Journey>(
          `/journeys/${working.id}/photos`,
          file,
          null,
          (percent) =>
            setUploading({
              name: file.name,
              current: index + 1,
              total: selected.length,
              percent,
            }),
        );
        setJourney(working);
      }
      notify(
        t(
          `${selected.length} photographs added.`,
          `${selected.length} Fotos hinzugefügt.`,
        ),
      );
      if (!slug) navigate(`/studio/${working.slug}`, { replace: true });
    } catch (e) {
      setError(
        `${(e as Error).message} Photographs already uploaded are saved; you can continue with them or add the remaining files.`,
      );
    } finally {
      setUploading(null);
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function reorderDay(id: number, direction: number) {
    if (!journey) return;
    const ordered = [...journey.chapters],
      index = ordered.findIndex((day) => day.id === id);
    const next = index + direction;
    if (next < 0 || next >= ordered.length) return;
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    await mutate(
      `/journeys/${journey.id}/chapters/order`,
      json("PUT", { ids: ordered.map((day) => day.id) }),
    );
  }
  if (loading) return <PageState title={tr("Opening your workspace…")} />;
  if (slug && !journey)
    return (
      <PageState title={tr("This journey is out of reach.")} text={error} />
    );
  const availableStep = photos.length
    ? Math.max(step, journey?.studio_step || 1, journey?.published ? 4 : 2)
    : 1;
  const remaining = photos.filter((photo) => photo.chapter_id === null);
  const chosenTemplate = templates.find(
    (template) => template.id === (current?.story_template || "quiet-atlas"),
  );
  return (
    <main id="main" className="guided-studio page-width">
      <div className="studio-breadcrumb">
        <Link to="/studio">
          <ArrowLeft size={15} />
          {tr("Your journeys")}
        </Link>
        <span>{journey?.title || "A new journey"}</span>
        <div>
          {journey && (
            <Link to={`/journeys/${journey.slug}`} target="_blank">
              {tr("Preview")}
              <ArrowUpRight size={15} />
            </Link>
          )}
          {journey && (
            <Link to={`/studio/${journey.slug}/edit`}>
              {tr("Freeform editor")}
            </Link>
          )}
        </div>
      </div>
      <div className="studio-process">
        <div className="process-title">
          <span className="eyebrow">{tr("THE STORY STUDIO")}</span>
          <span>
            {step === 4
              ? finished && !dirty
                ? "YOUR STORY IS SAVED"
                : "READY FOR YOUR FINAL EDIT"
              : t(`STEP ${step} OF 4`, `SCHRITT ${step} VON 4`)}
          </span>
        </div>
        <ol aria-label={tr("Story creation progress")}>
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={tr(item.short)}
                className={
                  step === index + 1
                    ? "current"
                    : index + 1 < step
                      ? "complete"
                      : ""
                }
              >
                <button
                  aria-current={step === index + 1 ? "step" : undefined}
                  disabled={busy || index + 1 > availableStep}
                  onClick={() => {
                    if (index + 1 !== step) void save(index + 1);
                  }}
                >
                  <span className="step-circle">
                    {index + 1 < step ? (
                      <Check size={16} />
                    ) : (
                      <Icon size={18} />
                    )}
                  </span>
                  <span>
                    <small>0{index + 1}</small>
                    {tr(item.short)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div
          className="process-progress"
          role="progressbar"
          aria-label={tr("Story progress")}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={step === 4 && finished && !dirty ? 4 : step - 1}
        >
          <span
            style={{
              width: `${((step === 4 && finished && !dirty ? 4 : step - 1) / 4) * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="step-heading">
        <div>
          <span className="eyebrow">
            0{step} {tr("/ MAKE IT YOURS")}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {tr(steps[step - 1].title)}
          </h1>
          <p>{tr(steps[step - 1].hint)}</p>
        </div>
        <span className="studio-saved">
          <i className={dirty ? "unsaved-dot" : "saved-dot"} />
          {busy
            ? "Saving your moments…"
            : dirty
              ? tr("Changes ready to save")
              : journey
                ? tr("Your progress is saved")
                : tr("A private draft, from the first image")}
        </span>
      </div>
      {error && (
        <p role="alert" className="form-error studio-error">
          {error}
        </p>
      )}
      <input
        ref={fileInput}
        hidden
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-label={tr("Choose photographs")}
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files);
        }}
        disabled={busy}
      />
      {step === 1 && (
        <section className="photo-step">
          <div
            className={`upload-stage ${photos.length ? "has-photos" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!busy) void upload(event.dataTransfer.files);
            }}
          >
            <div className="upload-illustration">
              <ImagePlus size={34} strokeWidth={1} />
            </div>
            <div>
              <h2>
                {photos.length
                  ? "There is room for more."
                  : tr("Every story starts with a photograph.")}
              </h2>
              <p>
                {tr("Drop your images here, or choose them from your library.")}
              </p>
              <small>
                {tr(
                  "JPEG, PNG & WebP · up to 128 MB each · automatically prepared for every screen",
                )}
              </small>
            </div>
            <button
              className="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Plus size={18} />
              {photos.length ? tr("Add photographs") : tr("Choose photographs")}
            </button>
          </div>
          {uploading && (
            <div className="upload-status" role="status">
              <span>
                {tr("Photograph")}
                {uploading.current} {t("of", "von")} {uploading.total} ·{" "}
                {uploading.name}
              </span>
              <strong>
                {uploading.percent === 100
                  ? tr("Preparing display sizes…")
                  : `${uploading.percent}%`}
              </strong>
              <progress
                max={100}
                value={
                  uploading.percent === 100 ? undefined : uploading.percent
                }
                aria-label={tr("Photograph upload progress")}
              />
            </div>
          )}
          {photos.length > 0 && (
            <>
              <div className="studio-section-title">
                <h2>
                  {tr("Your photographs")}
                  <span>{photos.length}</span>
                </h2>
                <p>
                  {tr(
                    "Choose a cover. Add captions only where they bring something back.",
                  )}
                </p>
              </div>
              <div className="studio-photo-grid">
                {photos.map((photo, index) => (
                  <article className="studio-photo-card" key={photo.id}>
                    <button
                      className="studio-photo-open"
                      onClick={() => setPhotoEdit(photo)}
                      disabled={busy}
                      aria-label={t(
                        `Edit photograph ${index + 1}: ${photo.title}`,
                        `Foto ${index + 1} bearbeiten: ${photo.title}`,
                      )}
                    >
                      <Picture
                        photo={photo}
                        sizes="(max-width: 760px) 45vw, 25vw"
                      />
                      <span>
                        <Pencil size={16} />
                        {tr("Caption & details")}
                      </span>
                    </button>
                    <div className="studio-photo-caption">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{photo.title}</p>
                    </div>
                    <div className="studio-photo-actions">
                      <button
                        className={
                          current?.cover_id === photo.id ? "is-cover" : ""
                        }
                        disabled={busy}
                        onClick={() => {
                          void mutate(
                            `/journeys/${journey!.id}`,
                            json("PATCH", { cover_id: photo.id }),
                          );
                        }}
                        aria-pressed={current?.cover_id === photo.id}
                      >
                        {current?.cover_id === photo.id ? (
                          <Check size={14} />
                        ) : (
                          <Star size={14} />
                        )}{" "}
                        {current?.cover_id === photo.id
                          ? "Cover photograph"
                          : tr("Make cover")}
                      </button>
                      <button
                        className="icon-button danger"
                        disabled={busy}
                        aria-label={t(
                          `Remove photograph ${index + 1}`,
                          `Foto ${index + 1} entfernen`,
                        )}
                        onClick={() =>
                          setDeleting({
                            kind: "photos",
                            id: photo.id,
                            title: photo.title,
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          <div className="studio-tip">
            <span>{tr("THE EDITOR’S NOTE")}</span>
            <p>
              {tr(
                "Start with everything you love. You can find the favourites and arrange the days in a moment. Full-resolution uploads are kept alongside smaller display copies.",
              )}
            </p>
          </div>
        </section>
      )}
      {step === 2 && current && (
        <section className="feeling-step">
          <div className="template-choices">
            {templates.map((template, index) => (
              <article
                key={template.id}
                className={`template-choice ${current.story_template === template.id ? "selected" : ""} edition-${template.id}`}
              >
                <button
                  className="template-select"
                  disabled={busy}
                  onClick={() =>
                    change({
                      story_template: template.id,
                      preset: template.preset,
                    })
                  }
                  aria-pressed={current.story_template === template.id}
                >
                  <div className="template-thumbnail">
                    <img
                      src={current.cover?.url || "/images/forest-1280.webp"}
                      alt=""
                    />
                    <div>
                      <small>EDITION 0{index + 1}</small>
                      <strong>{template.name}</strong>
                      <em>{tr(template.kicker)}</em>
                    </div>
                    <span className="template-check">
                      {current.story_template === template.id ? (
                        <Check size={18} />
                      ) : (
                        <Plus size={18} />
                      )}
                    </span>
                  </div>
                  <div className="template-description">
                    <h2>{template.name}</h2>
                    <p>{tr(template.description)}</p>
                  </div>
                </button>
                <a
                  className="text-link"
                  href={`/inspiration/${template.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tr("Read the example story")}
                  <ArrowUpRight size={17} />
                </a>
              </article>
            ))}
          </div>
          <div className="filmstrip-option">
            <div>
              <span className="eyebrow">{tr("AN OPTIONAL LITTLE EXTRA")}</span>
              <h2>{tr("Let the moments move.")}</h2>
              <p>
                {tr(
                  "A continuous filmstrip, drifting from right to left. Smaller frames, a little cinematic rhythm. Select at least six photographs to make the loop flow.",
                )}
              </p>
            </div>
            <label className="large-toggle">
              <input
                type="checkbox"
                checked={filmEnabled}
                disabled={busy || photos.length < 6}
                onChange={(e) => {
                  setFilmEnabled(e.target.checked);
                  change({
                    filmstrip_ids: e.target.checked
                      ? photos
                          .slice(0, Math.min(8, photos.length))
                          .map((photo) => photo.id)
                      : [],
                  });
                }}
              />
              <span>
                {tr("Include a moving filmstrip")}
                <small>
                  {photos.length < 6
                    ? `Add ${6 - photos.length} more photograph${6 - photos.length === 1 ? "" : "s"} to unlock`
                    : tr("Optional · readers can pause it at any time")}
                </small>
              </span>
            </label>
          </div>
          {filmEnabled && (
            <div className="film-selection">
              <div className="selection-summary" aria-live="polite">
                <strong>
                  {selectedFilm.length} {tr("selected")}
                </strong>
                <span>
                  {selectedFilm.length < 6
                    ? `${6 - selectedFilm.length} more needed for a continuous filmstrip`
                    : tr("A flowing sequence is ready")}
                </span>
              </div>
              <div className="film-photo-picker">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    aria-label={t(
                      `Filmstrip photograph ${index + 1}`,
                      `Foto ${index + 1} im Fotostreifen`,
                    )}
                    aria-pressed={selectedFilm.includes(photo.id)}
                    className={
                      selectedFilm.includes(photo.id) ? "selected" : ""
                    }
                    disabled={
                      busy ||
                      (!selectedFilm.includes(photo.id) &&
                        selectedFilm.length >= 100)
                    }
                    onClick={() =>
                      change({
                        filmstrip_ids: selectedFilm.includes(photo.id)
                          ? selectedFilm.filter((id) => id !== photo.id)
                          : [...selectedFilm, photo.id],
                      })
                    }
                  >
                    <Picture photo={photo} sizes="200px" />
                    <span>
                      {selectedFilm.includes(photo.id) ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="studio-tip">
            <span>{tr("YOUR STORY, YOUR WORDS")}</span>
            <p>
              {tr(
                "The examples are original fictional essays to guide the pacing. Choosing a template changes the presentation; it does not replace your writing or your photographs.",
              )}
            </p>
          </div>
        </section>
      )}
      {step === 3 && journey && (
        <section className="days-step">
          <div className="day-building-intro">
            <div>
              <span className="eyebrow">
                {tr("A GALLERY INSIDE A GALLERY")}
              </span>
              <h2>
                {tr("A day, at a glance.")}
                <br />
                <em>{tr("A whole world inside.")}</em>
              </h2>
              <p>
                {tr(
                  "Group your photographs into days or little chapters. Star the favourites that appear in the story. Open a day to discover the rest.",
                )}
              </p>
            </div>
            <button
              className="button"
              disabled={busy || !photos.length}
              onClick={() => setDayEdit("new")}
            >
              <Plus size={18} />
              {tr("Create a day")}
            </button>
          </div>
          {!days.length && (
            <button
              className="first-day"
              disabled={busy || !photos.length}
              onClick={() => setDayEdit("new")}
            >
              <div className="first-day-photos">
                {photos.slice(0, 3).map((photo) => (
                  <img key={photo.id} src={photo.url} alt="" />
                ))}
              </div>
              <span>
                <Plus size={22} />
                {tr("Give these photographs their first day")}
              </span>
            </button>
          )}
          <div className="studio-days">
            {days.map((day, index) => {
              const dayPhotos = photos.filter(
                  (photo) => photo.chapter_id === day.id,
                ),
                moduleIndex = journey.chapters.findIndex(
                  (item) => item.id === day.id,
                );
              return (
                <article className="studio-day" key={day.id}>
                  <div className="studio-day-heading">
                    <div>
                      <span className="eyebrow">
                        {tr("DAY")}
                        {String(index + 1).padStart(2, "0")}{" "}
                        {day.date ? ` / ${dateLabel(day.date)}` : ""}
                      </span>
                      <h3>{day.title}</h3>
                      <p>
                        {dayPhotos.length} {tr("photographs ·")}{" "}
                        {dayPhotos.filter((photo) => photo.featured).length ||
                          (dayPhotos.length ? "First image as" : 0)}{" "}
                        {tr("favourite")}
                        {dayPhotos.filter((photo) => photo.featured).length ===
                        1
                          ? ""
                          : "s"}{" "}
                        ·{" "}
                        {day.gallery_mode === "horizontal"
                          ? tr("Sideways gallery")
                          : tr("Editorial gallery")}
                      </p>
                    </div>
                    <div className="studio-day-controls">
                      <OrderButtons
                        index={moduleIndex}
                        length={journey.chapters.length}
                        disabled={busy}
                        move={(direction) => {
                          void reorderDay(day.id, direction);
                        }}
                      />
                      <button
                        className="button button-outline"
                        disabled={busy}
                        onClick={() => setDayEdit(day)}
                      >
                        <Pencil size={15} />
                        {tr("Edit day")}
                      </button>
                      <button
                        className="icon-button danger"
                        disabled={busy}
                        aria-label={t(
                          `Remove day ${day.title}`,
                          `Tag ${day.title} entfernen`,
                        )}
                        onClick={() =>
                          setDeleting({
                            kind: "chapters",
                            id: day.id,
                            title: day.title,
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="day-contact-sheet">
                    {dayPhotos.map((photo, photoIndex) => (
                      <div className="day-contact-photo" key={photo.id}>
                        <Picture photo={photo} sizes="280px" />
                        <button
                          className={photo.featured ? "favorite-selected" : ""}
                          aria-pressed={photo.featured}
                          aria-label={`${photo.featured ? tr("Unstar") : tr("Star")} day ${index + 1} photograph ${photoIndex + 1}`}
                          disabled={busy}
                          onClick={() => {
                            void mutate(
                              `/photos/${photo.id}`,
                              json("PATCH", { featured: !photo.featured }),
                            );
                          }}
                        >
                          <Star
                            size={17}
                            fill={photo.featured ? "currentColor" : "none"}
                          />
                          {photo.featured ? tr("Favourite") : "Show in story"}
                        </button>
                      </div>
                    ))}
                    <button
                      className="add-day-photos"
                      disabled={busy}
                      onClick={() => setDayEdit(day)}
                    >
                      <Plus size={24} />
                      <span>
                        {dayPhotos.length
                          ? "Add or arrange"
                          : tr("Choose photographs")}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {remaining.length > 0 && (
            <div className="unplaced-note">
              <div className="unplaced-thumbs">
                {remaining.slice(0, 4).map((photo) => (
                  <img key={photo.id} src={photo.url} alt="" />
                ))}
              </div>
              <div>
                <strong>
                  {remaining.length}
                  {tr("photograph")}
                  {remaining.length === 1 ? "" : "s"}
                  {tr("still between days.")}
                </strong>
                <p>
                  {tr(
                    "Place them in a day, or leave them in the story’s opening gallery.",
                  )}
                </p>
              </div>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => setDayEdit("new")}
              >
                {tr("Create another day")}
                <Plus size={16} />
              </button>
            </div>
          )}
          {journey.chapters.some((day) => day.kind !== "chapter") && (
            <p className="reference-note">
              {tr(
                "Your existing text, quote and gallery modules are preserved.",
              )}{" "}
              <Link to={`/studio/${journey.slug}/edit`} className="text-link">
                {tr("Arrange all modules in the freeform editor ↗")}
              </Link>
            </p>
          )}
          <div className="studio-tip">
            <span>{tr("A LITTLE CURATION GOES A LONG WAY")}</span>
            <p>
              {tr(
                "One or two favourites make a beautiful opening to each day. The rest are only a click away. A sideways gallery is lovely for a sequence; an editorial gallery gives each frame its own space.",
              )}
            </p>
          </div>
        </section>
      )}
      {step === 4 && current && (
        <section className="final-step">
          <div className="final-fields">
            <span className="eyebrow">{tr("JUST ENOUGH WORDS")}</span>
            <Field label={tr("Story title")}>
              <input
                maxLength={160}
                value={current.title}
                onChange={(e) => change({ title: e.target.value })}
                placeholder="A place worth remembering"
              />
            </Field>
            <Field
              label="A line underneath"
              hint="Optional. A feeling, a small observation, a reason to remember."
            >
              <input
                maxLength={300}
                value={current.subtitle}
                onChange={(e) => change({ subtitle: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Place">
                <input
                  maxLength={160}
                  value={current.location}
                  onChange={(e) => change({ location: e.target.value })}
                  placeholder={tr("Where did you wander?")}
                />
              </Field>
              <Field label={tr("Country")}>
                <input
                  maxLength={80}
                  value={current.country}
                  onChange={(e) => change({ country: e.target.value })}
                />
              </Field>
              <Field label={tr("First day")}>
                <input
                  type="date"
                  value={current.start_date}
                  onChange={(e) => change({ start_date: e.target.value })}
                />
              </Field>
              <Field label={tr("Last day")}>
                <input
                  type="date"
                  min={current.start_date}
                  value={current.end_date}
                  onChange={(e) => change({ end_date: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label={tr("A short opening note")}
              hint={tr(
                "Optional. Two or three sentences are enough. Let the photographs tell most of the story.",
              )}
            >
              <textarea
                rows={4}
                maxLength={20000}
                value={current.introduction}
                onChange={(e) => change({ introduction: e.target.value })}
                placeholder={
                  chosenTemplate?.prompts[0] || tr("What brought you here?")
                }
              />
            </Field>
            <details className="studio-details">
              <summary>{tr("A closing thought & archive description")}</summary>
              <Field label={tr("What stays with you")}>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={current.reflection}
                  onChange={(e) => change({ reflection: e.target.value })}
                />
              </Field>
              <Field label={tr("A final line")}>
                <textarea
                  rows={2}
                  maxLength={5000}
                  value={current.closing}
                  onChange={(e) => change({ closing: e.target.value })}
                />
              </Field>
              <Field label={tr("Description in the archive")}>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={current.description}
                  onChange={(e) => change({ description: e.target.value })}
                />
              </Field>
            </details>
            <details className="studio-details">
              <summary>{tr("The way words & photographs appear")}</summary>
              <p className="studio-motion-hint">
                {tr(
                  "Motion follows your scroll in both directions, with a quiet pause in the middle. Softness controls the easing. Reduced-motion preferences are respected.",
                )}
              </p>
              <MotionControl
                label={tr("Story text")}
                value={current.reveal_settings?.default}
                inherit={false}
                onChange={(value) =>
                  change({
                    reveal_settings: {
                      ...current.reveal_settings,
                      default: value,
                    },
                  })
                }
              />
              <MotionControl
                label={tr("Story title")}
                value={current.reveal_settings?.title}
                fallback={journeyReveal(current.reveal_settings)}
                text={current.title}
                onChange={(value) =>
                  change({
                    reveal_settings: {
                      ...current.reveal_settings,
                      title: value,
                    },
                  })
                }
              />
              <MotionControl
                label={tr("Opening note")}
                value={current.reveal_settings?.introduction}
                fallback={journeyReveal(current.reveal_settings)}
                text={current.introduction}
                onChange={(value) =>
                  change({
                    reveal_settings: {
                      ...current.reveal_settings,
                      introduction: value,
                    },
                  })
                }
              />
              <MotionControl
                label={tr("Photographs")}
                value={current.reveal_settings?.images}
                fallback={imageMotion}
                inherit={false}
                onChange={(value) =>
                  change({
                    reveal_settings: {
                      ...current.reveal_settings,
                      images: value,
                    },
                  })
                }
              />
            </details>
          </div>
          <aside className="final-preview">
            <div
              className={`story-cover-preview edition-${current.story_template}`}
            >
              <Picture photo={current.cover} sizes="600px" />
              <div>
                <span className="eyebrow">
                  {current.location || "YOUR PHOTO ESSAY"}
                </span>
                <h2>{current.title}</h2>
                <p>{current.subtitle}</p>
              </div>
            </div>
            <div className="final-checks">
              <span className="eyebrow">{tr("THE EDIT AT A GLANCE")}</span>
              <p>
                <Check size={15} />
                {photos.length}
                {tr("photographs, one story")}
              </p>
              <p>
                <Check size={15} />
                {chosenTemplate?.name || "Quiet Atlas"}
                {tr("edition")}
              </p>
              <p>
                <Check size={15} />
                {days.length
                  ? t(
                      `${days.length} day galleries`,
                      `${days.length} Tagesgalerien`,
                    )
                  : tr("An open photographic sequence")}
              </p>
              {selectedFilm.length >= 6 && (
                <p>
                  <Check size={15} />A {selectedFilm.length}
                  {tr("-frame moving filmstrip")}
                </p>
              )}
              <label className="large-toggle">
                <input
                  type="checkbox"
                  checked={current.published}
                  onChange={(e) => change({ published: e.target.checked })}
                  disabled={busy}
                />
                <span>
                  {tr("Publish this journey")}
                  <small>
                    {current.published
                      ? tr("Visible in your journal after saving")
                      : tr("Keep it private until you are ready")}
                  </small>
                </span>
              </label>
              <button
                className="button"
                disabled={busy || !current.title.trim() || !photos.length}
                onClick={() => {
                  void save(4, true);
                }}
              >
                {busy
                  ? tr("Saving…")
                  : current.published
                    ? tr("Save & publish")
                    : tr("Save private draft")}
                <Check size={17} />
              </button>
              <a
                className="text-link"
                href={`/journeys/${current.slug}`}
                target="_blank"
                onClick={async (e) => {
                  if (dirty) {
                    e.preventDefault();
                    const preview = window.open("about:blank", "_blank");
                    if (preview) preview.opener = null;
                    if (await save(4)) {
                      if (preview)
                        preview.location.replace(`/journeys/${current.slug}`);
                      else navigate(`/journeys/${current.slug}`);
                    } else preview?.close();
                  }
                }}
              >
                {tr("View the story")}
                <ArrowUpRight size={17} />
              </a>
            </div>
          </aside>
        </section>
      )}
      <div className="studio-step-footer">
        <div>
          <span className="eyebrow">
            {step === 4
              ? "THE NEXT CHAPTER IS YOURS."
              : `${photos.length} PHOTOGRAPHS / A STORY TAKING SHAPE`}
          </span>
          <p>
            {step === 1
              ? tr("Images first. The rest will follow.")
              : step === 2
                ? tr("You can change the edition at any time.")
                : step === 3
                  ? tr("Days are optional. The photographs always come first.")
                  : "Your progress stays with you."}
          </p>
        </div>
        <div>
          {step > 1 && (
            <button
              className="text-link"
              disabled={busy || filmInvalid}
              onClick={() => {
                void save(step - 1);
              }}
            >
              <ArrowLeft size={16} />
              {tr("Back")}
            </button>
          )}
          {step < 4 && (
            <button
              className="button"
              disabled={busy || !photos.length || filmInvalid}
              onClick={() => {
                void save(step + 1);
              }}
            >
              {step === 1
                ? "Find the feeling"
                : step === 2
                  ? tr("Arrange the days")
                  : "The final edit"}
              <ArrowRight size={17} />
            </button>
          )}
        </div>
      </div>
      {photoEdit && journey && (
        <PhotoForm
          photo={photoEdit}
          journey={journey}
          onClose={() => setPhotoEdit(null)}
          onSave={(value) => {
            setJourney(value);
            setPhotoEdit(null);
            notify(tr("Photograph saved."));
          }}
        />
      )}
      {dayEdit && journey && (
        <DayEditor
          day={dayEdit === "new" ? undefined : dayEdit}
          journey={journey}
          prompt={
            chosenTemplate?.prompts[days.length % 3] ||
            "Which moment brings the day back?"
          }
          onClose={() => setDayEdit(null)}
          onSave={(value) => {
            setJourney(value);
            setDayEdit(null);
            notify(tr("Your day is saved."));
          }}
        />
      )}
      {deleting && journey && (
        <Confirm
          title={t(`Remove ${deleting.title}?`, `${deleting.title} entfernen?`)}
          description={
            deleting.kind === "photos"
              ? "This permanently removes this photograph. If fewer than six filmstrip images remain, the filmstrip is turned off."
              : tr(
                  "Your photographs are kept in the library. This removes the day and its notes.",
                )
          }
          onClose={() => setDeleting(null)}
          action={async () => {
            const value = await api<Journey>(
              `/${deleting.kind}/${deleting.id}`,
              { method: "DELETE" },
            );
            setJourney(value);
            if (deleting.kind === "photos" && draft.filmstrip_ids) {
              const ids = draft.filmstrip_ids.filter(
                (id) => id !== deleting.id,
              );
              change({ filmstrip_ids: ids.length >= 6 ? ids : [] });
            }
            setDeleting(null);
          }}
        />
      )}
      {pendingRoute && (
        <Modal
          title={tr("Keep your changes?")}
          onClose={() => setPendingRoute("")}
        >
          <h2>{tr("A moment before you go.")}</h2>
          <p>{tr("Your latest changes have not been saved.")}</p>
          <div className="confirm-actions">
            <button
              className="button button-outline"
              onClick={() => {
                setDraft({});
                navigate(pendingRoute);
              }}
            >
              {tr("Leave without saving")}
            </button>
            <button
              className="button"
              onClick={async () => {
                const target = pendingRoute;
                if (await save()) navigate(target);
              }}
            >
              {tr("Save & continue")}
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
function DayEditor({
  day,
  journey,
  prompt,
  onClose,
  onSave,
}: {
  day?: Chapter;
  journey: Journey;
  prompt: string;
  onClose: () => void;
  onSave: (journey: Journey) => void;
}) {
  const [localJourney, setLocalJourney] = useState(journey);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [title, setTitle] = useState(day?.title || ""),
    [date, setDate] = useState(day?.date || journey.start_date),
    [story, setStory] = useState(day?.story || ""),
    [mode, setMode] = useState(day?.gallery_mode || "editorial");
  const [selected, setSelected] = useState<number[]>(
      day
        ? localJourney.photos
            .filter((photo) => photo.chapter_id === day.id)
            .map((photo) => photo.id)
        : [],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ordered = [...localJourney.photos].sort(
    (a, b) =>
      Number(a.chapter_id !== (day?.id ?? null)) -
      Number(b.chapter_id !== (day?.id ?? null)),
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSave(
        await api<Journey>(
          day ? `/chapters/${day.id}` : `/journeys/${journey.id}/chapters`,
          json(day ? "PATCH" : "POST", {
            title,
            date,
            story,
            kind: "chapter",
            gallery_mode: mode,
            photo_ids: selected,
          }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={day ? tr("Edit day") : tr("Create a day")}
      className="day-editor"
      onClose={() => {
        if (!busy && !uploadBusy) {
          onSave(localJourney);
          onClose();
        }
      }}
    >
      <span className="eyebrow">{tr("A SMALL CHAPTER OF YOUR OWN")}</span>
      <h2>{day ? tr("Shape this day.") : tr("What kind of day was it?")}</h2>
      <form onSubmit={submit}>
        <div className="day-editor-fields">
          <Field label={tr("Day title")}>
            <input
              autoFocus
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr("The long way around")}
            />
          </Field>
          <Field label={tr("Date")}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Upload
          journeyId={journey.id}
          chapterId={day?.id || null}
          onBusy={setUploadBusy}
          onSave={(next) => {
            const added = next.photos.filter(
              (p) => !localJourney.photos.some((old) => old.id === p.id),
            );
            setLocalJourney(next);
            setSelected((ids) => [
              ...new Set([...ids, ...added.map((p) => p.id)]),
            ]);
          }}
        />
        <div className="day-editor-selection">
          <div>
            <h3>{tr("Choose the photographs")}</h3>
            <span aria-live="polite">
              {selected.length} {tr("selected")}
            </span>
          </div>
          <p>
            {tr(
              "Unassigned images come first. Selecting an image from another day moves it here.",
            )}
          </p>
          <div className="day-photo-picker">
            {ordered.map((photo, index) => {
              const owner = journey.chapters.find(
                (chapter) => chapter.id === photo.chapter_id,
              );
              return (
                <button
                  type="button"
                  key={photo.id}
                  className={selected.includes(photo.id) ? "selected" : ""}
                  aria-label={t(
                    `Choose day photograph ${index + 1}: ${photo.title}`,
                    `Tagesfoto ${index + 1} auswählen: ${photo.title}`,
                  )}
                  aria-pressed={selected.includes(photo.id)}
                  disabled={busy}
                  onClick={() =>
                    setSelected((ids) =>
                      ids.includes(photo.id)
                        ? ids.filter((id) => id !== photo.id)
                        : [...ids, photo.id],
                    )
                  }
                >
                  <Picture photo={photo} sizes="240px" />
                  <span>
                    {selected.includes(photo.id) ? (
                      <Check size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                  </span>
                  <small>{owner ? owner.title : tr("Not in a day yet")}</small>
                </button>
              );
            })}
          </div>
        </div>
        <fieldset className="day-layout-choice">
          <legend>{tr("When someone opens this day")}</legend>
          <label className={mode === "editorial" ? "selected" : ""}>
            <input
              type="radio"
              name="gallery-mode"
              checked={mode === "editorial"}
              onChange={() => setMode("editorial")}
            />
            <span>
              {tr("Editorial gallery")}
              <small>{tr("Generous frames, scrolling down.")}</small>
            </span>
          </label>
          <label className={mode === "horizontal" ? "selected" : ""}>
            <input
              type="radio"
              name="gallery-mode"
              checked={mode === "horizontal"}
              onChange={() => setMode("horizontal")}
            />
            <span>
              {tr("Sideways gallery")}
              <small>{tr("Glide through with a trackpad or arrows.")}</small>
            </span>
          </label>
        </fieldset>
        <details className="studio-details">
          <summary>{tr("A few words for the day (optional)")}</summary>
          <Field label={tr("A short field note")}>
            <textarea
              maxLength={20000}
              rows={3}
              value={story}
              placeholder={tr(prompt)}
              onChange={(e) => setStory(e.target.value)}
            />
          </Field>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button"
          disabled={busy || uploadBusy || !selected.length}
        >
          {busy
            ? tr("Saving…")
            : day
              ? tr("Save this day")
              : tr("Create this day")}
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
