import { tr } from "./I18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ImagePlus,
  Images,
  Plus,
  Star,
  Trash2,
  Pencil,
  Type,
  Quote,
  BookOpen,
} from "lucide-react";
import { api, json, uploadPhoto } from "./api";
import { PageState, useApp } from "./App";
import { Field, Modal, Picture, dateRange } from "./components";
import { Confirm, PhotoForm, OrderButtons } from "./EditorDialogs";
import { MotionControl } from "./MotionControl";
import { imageMotion, journeyReveal } from "./Reveal";
import type {
  Journey,
  Chapter,
  Photo,
  RevealConfig,
  RevealSettings,
} from "./types";

type Kind = Chapter["kind"];
const kinds: { kind: Kind; label: string; icon: ReactNode; hint: string }[] = [
  {
    kind: "chapter",
    label: tr("Chapter"),
    icon: <BookOpen size={15} />,
    hint: tr("A day or a place, with words and photographs."),
  },
  {
    kind: "text",
    label: tr("Text"),
    icon: <Type size={15} />,
    hint: tr("A quiet passage, exactly where it belongs."),
  },
  {
    kind: "quote",
    label: tr("Quote"),
    icon: <Quote size={15} />,
    hint: tr("A thought with room to breathe."),
  },
  {
    kind: "gallery",
    label: tr("Photographs"),
    icon: <Images size={15} />,
    hint: tr("Let a sequence of images tell the story."),
  },
];

export function JourneyBuilder() {
  const { slug } = useParams(),
    navigate = useNavigate(),
    { notify } = useApp();
  const [journey, setJourney] = useState<Journey | null>(null),
    [draft, setDraft] = useState<Partial<Journey>>({}),
    [modules, setModules] = useState<Record<number, Partial<Chapter>>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [percent, setPercent] = useState(0),
    [photoEdit, setPhotoEdit] = useState<Photo | null>(null),
    [deleting, setDeleting] = useState<{
      kind: "photos" | "chapters";
      id: number;
      title: string;
    } | null>(null),
    [libraryTarget, setLibraryTarget] = useState<{ id: number | null } | null>(
      null,
    ),
    [selected, setSelected] = useState<number[]>([]),
    [libraryOpen, setLibraryOpen] = useState(false),
    [pendingRoute, setPendingRoute] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    uploadTarget = useRef<number | null>(null);
  const dirty =
    Object.keys(draft).length > 0 || Object.keys(modules).length > 0;
  const [focusModule, setFocusModule] = useState<number | null>(null);
  useEffect(() => {
    setJourney(null);
    setDraft({});
    setModules({});
    api<Journey>(`/journeys/${slug}`)
      .then(setJourney)
      .catch((e) => setError(e.message));
  }, [slug]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const leave = (e: MouseEvent) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (
        !link ||
        link.target === "_blank" ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      )
        return;
      const url = new URL(link.href);
      if (
        url.origin === location.origin &&
        url.pathname !== location.pathname
      ) {
        e.preventDefault();
        e.stopPropagation();
        setPendingRoute(url.pathname + url.search + url.hash);
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  useEffect(() => {
    if (focusModule !== null) {
      document.getElementById(`module-${focusModule}`)?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      document
        .querySelector<HTMLInputElement>(`#module-${focusModule} input`)
        ?.focus({ preventScroll: true });
      setFocusModule(null);
    }
  }, [focusModule, journey]);
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
  async function mutate(path: string, data: RequestInit) {
    return perform(async () => {
      setJourney(await api<Journey>(path, data));
    });
  }
  async function save() {
    if (!journey || busy) return false;
    return perform(async () => {
      let saved = journey;
      if (Object.keys(draft).length)
        saved = await api<Journey>(
          `/journeys/${journey.id}`,
          json("PATCH", draft),
        );
      for (const [id, data] of Object.entries(modules))
        saved = await api<Journey>(`/chapters/${id}`, json("PATCH", data));
      setJourney(saved);
      setDraft({});
      setModules({});
      notify(tr("Your whole story is saved."));
    });
  }
  function update<K extends keyof Journey>(key: K, value: Journey[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function updateModule(id: number, data: Partial<Chapter>) {
    setModules((m) => ({ ...m, [id]: { ...m[id], ...data } }));
  }
  function motion(key: keyof RevealSettings, value: RevealConfig) {
    const current = draft.reveal_settings || journey?.reveal_settings || {};
    update("reveal_settings", { ...current, [key]: value });
  }
  async function addModule(kind: Kind, after: number) {
    if (!journey) return;
    await perform(async () => {
      let saved = await api<Journey>(
        `/journeys/${journey.id}/chapters`,
        json("POST", {
          kind,
          title:
            kind === "chapter"
              ? tr("Untitled chapter")
              : kind === "text"
                ? tr("A field note")
                : kind === "quote"
                  ? tr("A thought to keep")
                  : tr("A photo story"),
        }),
      );
      setJourney(saved);
      const created = saved.chapters.find(
        (c) => !journey.chapters.some((old) => old.id === c.id),
      )!;
      const ids = journey.chapters.map((c) => c.id);
      ids.splice(after + 1, 0, created.id);
      saved = await api<Journey>(
        `/journeys/${journey.id}/chapters/order`,
        json("PUT", { ids }),
      );
      setJourney(saved);
      setFocusModule(created.id);
    });
  }
  async function reorderModule(index: number, direction: number) {
    if (!journey) return;
    const ids = journey.chapters.map((c) => c.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    await mutate(
      `/journeys/${journey.id}/chapters/order`,
      json("PUT", { ids }),
    );
  }
  async function reorderPhoto(photo: Photo, direction: number, group: Photo[]) {
    if (!journey) return;
    const neighbour =
      group[group.findIndex((p) => p.id === photo.id) + direction];
    if (!neighbour) return;
    const ids = journey.photos.map((p) => p.id),
      a = ids.indexOf(photo.id),
      b = ids.indexOf(neighbour.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    await mutate(`/journeys/${journey.id}/photos/order`, json("PUT", { ids }));
  }
  function chooseUpload(target: number | null) {
    uploadTarget.current = target;
    fileInput.current?.click();
  }
  async function upload(files: File[], target: number | null) {
    if (!journey || busy || !files.length) return;
    await perform(async () => {
      let completed = 0;
      try {
        for (const file of files) {
          if (file.size > 128 * 1024 * 1024)
            throw new Error(
              `${file.name}: photographs up to 128 MB are supported.`,
            );
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
            throw new Error(
              `${file.name}: choose a JPEG, PNG or WebP photograph.`,
            );
          setPercent(0);
          setProgress(
            `Uploading ${completed + 1} of ${files.length}: ${file.name}`,
          );
          const saved = await uploadPhoto<Journey>(
            `/journeys/${journey.id}/photos`,
            file,
            target,
            (value) => {
              setPercent(value);
              if (value === 100)
                setProgress(
                  `Optimizing ${file.name}… Keeping a full-resolution copy.`,
                );
            },
          );
          setJourney(saved);
          completed++;
        }
        notify(
          `${completed} photograph${completed === 1 ? "" : "s"} added. Display sizes optimized; full resolution kept.`,
        );
      } catch (error) {
        const message = (error as Error).message;
        throw new Error(
          `${message}${completed ? ` ${completed} photograph${completed === 1 ? " was" : "s were"} already added successfully; only retry the remaining files.` : ""}`,
        );
      } finally {
        setProgress("");
        if (fileInput.current) fileInput.current.value = "";
      }
    });
  }
  async function insertPhotos() {
    if (!libraryTarget) return;
    await perform(async () => {
      for (const id of selected)
        setJourney(
          await api<Journey>(
            `/photos/${id}`,
            json("PATCH", { chapter_id: libraryTarget.id }),
          ),
        );
      setLibraryTarget(null);
      setSelected([]);
    });
  }
  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  if (!journey)
    return (
      <PageState
        title={
          error ? tr("This story is out of reach.") : tr("Opening your story…")
        }
        text={error}
      />
    );
  const current = { ...journey, ...draft };
  const settings = current.reveal_settings || {};
  const textDefault = journeyReveal(settings);
  const chapterTitle = (c: Chapter) => modules[c.id]?.title ?? c.title;
  const photoStrip = (photos: Photo[]) => (
    <div className="builder-photos">
      {photos.map((photo, i) => (
        <article className="builder-photo" key={photo.id}>
          <button
            type="button"
            className="builder-photo-image"
            aria-label={`Edit ${photo.title}`}
            onClick={() => setPhotoEdit(photo)}
          >
            <Picture photo={photo} sizes="250px" />
            <span>
              <Pencil size={13} />
              {tr("Edit caption")}
            </span>
          </button>
          <div className="builder-photo-labels">
            <span>{photo.title}</span>
            {journey.cover_id === photo.id && <b>{tr("COVER")}</b>}
          </div>
          <div className="builder-photo-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={
                photo.featured
                  ? `Unstar ${photo.title}`
                  : `Favourite ${photo.title}`
              }
              aria-pressed={photo.featured}
              onClick={() =>
                mutate(
                  `/photos/${photo.id}`,
                  json("PATCH", { featured: !photo.featured }),
                )
              }
            >
              <Star size={15} fill={photo.featured ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Use ${photo.title} as cover`}
              disabled={journey.cover_id === photo.id}
              onClick={() =>
                mutate(
                  `/journeys/${journey.id}`,
                  json("PATCH", { cover_id: photo.id }),
                )
              }
            >
              {journey.cover_id === photo.id ? (
                <Check size={15} />
              ) : (
                <ImagePlus size={15} />
              )}
            </button>
            <OrderButtons
              index={i}
              length={photos.length}
              disabled={busy}
              move={(d) => reorderPhoto(photo, d, photos)}
            />
            <button
              type="button"
              className="icon-button danger"
              aria-label={`Delete ${photo.title}`}
              onClick={() =>
                setDeleting({
                  kind: "photos",
                  id: photo.id,
                  title: photo.title,
                })
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
  const photoAdder = (id: number | null) => (
    <div
      className="module-photo-add"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload([...e.dataTransfer.files], id);
      }}
    >
      <button type="button" onClick={() => chooseUpload(id)}>
        <ImagePlus size={16} /> {tr("Upload here")}{" "}
        <span>{tr("or drop photographs")}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          setSelected([]);
          setLibraryTarget({ id });
        }}
      >
        <Images size={15} />
        {tr("Choose from library")}
      </button>
    </div>
  );
  const moduleAdder = (after: number) => (
    <div className="module-adder">
      <span>ADD TO THE STORY</span>
      {kinds.map((k) => (
        <button
          type="button"
          key={k.kind}
          title={k.hint}
          onClick={() => addModule(k.kind, after)}
        >
          {k.icon}
          {k.label}
          <Plus size={12} />
        </button>
      ))}
    </div>
  );
  return (
    <main id="main" className="editor-page builder-page page-width">
      <Link to={`/studio/${journey.slug}`} className="back-link">
        <ArrowLeft size={15} />
        {tr("GUIDED STUDIO")}
      </Link>
      <div className="editor-heading">
        <div>
          <span className={`status ${journey.published ? "is-published" : ""}`}>
            <i />
            {journey.published ? tr("Published") : "Private draft"}
          </span>
          <h1>{current.title}</h1>
          <p className="builder-subtitle">
            Words, photographs, and a little room to wander. Build it all here.
          </p>
        </div>
        <Link
          className="button button-outline"
          to={`/journeys/${journey.slug}`}
          target="_blank"
        >
          {tr("Preview saved story")}
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="builder-savebar">
        <span>
          <i className={dirty ? "unsaved-dot" : "saved-dot"} />
          {busy
            ? progress || tr("Saving your story…")
            : dirty
              ? tr("You have unsaved changes")
              : tr("All changes saved")}
        </span>
        <div>
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={() => {
              setLibraryOpen(true);
              requestAnimationFrame(() => jump("photo-library"));
            }}
          >
            <Images size={15} /> Photo library ({journey.photo_count})
          </button>
          <button
            type="button"
            className="button"
            disabled={busy || !dirty}
            onClick={save}
          >
            {busy ? "Working…" : "Save all changes"}
            <Check size={16} />
          </button>
        </div>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error} {dirty && tr("Your unsaved text is still here.")}
        </div>
      )}
      {progress && (
        <div className="upload-status" role="status">
          <span>{progress}</span>
          <progress
            value={percent === 100 ? undefined : percent}
            max={100}
            aria-label={tr("Photograph upload progress")}
          />
          {percent === 100 && (
            <small>
              Preparing high-quality display sizes. Large photographs may take a
              moment.
            </small>
          )}
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files)
            void upload([...e.target.files], uploadTarget.current);
        }}
      />
      <fieldset className="builder-workspace" disabled={busy}>
        <legend className="sr-only">Compose your journey</legend>
        <aside className="builder-outline">
          <span className="eyebrow">{tr("IN THIS STORY")}</span>
          <button type="button" onClick={() => jump("builder-opening")}>
            {tr("The opening")}
          </button>
          {journey.chapters.map((c, i) => (
            <button
              type="button"
              key={c.id}
              onClick={() => jump(`module-${c.id}`)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {chapterTitle(c)}
            </button>
          ))}
          <button type="button" onClick={() => jump("builder-closing")}>
            {tr("Closing words")}
          </button>
          <button
            type="button"
            onClick={() => {
              setLibraryOpen(true);
              requestAnimationFrame(() => jump("photo-library"));
            }}
          >
            Photo library
          </button>
          <p>
            Arrange the story in reading order. Every module can move, and every
            text can have its own motion.
          </p>
        </aside>
        <div className="builder-canvas">
          <section id="builder-opening" className="builder-opening">
            <div className="builder-cover">
              <Picture photo={journey.cover} sizes="850px" />
              <span>
                {journey.location} ·{" "}
                {dateRange(current.start_date, current.end_date)}
              </span>
            </div>
            <details className="builder-details">
              <summary>
                Cover, journey details & layout{" "}
                <span>Edit the essentials ↗</span>
              </summary>
              <div className="builder-details-body">
                <Field label={tr("Journey title")}>
                  <input
                    required
                    maxLength={160}
                    value={current.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </Field>
                <Field label={tr("Poetic subtitle")}>
                  <input
                    maxLength={300}
                    value={current.subtitle}
                    onChange={(e) => update("subtitle", e.target.value)}
                  />
                </Field>
                <div className="form-grid">
                  <Field label={tr("Place / region")}>
                    <input
                      maxLength={160}
                      value={current.location}
                      onChange={(e) => update("location", e.target.value)}
                    />
                  </Field>
                  <Field label={tr("Country")}>
                    <input
                      maxLength={80}
                      value={current.country}
                      onChange={(e) => update("country", e.target.value)}
                    />
                  </Field>
                  <Field label={tr("First day")}>
                    <input
                      type="date"
                      value={current.start_date}
                      onChange={(e) => update("start_date", e.target.value)}
                    />
                  </Field>
                  <Field label={tr("Last day")}>
                    <input
                      type="date"
                      min={current.start_date}
                      value={current.end_date}
                      onChange={(e) => update("end_date", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Short archive description">
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={current.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
                <Field label={tr("Story edition")}>
                  <select
                    value={current.story_template}
                    onChange={(e) => {
                      update(
                        "story_template",
                        e.target.value as Journey["story_template"],
                      );
                      update(
                        "preset",
                        e.target.value === "after-hours"
                          ? "cinematic"
                          : "quiet",
                      );
                    }}
                  >
                    <option value="quiet-atlas">
                      {tr("Quiet Atlas — daylight editorial")}
                    </option>
                    <option value="after-hours">
                      {tr("After Hours — cinematic")}
                    </option>
                  </select>
                </Field>
                <MotionControl
                  label="Title motion"
                  value={settings.title}
                  onChange={(v) => motion("title", v)}
                  fallback={textDefault}
                  text={`${current.title}. ${current.subtitle}`}
                />
              </div>
            </details>
            <details className="builder-details">
              <summary>
                Motion for this journey <span>{tr("Set the feeling ↗")}</span>
              </summary>
              <div className="builder-details-body">
                <p className="builder-help">
                  Texts follow this default unless you choose their own style.
                  Each reveal begins when it comes into view, then plays slowly
                  on its own.
                </p>
                <MotionControl
                  label="Default text motion"
                  value={settings.default}
                  fallback={textDefault}
                  inherit={false}
                  onChange={(v) => motion("default", v)}
                />
                <MotionControl
                  label="Photograph motion"
                  value={settings.images}
                  fallback={imageMotion}
                  inherit={false}
                  text="A photograph, slowly revealed."
                  onChange={(v) => motion("images", v)}
                />
              </div>
            </details>
            <div className="module-content">
              <span className="eyebrow">THE OPENING WORDS</span>
              <Field label="Introduction">
                <textarea
                  rows={5}
                  maxLength={20000}
                  value={current.introduction}
                  placeholder={tr("A few words before the journey begins…")}
                  onChange={(e) => update("introduction", e.target.value)}
                />
              </Field>
              <MotionControl
                label="Introduction motion"
                value={settings.introduction}
                fallback={textDefault}
                text={current.introduction}
                onChange={(v) => motion("introduction", v)}
              />
            </div>
            {journey.photos.some((p) => !p.chapter_id) && (
              <div className="module-content">
                <span className="eyebrow">OPENING PHOTOGRAPHS</span>
                {photoStrip(journey.photos.filter((p) => !p.chapter_id))}
                {photoAdder(null)}
              </div>
            )}
          </section>
          {moduleAdder(-1)}
          {journey.chapters.map((saved, index) => {
            const chapter = { ...saved, ...modules[saved.id] };
            const type = kinds.find((k) => k.kind === chapter.kind)!;
            return (
              <div key={chapter.id}>
                <section
                  className="builder-module"
                  id={`module-${chapter.id}`}
                  aria-label={`${type.label}: ${chapter.title}`}
                >
                  <header className="module-header">
                    <span>
                      {String(index + 1).padStart(2, "0")}
                      <i />
                      {type.icon}
                      {type.label}
                    </span>
                    <div>
                      <OrderButtons
                        index={index}
                        length={journey.chapters.length}
                        disabled={busy}
                        move={(d) => reorderModule(index, d)}
                      />
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`Delete module ${chapter.title}`}
                        onClick={() =>
                          setDeleting({
                            kind: "chapters",
                            id: chapter.id,
                            title: chapter.title,
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </header>
                  <div className="module-content">
                    <div
                      className={chapter.kind === "chapter" ? "form-grid" : ""}
                    >
                      <Field
                        label={
                          chapter.kind === "chapter"
                            ? tr("Chapter title")
                            : tr("Module label")
                        }
                      >
                        <input
                          maxLength={160}
                          required
                          value={chapter.title}
                          onChange={(e) =>
                            updateModule(chapter.id, { title: e.target.value })
                          }
                        />
                      </Field>
                      {chapter.kind === "chapter" && (
                        <Field label="Date (optional)">
                          <input
                            type="date"
                            value={chapter.date}
                            onChange={(e) =>
                              updateModule(chapter.id, { date: e.target.value })
                            }
                          />
                        </Field>
                      )}
                    </div>
                    {chapter.kind === "chapter" && (
                      <Field label={tr("Inside this day")}>
                        <select
                          value={chapter.gallery_mode}
                          onChange={(e) =>
                            updateModule(chapter.id, {
                              gallery_mode: e.target
                                .value as Chapter["gallery_mode"],
                            })
                          }
                        >
                          <option value="editorial">
                            {tr("Editorial gallery")}
                          </option>
                          <option value="horizontal">
                            {tr("Sideways gallery")}
                          </option>
                        </select>
                      </Field>
                    )}
                    {(chapter.kind === "chapter" ||
                      chapter.kind === "text") && (
                      <Field
                        label={
                          chapter.kind === "text" ? tr("Text") : tr("The story")
                        }
                      >
                        <textarea
                          rows={chapter.kind === "text" ? 5 : 4}
                          maxLength={20000}
                          value={chapter.story}
                          placeholder="Put the feeling into words…"
                          onChange={(e) =>
                            updateModule(chapter.id, { story: e.target.value })
                          }
                        />
                      </Field>
                    )}
                    {(chapter.kind === "chapter" ||
                      chapter.kind === "quote") && (
                      <Field
                        label={
                          chapter.kind === "quote"
                            ? tr("Quote")
                            : "A thought to keep (optional)"
                        }
                      >
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={chapter.quote}
                          placeholder="A thought with room to breathe…"
                          onChange={(e) =>
                            updateModule(chapter.id, { quote: e.target.value })
                          }
                        />
                      </Field>
                    )}
                    {chapter.kind !== "gallery" && (
                      <MotionControl
                        label={`${chapter.title} motion`}
                        value={chapter.reveal}
                        onChange={(v) =>
                          updateModule(chapter.id, { reveal: v })
                        }
                        fallback={textDefault}
                        text={
                          chapter.kind === "quote"
                            ? chapter.quote
                            : chapter.story || chapter.title
                        }
                      />
                    )}
                    {chapter.kind !== "chapter" && (
                      <p className="module-label-hint">
                        The module label helps you find this section here. It is
                        not shown in the published story.
                      </p>
                    )}
                    {(chapter.kind !== "quote" ||
                      journey.photos.some(
                        (p) => p.chapter_id === chapter.id,
                      )) && (
                      <>
                        {photoStrip(
                          journey.photos.filter(
                            (p) => p.chapter_id === chapter.id,
                          ),
                        )}
                        {photoAdder(chapter.id)}
                      </>
                    )}
                  </div>
                </section>
                {moduleAdder(index)}
              </div>
            );
          })}
          <section className="builder-module" id="builder-closing">
            <header className="module-header">
              <span>THE CLOSING WORDS</span>
            </header>
            <div className="module-content">
              <Field label={tr("A thought to take home")}>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={current.reflection}
                  onChange={(e) => update("reflection", e.target.value)}
                />
              </Field>
              <MotionControl
                label="Reflection motion"
                value={settings.reflection}
                fallback={textDefault}
                text={current.reflection}
                onChange={(v) => motion("reflection", v)}
              />
              <Field label={tr("Closing words")}>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={current.closing}
                  onChange={(e) => update("closing", e.target.value)}
                />
              </Field>
              <MotionControl
                label="Closing motion"
                value={settings.closing}
                fallback={textDefault}
                text={current.closing}
                onChange={(v) => motion("closing", v)}
              />
            </div>
          </section>
          <details
            className="builder-details builder-library"
            id="photo-library"
            open={libraryOpen}
            onToggle={(e) => setLibraryOpen(e.currentTarget.open)}
          >
            <summary>
              Photograph library{" "}
              <span>
                {journey.photo_count} photographs · Upload, caption & curate
              </span>
            </summary>
            <div className="builder-details-body">
              <p className="builder-help">
                Upload here for later, or directly inside a module. Choose a
                cover, mark favourites, and click a photograph to edit its
                caption or move it to another module.
              </p>
              {photoAdder(null)}
              <p className="upload-help">
                JPEG, PNG & WebP · Up to 128 MB each · Automatic display sizes ·
                Full-resolution copy kept · GPS metadata removed
              </p>
              {photoStrip(journey.photos)}
            </div>
          </details>
          <section className="builder-publish">
            <div>
              <span className="eyebrow">{tr("READY TO SHARE?")}</span>
              <h2>Give your story a little world.</h2>
              <p>
                {current.published
                  ? tr(
                      "After saving, anyone who can reach this server can read your journey. It also appears in the archive.",
                    )
                  : tr(
                      "Your draft and its uploaded photographs are only visible to you.",
                    )}
              </p>
            </div>
            <label className="publish-toggle">
              <input
                type="checkbox"
                checked={current.published}
                onChange={(e) => update("published", e.target.checked)}
              />{" "}
              {tr("Publish this journey")}
            </label>
          </section>
        </div>
      </fieldset>
      {photoEdit && (
        <PhotoForm
          photo={photoEdit}
          journey={journey}
          onClose={() => setPhotoEdit(null)}
          onSave={(j) => {
            setJourney(j);
            setPhotoEdit(null);
            notify(tr("Photograph updated."));
          }}
        />
      )}
      {deleting && (
        <Confirm
          title={`Delete “${deleting.title}”?`}
          description={
            deleting.kind === "chapters"
              ? "This module will be removed. Its photographs stay in the opening gallery."
              : tr(
                  "This photograph and its full-resolution copy will be permanently removed.",
                )
          }
          onClose={() => setDeleting(null)}
          action={async () => {
            setJourney(
              await api<Journey>(`/${deleting.kind}/${deleting.id}`, {
                method: "DELETE",
              }),
            );
            if (deleting.kind === "chapters")
              setModules((previous) => {
                const next = { ...previous };
                delete next[deleting.id];
                return next;
              });
            setDeleting(null);
          }}
        />
      )}
      {libraryTarget && (
        <Modal
          title={tr("Choose photographs")}
          className="library-picker"
          onClose={() => {
            if (!busy) setLibraryTarget(null);
          }}
        >
          <span className="eyebrow">FROM YOUR PHOTOGRAPH LIBRARY</span>
          <h2>Find the right moments.</h2>
          <p>
            Selected photographs move into this module. Their captions and
            favourites stay with them.
          </p>
          <div className="library-pick-grid">
            {journey.photos
              .filter((p) => p.chapter_id !== libraryTarget.id)
              .map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={selected.includes(p.id)}
                  disabled={busy}
                  onClick={() =>
                    setSelected((ids) =>
                      ids.includes(p.id)
                        ? ids.filter((id) => id !== p.id)
                        : [...ids, p.id],
                    )
                  }
                >
                  <Picture photo={p} sizes="250px" />
                  {selected.includes(p.id) && <Check size={17} />}
                  <span>{p.title}</span>
                </button>
              ))}
          </div>
          {!journey.photos.some((p) => p.chapter_id !== libraryTarget.id) && (
            <p>
              No other photographs yet. Close this panel and upload directly in
              the module.
            </p>
          )}
          <button
            className="button"
            disabled={busy || !selected.length}
            onClick={insertPhotos}
          >
            {busy
              ? tr("Adding…")
              : `Insert ${selected.length} photograph${selected.length === 1 ? "" : "s"}`}
            <Plus size={16} />
          </button>
        </Modal>
      )}
      {pendingRoute && (
        <Modal
          title={tr("Save your story before leaving")}
          onClose={() => setPendingRoute("")}
        >
          <h2>{tr("A few words are still unsaved.")}</h2>
          <p>
            {tr(
              "Save your changes before leaving this journey, or keep working on your story.",
            )}
          </p>
          <div className="leave-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={async () => {
                if (await save()) {
                  navigate(pendingRoute);
                  setPendingRoute("");
                }
              }}
            >
              {tr("Save and leave")}
              <Check size={16} />
            </button>
            <button
              type="button"
              className="button button-outline"
              disabled={busy}
              onClick={() => setPendingRoute("")}
            >
              {tr("Keep editing")}
            </button>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setDraft({});
                setModules({});
                navigate(pendingRoute);
                setPendingRoute("");
              }}
            >
              {tr("Leave without saving")}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
