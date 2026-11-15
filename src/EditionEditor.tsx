import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ChevronDown, ImagePlus } from "lucide-react";
import { Link } from "react-router-dom";
import { api, json, uploadPhoto } from "./api";
import { useApp } from "./App";
import { t, useLocale } from "./I18n";
import { FocusFrame, PhotoFolders, toTile, useDelayedMount, useExclusivePanel, type Tile } from "./HeroCoverEditor";
import {
  draftFromServer,
  isDefaultDraft,
  limitText,
  sameDraft,
  setSlot,
  shapeMismatch,
  TEXT_LIMIT,
  toPayload,
  type EditionDraft,
  type Lang,
} from "./editionOverrides";
import { defaultFocus, focusToPosition, HERO_DEVICES } from "./heroFocus";
import type { Journey, Photo, SiteEdition } from "./types";
import "./hero-editor.css";
import "./edition-editor.css";

const EDITIONS: { id: SiteEdition["id"]; name: () => string }[] = [
  { id: "quiet-atlas", name: () => t("First Light", "Erstes Licht") },
  { id: "after-hours", name: () => t("Last Light", "Letztes Licht") },
];

type Target = "cover" | number;

function EditionCard({
  edition,
  name,
  journeys,
  uploads,
  onUploaded,
  onSaved,
}: {
  edition: SiteEdition;
  name: string;
  journeys: Journey[];
  uploads: Tile[];
  onUploaded: (tile: Tile) => void;
  onSaved: (edition: SiteEdition) => void;
}) {
  const { notify } = useApp();
  const [open, setOpen] = useExclusivePanel(`edition-${edition.id}`),
    shown = useDelayedMount(open),
    [draft, setDraft] = useState<EditionDraft>(() => draftFromServer(edition)),
    [target, setTarget] = useState<Target>("cover"),
    [picked, setPicked] = useState<Tile[]>([]),
    [busy, setBusy] = useState<"" | "save" | "reset" | "upload">(""),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    fileInput = useRef<HTMLInputElement>(null);
  const saved = useMemo(() => draftFromServer(edition), [edition]);
  const dirty = !sameDraft(draft, saved);
  const prefix = `edition-${edition.id}`;
  const journeySlugs = edition.journey_slugs ?? {};
  const hasJourneys = Object.keys(journeySlugs).length > 0;

  // Every photograph that can be resolved by id: shipped photos have negative ids.
  const known = useMemo(() => {
    const map = new Map<number, Tile>();
    const add = (candidate?: Partial<Tile> | null) => {
      if (!candidate || typeof candidate.id !== "number" || !candidate.url || !candidate.srcset || !candidate.width || !candidate.height) return;
      if (!map.has(candidate.id)) map.set(candidate.id, toTile(candidate as Tile));
    };
    edition.assets.forEach((asset, index) => add({ ...asset, id: -(index + 1) }));
    add(edition.cover);
    edition.slot_photos.forEach(add);
    picked.forEach(add);
    uploads.forEach(add);
    for (const journey of journeys) {
      add(journey.cover);
      journey.highlights?.forEach(add);
    }
    return map;
  }, [edition, picked, uploads, journeys]);

  const defaultAsset = (index: number) => known.get(-(index + 1)) ?? null;
  const tileFor = (ref: number | null, fallback: Tile | null) => (ref === null ? fallback : (known.get(ref) ?? fallback));
  const slotTile = (index: number) => tileFor(draft.slots[index] ?? null, defaultAsset(index));
  const coverTile = tileFor(draft.cover, defaultAsset(edition.default_cover_index));
  const currentRef: number =
    target === "cover"
      ? (draft.cover ?? -(edition.default_cover_index + 1))
      : (draft.slots[target] ?? -(target + 1));
  const expectedShape = target === "cover" ? undefined : edition.slot_shapes[target];

  const choices = useMemo(() => {
    const list: Tile[] = [];
    const seen = new Set<number>();
    const add = (tile?: Tile | null) => {
      if (tile && !seen.has(tile.id)) {
        seen.add(tile.id);
        list.push(tile);
      }
    };
    uploads.forEach(add);
    for (const journey of journeys) {
      for (const photo of [journey.cover, ...(journey.highlights ?? [])]) {
        if (photo && typeof photo.id === "number") add(known.get(photo.id));
      }
    }
    edition.assets.forEach((_, index) => add(defaultAsset(index)));
    picked.forEach(add);
    if (currentRef) add(known.get(currentRef));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads, journeys, known, edition, picked, currentRef]);

  function choose(tile: Tile) {
    setError("");
    setPicked((list) => (tile.id > 0 && !list.some((item) => item.id === tile.id) ? [...list, tile] : list));
    if (target === "cover") {
      setDraft((current) => ({
        ...current,
        cover: tile.id === -(edition.default_cover_index + 1) ? null : tile.id,
        focus: tile.id === current.cover ? current.focus : defaultFocus(),
      }));
    } else {
      setDraft((current) => ({ ...current, slots: setSlot(current.slots, target, tile.id) }));
    }
  }
  async function save() {
    setBusy("save");
    setError("");
    try {
      const next = await api<SiteEdition>(`/site/editions/${edition.id}`, json("PUT", toPayload(draft)));
      onSaved(next);
      setDraft(draftFromServer(next));
      notify(t("Edition saved.", "Edition gespeichert."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function reset() {
    setBusy("reset");
    setError("");
    try {
      const next = await api<SiteEdition>(`/site/editions/${edition.id}`, { method: "DELETE" });
      onSaved(next);
      setDraft(draftFromServer(next));
      setTarget("cover");
      notify(t("Edition reset to the default.", "Edition auf Standard zurückgesetzt."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("upload");
    setProgress(0);
    setError("");
    try {
      const result = await uploadPhoto<{ photo: Photo }>("/site/editions/photo", file, null, (percent) => setProgress(percent));
      const tile = toTile(result.photo);
      onUploaded(tile);
      choose(tile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const setText = (key: "title" | "subtitle", lang: Lang, value: string) =>
    setDraft((current) => ({ ...current, [key]: { ...current[key], [lang]: limitText(value) } }));

  const preview = known.get(edition.cover_photo_id ?? 0) ?? edition.cover ?? edition.default_cover;
  const targetLabel = target === "cover" ? t("Cover", "Titelbild") : `${t("Place", "Platz")} ${target + 1}`;
  const mismatch = target !== "cover" && shapeMismatch(expectedShape, known.get(currentRef) ?? null);
  const status = edition.custom ? t("Customised", "Angepasst") : t("Default", "Standard");

  return (
    <section className={`hero-editor edition-editor is-${edition.id === "after-hours" ? "dark" : "light"}${open ? " is-open" : ""}`} aria-labelledby={`${prefix}-title`}>
      <button
        type="button"
        className="hero-editor-toggle"
        data-studio-panel={`edition-${edition.id}`}
        aria-expanded={open}
        aria-controls={`${prefix}-panel`}
        onClick={() => setOpen((value) => !value)}
      >
        {preview && (
          <img
            className="hero-editor-bg"
            src={preview.url}
            srcSet={preview.srcset}
            sizes="(max-width: 760px) 100vw, 50vw"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            style={{ objectPosition: focusToPosition(edition.focus.desktop) }}
          />
        )}
        <span className="hero-editor-shade" aria-hidden="true" />
        <span className="hero-editor-heading">
          <span className="edition-card-kicker">{edition.id === "after-hours" ? t("Edition II", "Edition II") : t("Edition I", "Edition I")}</span>
          <span id={`${prefix}-title`} className="hero-editor-title">{name}</span>
          <span className="hero-editor-status">{status}</span>
        </span>
        <span className="hero-editor-action" aria-hidden="true">
          {open ? t("Close", "Schließen") : t("Edit", "Bearbeiten")}
          <ChevronDown size={15} strokeWidth={1.5} />
        </span>
      </button>
      <div className="studio-panel" data-open={open ? "true" : "false"}>
        <div className="studio-panel-clip">
          <div className="studio-panel-body">
      {shown && (
        <div id={`${prefix}-panel`} className="hero-editor-panel">
          <p className="hero-editor-lead">
            {hasJourneys
              ? t(
                  "Choose the cover, crop and titles of this edition. Empty text fields keep the default text.",
                  "Wähle Titelbild, Ausschnitt und Titel dieser Edition. Leere Textfelder behalten den Standardtext.",
                )
              : t(
              "Choose the cover and the eight photographs of this edition's story. Click a place, then pick a photograph for it. Empty text fields keep the default text.",
              "Wähle das Titelbild und die acht Fotos der Geschichte dieser Edition. Klicke einen Platz an und wähle dann ein Foto dafür. Leere Textfelder behalten den Standardtext.",
            )}
          </p>
          {hasJourneys && (
            <div className="edition-journeys">
              <p className="hero-editor-note">
                {t(
                  "Photographs, texts, modules and order of this story are edited like any journey. The edition itself stays fixed.",
                  "Fotos, Texte, Module und Reihenfolge dieser Geschichte bearbeitest du wie bei jeder Reise. Die Edition selbst bleibt fest.",
                )}
              </p>
              <div className="hero-editor-actions">
                {(["de", "en"] as const).map((lang) =>
                  journeySlugs[lang] ? (
                    <Link key={lang} className="button" to={`/studio/${journeySlugs[lang]}/edit`}>
                      {lang === "de"
                        ? t("Edit edition (German)", "Edition bearbeiten (Deutsch)")
                        : t("Edit edition (English)", "Edition bearbeiten (Englisch)")}
                    </Link>
                  ) : null,
                )}
              </div>
            </div>
          )}
          <div className="edition-slots" role="group" aria-label={t("Image places", "Bildplätze")}>
            {[
              { key: "cover" as Target, label: t("Cover", "Titelbild"), tile: coverTile, shape: undefined },
              ...Array.from({ length: hasJourneys ? 0 : 8 }, (_, index) => ({
                key: index as Target,
                label: String(index + 1),
                tile: slotTile(index),
                shape: edition.slot_shapes[index],
              })),
            ].map((slot) => {
              const portrait = slot.shape === "portrait";
              return (
                <button
                  type="button"
                  key={String(slot.key)}
                  className={`edition-slot${slot.key === "cover" ? " is-cover" : ""}`}
                  aria-pressed={slot.key === target}
                  aria-label={`${slot.key === "cover" ? t("Cover", "Titelbild") : `${t("Place", "Platz")} ${slot.label}`}${portrait ? `, ${t("portrait format", "Hochformat")}` : ""}`}
                  onClick={() => setTarget(slot.key)}
                >
                  {slot.tile && (
                    <img src={slot.tile.url} srcSet={slot.tile.srcset} sizes="96px" alt="" loading="lazy" decoding="async" draggable={false} />
                  )}
                  <span className="edition-slot-label">{slot.label}</span>
                  {portrait && <span className="edition-slot-shape">{t("Portrait", "Hochformat")}</span>}
                  {slot.key !== "cover" && draft.slots[slot.key] !== null && <span className="edition-slot-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="hero-editor-note" aria-live="polite">
            {t(`Photograph for: ${targetLabel}.`, `Foto für: ${targetLabel}.`)}{" "}
            {expectedShape === "portrait" &&
              t(
                "The layout shows this place as a portrait; a portrait photograph fits best.",
                "Das Layout zeigt diesen Platz im Hochformat; ein Hochformatfoto passt am besten.",
              )}
            {mismatch && (
              <strong className="edition-warning">
                {" "}
                {t("The chosen photograph is a landscape and will be cropped.", "Das gewählte Foto ist im Querformat und wird beschnitten.")}
              </strong>
            )}
          </p>
          <h3 className="photo-folders-head">{t("Suggestions", "Vorschläge")}</h3>
          <div className="hero-editor-tiles" role="group" aria-label={t("Suggestions", "Vorschläge")}>
            {choices.map((tile) => (
              <button
                type="button"
                key={tile.id}
                className="hero-editor-tile"
                aria-pressed={tile.id === currentRef}
                aria-label={tile.alt || `${t("Photograph", "Foto")} ${Math.abs(tile.id)}`}
                onClick={() => choose(tile)}
              >
                <img src={tile.url} srcSet={tile.srcset} sizes="96px" alt="" loading="lazy" decoding="async" draggable={false} />
              </button>
            ))}
            <button
              type="button"
              className="hero-editor-tile hero-editor-upload"
              disabled={busy === "upload"}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={20} strokeWidth={1.1} aria-hidden="true" />
              <span>{busy === "upload" ? `${progress} %` : t("Upload your own image", "Eigenes Bild hochladen")}</span>
            </button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg" className="hero-editor-sr" tabIndex={-1} onChange={upload} />
          </div>
          <PhotoFolders enabled={open} selectedId={currentRef} onChoose={choose} />
          <h3 className="edition-subhead">{t("Cover crop", "Ausschnitt des Titelbilds")}</h3>
          <div className="hero-editor-frames">
            {HERO_DEVICES.map((device) => (
              <FocusFrame
                key={device}
                idPrefix={prefix}
                device={device}
                photo={coverTile}
                focus={draft.focus[device]}
                disabled={!coverTile}
                onChange={(point) => setDraft((current) => ({ ...current, focus: { ...current.focus, [device]: point } }))}
              />
            ))}
          </div>
          <h3 className="edition-subhead">{t("Title and subtitle", "Titel und Untertitel")}</h3>
          <div className="edition-fields">
            {(["title", "subtitle"] as const).flatMap((key) =>
              (["de", "en"] as const).map((lang) => (
                <label key={`${key}-${lang}`} className="edition-field">
                  <span>
                    {key === "title" ? t("Title", "Titel") : t("Subtitle", "Untertitel")} · {lang.toUpperCase()}
                  </span>
                  <input
                    type="text"
                    value={draft[key][lang]}
                    maxLength={TEXT_LIMIT}
                    lang={lang}
                    placeholder={t("Default text", "Standardtext")}
                    onChange={(event) => setText(key, lang, event.target.value)}
                  />
                </label>
              )),
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="hero-editor-actions">
            <button type="button" className="button" disabled={!dirty || busy !== ""} onClick={() => void save()}>
              {busy === "save" ? t("Saving…", "Speichern …") : t("Save", "Speichern")}
            </button>
            <button
              type="button"
              className="button button-outline"
              disabled={busy !== "" || (!edition.custom && isDefaultDraft(draft))}
              onClick={() => void reset()}
            >
              {t("Reset to default", "Auf Standard zurücksetzen")}
            </button>
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function EditionEditor({ journeys }: { journeys: Journey[] }) {
  const { locale } = useLocale();
  const [editions, setEditions] = useState<Record<string, SiteEdition> | null>(null),
    [uploads, setUploads] = useState<Tile[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api<Record<string, SiteEdition>>(`/site/editions?lang=${locale}`)
      .then((value) => alive && setEditions(value))
      .catch((e) => alive && setError((e as Error).message));
    api<Photo[]>("/site/editions/uploads")
      .then((list) => alive && setUploads(list.map(toTile)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [locale]);
  return (
    <section className="edition-editors studio-section" aria-labelledby="edition-editors-title">
      <h2 id="edition-editors-title" className="sr-only">
        {t("Editions", "Editionen")}
      </h2>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="edition-editors-grid">
        {editions &&
          EDITIONS.map(({ id, name }) =>
            editions[id] ? (
              <EditionCard
                key={id}
                edition={editions[id]}
                name={name()}
                journeys={journeys}
                uploads={uploads}
                onUploaded={(tile) => setUploads((list) => [tile, ...list.filter((item) => item.id !== tile.id)])}
                onSaved={(next) => setEditions((current) => ({ ...(current ?? {}), [id]: next }))}
              />
            ) : null,
          )}
      </div>
    </section>
  );
}
