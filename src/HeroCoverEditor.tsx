import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronDown, ChevronRight, ImagePlus } from "lucide-react";
import { api, json, uploadPhoto } from "./api";
import { useApp } from "./App";
import { t, useLocale } from "./I18n";
import {
  defaultFocus,
  dragToFocus,
  focusToPosition,
  HERO_DEVICES,
  HERO_RATIOS,
  normalizeFocus,
  nudgeFocus,
  sameFocus,
  type FocusPoint,
  type HeroDevice,
  type HeroFocus,
} from "./heroFocus";
import { smallestSource, usePhotoPool } from "./photoPool";
import type { Journey, Photo, SiteHero } from "./types";
import "./hero-editor.css";

export type Tile = Pick<Photo, "id" | "url" | "srcset" | "width" | "height"> & {
  alt?: string;
};

export const toTile = (photo: Tile): Tile => ({
  id: photo.id,
  url: photo.url,
  srcset: photo.srcset,
  width: photo.width,
  height: photo.height,
  alt: photo.alt,
});

const deviceLabel = (device: HeroDevice) =>
  device === "desktop"
    ? t("Desktop", "Desktop")
    : device === "tablet"
      ? t("Tablet", "Tablet")
      : t("Phone", "Smartphone");
const deviceRatio = (device: HeroDevice) =>
  device === "desktop" ? "16:10" : device === "tablet" ? "4:5" : "9:19.5";

export function FocusFrame({
  idPrefix = "hero",
  device,
  photo,
  focus,
  disabled,
  onChange,
  ratio,
  ratioLabel,
}: {
  /** Override the preview ratio (width / height) and its label, e.g. for the archive band. */
  ratio?: number;
  ratioLabel?: string;
  idPrefix?: string;
  device: HeroDevice;
  photo: Tile | null;
  focus: FocusPoint;
  disabled: boolean;
  onChange: (point: FocusPoint) => void;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    start: FocusPoint;
    id: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = `${idPrefix}-hint-${device}`;
  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !photo || event.button > 0) return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      start: focus,
      id: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId || !photo) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(
      dragToFocus(
        state.start,
        { dx: event.clientX - state.x, dy: event.clientY - state.y },
        { width: rect.width, height: rect.height },
        photo,
      ),
    );
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || !photo) return;
    if (!/^(Arrow(Left|Right|Up|Down)|Home)$/.test(event.key)) return;
    event.preventDefault();
    // Arrow keys move the picture like a drag would: the visible crop follows the key.
    const inverted: Record<string, string> = {
      ArrowLeft: "ArrowRight",
      ArrowRight: "ArrowLeft",
      ArrowUp: "ArrowDown",
      ArrowDown: "ArrowUp",
    };
    onChange(nudgeFocus(focus, inverted[event.key] ?? event.key, event.shiftKey));
  }
  return (
    <figure className="hero-editor-device" data-device={device}>
      <div
        className={`hero-editor-frame${dragging ? " is-dragging" : ""}${disabled ? " is-locked" : ""}`}
        style={{ aspectRatio: String(ratio ?? HERO_RATIOS[device]) } as CSSProperties}
        tabIndex={disabled ? -1 : 0}
        role="group"
        aria-roledescription={t("image crop", "Bildausschnitt")}
        aria-label={`${deviceLabel(device)} (${ratioLabel ?? deviceRatio(device)}): ${t("position", "Position")} ${Math.round(focus.x)} % / ${Math.round(focus.y)} %`}
        aria-describedby={hintId}
        aria-disabled={disabled || undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={key}
      >
        {photo ? (
          <img
            src={photo.url}
            srcSet={photo.srcset}
            sizes="(max-width: 760px) 240px, 480px"
            alt=""
            draggable={false}
            style={{ objectPosition: focusToPosition(focus) }}
          />
        ) : (
          <span className="hero-editor-empty" aria-hidden="true" />
        )}
      </div>
      <figcaption>
        <span>{deviceLabel(device)}</span>
        <small>{ratioLabel ?? deviceRatio(device)}</small>
      </figcaption>
      <span id={hintId} className="hero-editor-sr">
        {t(
          "Drag the image or use the arrow keys to move the crop. Shift makes larger steps, Home centres.",
          "Bild ziehen oder mit den Pfeiltasten den Ausschnitt verschieben. Umschalt für größere Schritte, Pos1 zentriert.",
        )}
      </span>
    </figure>
  );
}

/** Journey photo folders: closed folders render nothing, so large libraries stay light. */
export function PhotoFolders({ enabled, selectedId, onChoose }: { enabled: boolean; selectedId: number | null; onChoose: (tile: Tile) => void }) {
  const pool = usePhotoPool(enabled);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  if (!enabled) return null;
  return (
    <div className="photo-folders" aria-busy={pool.status === "loading"}>
      <h3 className="photo-folders-head">
        {t("All photographs", "Alle Fotos")}
        {pool.total > 0 && <small>{pool.total}</small>}
      </h3>
      {pool.groups.map((group) => {
        const isOpen = toggled[group.key] ?? group.photos.some((p) => p.id === selectedId);
        const title = group.own ? t("Own uploads", "Eigene Uploads") : group.title;
        const panel = `photo-folder-${group.key}`;
        return (
          <div className="photo-folder" key={group.key}>
            <button
              type="button"
              className="photo-folder-toggle"
              aria-expanded={isOpen}
              aria-controls={panel}
              onClick={() => setToggled((cur) => ({ ...cur, [group.key]: !isOpen }))}
            >
              <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>{title}</span>
              <small>{group.photos.length}</small>
            </button>
            {isOpen && (
              <div id={panel} className="photo-folder-grid" role="group" aria-label={title}>
                {group.photos.map((photo) => (
                  <button
                    type="button"
                    key={photo.id}
                    className="hero-editor-tile photo-folder-tile"
                    aria-pressed={photo.id === selectedId}
                    aria-label={photo.alt || `${t("Photograph", "Foto")} ${photo.id}`}
                    onClick={() => onChoose(toTile(photo))}
                  >
                    <img src={smallestSource(photo.srcset, photo.url)} alt="" loading="lazy" decoding="async" draggable={false} />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {pool.status === "loading" && <p className="hero-editor-note">{t("Loading photographs…", "Fotos werden geladen …")}</p>}
      {pool.status === "error" && <p className="hero-editor-note">{pool.error}</p>}
    </div>
  );
}

/** Keeps panel content mounted for the close animation (520ms). */
export function useDelayedMount(open: boolean, ms = 520): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return undefined; }
    const id = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(id);
  }, [open, ms]);
  return open || mounted;
}

/** Glide the opened card up to just below the header; re-aims every frame while other panels collapse. */
function glideToPanel(id: string) {
  const card = document.querySelector<HTMLElement>(`[data-studio-panel="${id}"]`);
  if (!card) return;
  const header = document.querySelector<HTMLElement>(".site-header, header");
  const target = () => {
    const offset = Math.min(header?.getBoundingClientRect().height ?? 72, 96) + 18;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(0, Math.min(max, card.getBoundingClientRect().top + window.scrollY - offset));
  };
  const calm =
    document.documentElement.dataset.motion === "off" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (calm) {
    window.scrollTo({ top: target(), behavior: "instant" });
    return;
  }
  const startY = window.scrollY;
  const t0 = performance.now();
  const duration = 820;
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let cancelled = false;
  const stop = () => { cancelled = true; };
  window.addEventListener("wheel", stop, { once: true, passive: true });
  window.addEventListener("touchstart", stop, { once: true, passive: true });
  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo({ top: startY + (target() - startY) * ease(t), behavior: "instant" });
    if (t < 1) requestAnimationFrame(step);
    else {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    }
  };
  requestAnimationFrame(step);
}

/** Only one studio editor panel is open at a time: opening one closes the others. */
export function useExclusivePanel(id: string): [boolean, (next: boolean | ((value: boolean) => boolean)) => void] {
  const [open, setOpenState] = useState(false);
  useEffect(() => {
    const close = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpenState(false);
    };
    window.addEventListener("studio-panel-open", close);
    return () => window.removeEventListener("studio-panel-open", close);
  }, [id]);
  const setOpen = (next: boolean | ((value: boolean) => boolean)) => {
    setOpenState((value) => {
      const result = typeof next === "function" ? next(value) : next;
      if (result && !value)
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent("studio-panel-open", { detail: id }));
          glideToPanel(id);
        });
      return result;
    });
  };
  return [open, setOpen];
}

export function HeroCoverEditor({ journeys }: { journeys: Journey[] }) {
  const { notify } = useApp();
  const { locale } = useLocale();
  const [open, setOpen] = useExclusivePanel("hero-cover"),
    shown = useDelayedMount(open),
    [saved, setSaved] = useState<SiteHero | null>(null),
    [photo, setPhoto] = useState<Tile | null>(null),
    [focus, setFocus] = useState<HeroFocus>(defaultFocus()),
    [uploads, setUploads] = useState<Tile[]>([]),
    [automatic, setAutomatic] = useState<Tile | null>(null),
    [busy, setBusy] = useState<"" | "save" | "reset" | "upload">(""),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    api<SiteHero>("/site/hero")
      .then((hero) => {
        if (!alive) return;
        setSaved(hero);
        setPhoto(hero.photo ? toTile(hero.photo) : null);
        setFocus(normalizeFocus(hero.focus));
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  // The automatic cover also feeds the collapsed card, so it loads right away.
  useEffect(() => {
    let alive = true;
    api<Journey>(`/showcase/quiet-atlas?lang=${locale}`)
      .then((story) => alive && setAutomatic(story.cover ? toTile(story.cover) : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [locale]);
  // Heavier lookups only once the panel is opened.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<Photo[]>("/site/hero/uploads")
      .then((list) => alive && setUploads(list.map(toTile)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open]);

  const tiles = useMemo(() => {
    const seen = new Set<number>();
    const list: Tile[] = [];
    const add = (candidate?: Partial<Tile> | null) => {
      if (
        !candidate ||
        typeof candidate.id !== "number" ||
        !candidate.url ||
        !candidate.srcset ||
        !candidate.width ||
        !candidate.height ||
        seen.has(candidate.id)
      )
        return;
      seen.add(candidate.id);
      list.push(toTile(candidate as Tile));
    };
    uploads.forEach(add);
    for (const journey of journeys) {
      add(journey.cover);
      journey.highlights?.forEach(add);
    }
    if (photo) add(photo);
    return list;
  }, [journeys, uploads, photo]);

  const savedId = saved?.photo?.id ?? null;
  const dirty =
    (photo?.id ?? null) !== savedId ||
    (photo !== null && !sameFocus(focus, normalizeFocus(saved?.focus)));
  const custom = savedId !== null;
  const preview = photo ?? automatic;

  function choose(tile: Tile) {
    setError("");
    if (tile.id !== photo?.id) setFocus(defaultFocus());
    setPhoto(tile);
  }
  async function save() {
    if (!photo) return;
    setBusy("save");
    setError("");
    try {
      const hero = await api<SiteHero>(
        "/site/hero",
        json("PUT", { photo_id: photo.id, focus }),
      );
      setSaved(hero);
      setFocus(normalizeFocus(hero.focus));
      notify(t("Homepage cover saved.", "Titelbild der Startseite gespeichert."));
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
      if (custom) {
        await api<SiteHero>("/site/hero", json("PUT", { photo_id: null }));
        notify(
          t(
            "Homepage cover reset to the automatic image.",
            "Titelbild der Startseite wieder automatisch.",
          ),
        );
      }
      setSaved({ photo: null, focus: defaultFocus() });
      setPhoto(null);
      setFocus(defaultFocus());
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
      const result = await uploadPhoto<{ photo: Photo }>(
        "/site/hero/photo",
        file,
        null,
        (percent) => setProgress(percent),
      );
      const tile = toTile(result.photo);
      setUploads((list) => [tile, ...list.filter((item) => item.id !== tile.id)]);
      choose(tile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const status = !loaded
    ? ""
    : custom
      ? t("Own image", "Eigenes Bild")
      : t("Automatic", "Automatisch");
  return (
    <section
      className={`hero-editor${open ? " is-open" : ""}`}
      aria-labelledby="hero-editor-title"
    >
      <button
        type="button"
        className="hero-editor-toggle"
        data-studio-panel="hero-cover"
        aria-expanded={open}
        aria-controls="hero-editor-panel"
        onClick={() => setOpen((value) => !value)}
      >
        {preview && (
          <img
            className="hero-editor-bg"
            src={preview.url}
            srcSet={preview.srcset}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
        )}
        <span className="hero-editor-shade" aria-hidden="true" />
        <span className="hero-editor-heading">
          <span className="edition-card-kicker" aria-hidden="true">{t("Homepage", "Startseite")}</span>
          <span id="hero-editor-title" className="hero-editor-title">
            <span className="sr-only">{t("Homepage ", "Startseite: ")}</span>
            {t("Cover", "Titelbild")}
          </span>
          {status && <span className="hero-editor-status">{status}</span>}
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
        <div id="hero-editor-panel" className="hero-editor-panel">
          <p className="hero-editor-lead">
            {t(
              "Choose a photograph and set the crop for each screen size. Without a choice, the featured photo essay's cover is used.",
              "Wähle ein Foto und lege den Ausschnitt für jede Bildschirmgröße fest. Ohne Auswahl erscheint das Titelbild des Fotoessays im Fokus.",
            )}
          </p>
          <h3 className="photo-folders-head">{t("Suggestions", "Vorschläge")}</h3>
          <div className="hero-editor-tiles" role="group" aria-label={t("Suggestions", "Vorschläge")}>
            {tiles.map((tile) => (
              <button
                type="button"
                key={tile.id}
                className="hero-editor-tile"
                aria-pressed={tile.id === photo?.id}
                aria-label={tile.alt || `${t("Photograph", "Foto")} ${tile.id}`}
                onClick={() => choose(tile)}
              >
                <img
                  src={tile.url}
                  srcSet={tile.srcset}
                  sizes="96px"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </button>
            ))}
            <button
              type="button"
              className="hero-editor-tile hero-editor-upload"
              disabled={busy === "upload"}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={20} strokeWidth={1.1} aria-hidden="true" />
              <span>
                {busy === "upload"
                  ? `${progress} %`
                  : t("Upload your own image", "Eigenes Bild hochladen")}
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg"
              className="hero-editor-sr"
              tabIndex={-1}
              onChange={upload}
            />
          </div>
          <PhotoFolders enabled={open} selectedId={photo?.id ?? null} onChoose={choose} />
          <div className="hero-editor-frames">
            {HERO_DEVICES.map((device) => (
              <FocusFrame
                key={device}
                device={device}
                photo={preview}
                focus={photo ? focus[device] : { x: 50, y: 50 }}
                disabled={!photo}
                onChange={(point) =>
                  setFocus((current) => ({ ...current, [device]: point }))
                }
              />
            ))}
          </div>
          {!photo && (
            <p className="hero-editor-note">
              {t(
                "Automatic: the cover of the featured photo essay. Pick a photograph to adjust the crop.",
                "Automatisch: Titelbild des Fotoessays im Fokus. Wähle ein Foto, um den Ausschnitt anzupassen.",
              )}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="hero-editor-actions">
            <button
              type="button"
              className="button"
              disabled={!photo || !dirty || busy !== ""}
              onClick={() => void save()}
            >
              {busy === "save" ? t("Saving…", "Speichern …") : t("Save", "Speichern")}
            </button>
            <button
              type="button"
              className="button button-outline"
              disabled={busy !== "" || (!custom && !photo)}
              onClick={() => void reset()}
            >
              {t("Reset", "Zurücksetzen")}
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
