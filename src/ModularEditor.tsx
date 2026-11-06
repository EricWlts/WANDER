import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  LayoutGrid,
  Monitor,
  Smartphone,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  Images,
  Settings2,
  Play,
  Globe,
  GripVertical,
} from "lucide-react";
import { imageParallax } from "./imageParallax";
import { ApiError, api, json } from "./api";
import { useApp, PageState } from "./App";
import { Field, Modal, Picture } from "./components";
import {
  JournalCanvas,
  moduleNames,
  modulePhotos,
  type Selection,
} from "./JournalCanvas";
import {
  AppearanceSettings,
  TypographySettings,
  WallSettings,
  RailSettings,
  MediaLayoutSettings,
} from "./ModuleSettings";
import { ModulePhotographs } from "./ModulePhotographs";
import {
  placementsFor,
  editionColors,
  mergeSavedJourney,
  sequenceIndex,
  rootPhotos,
  replaceSourceReferences,
} from "./journalModel";
import { HoverZoomControl } from "./HoverZoomControl";
import { ImageControls, ratios } from "./ImageControls";
import { Upload } from "./Upload";
import { useMotionOff } from "./Motion";
import { MotionControl } from "./MotionControl";
import { PhotoViewer } from "./StoryExperience";
import { t, useLocale } from "./I18n";
import { moveModule } from "./moduleOrder";
import { removeModuleFromDraft, selectionAfterModuleRemoval } from "./moduleDeletion";
import { moduleDropTarget, moduleScrollSpeed, moduleTransferTarget } from "./moduleDrag";
import {
  canRestoreRecovery,
  readRecoveries,
  removeRecovery,
  writeRecovery,
  type RecoveryCopy,
} from "./recoveryModel";
import type { Chapter, Journey, Layout, Photo } from "./types";

function recoveryStores(): Storage[] {
  return (["localStorage", "sessionStorage"] as const).flatMap((name) => {
    try {
      return [window[name]];
    } catch {
      return [];
    }
  });
}

async function withRecoveryLock<T>(id: number, action: () => T): Promise<T> {
  // Tabs using this editor serialize read/modify/write on the shared local slot.
  if (navigator.locks) return navigator.locks.request(`wander-recovery-${id}`, action);
  return action();
}

function PreviewFrame({
  mobile,
  children,
}: {
  mobile: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLIFrameElement>(null),
    outer = useRef<HTMLDivElement>(null),
    [body, setBody] = useState<HTMLElement | null>(null),
    [available, setAvailable] = useState(900);
  const { locale } = useLocale();
  const off = useMotionOff();
  const height = mobile ? 844 : 900;
  const width = mobile ? 390 : 1200,
    scale = Math.min(1, available / width);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setAvailable(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!body) return;
    const doc = body.ownerDocument;
    const sync = () => {
      doc.head.innerHTML = "";
      document
        .querySelectorAll('style,link[rel="stylesheet"]')
        .forEach((n) => doc.head.appendChild(n.cloneNode(true)));
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [body]);
  useEffect(() => {
    if (body) {
      body.ownerDocument.documentElement.lang = locale;
      body.ownerDocument.documentElement.dataset.motion = off ? "off" : "on";
    }
  }, [body, locale, off]);
  return (
    <div
      ref={outer}
      className="preview-scale"
      style={{ height: height * scale }}
    >
      <iframe
        ref={ref}
        className="preview-frame"
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        title={
          mobile
            ? t("Mobile preview", "Mobile Vorschau")
            : t("Desktop preview", "Desktopvorschau")
        }
        srcDoc={"<!doctype html><html><head></head><body></body></html>"}
        onLoad={() => {
          const doc = ref.current?.contentDocument;
          if (doc) {
            document
              .querySelectorAll('style,link[rel="stylesheet"]')
              .forEach((n) => doc.head.appendChild(n.cloneNode(true)));
            doc.body.className = "preview-document";
            setBody(doc.body);
          }
        }}
      >
        {body && createPortal(children, body)}
      </iframe>
    </div>
  );
}
const cleanChapter = (c: Chapter) => ({
  id: c.id,
  title: c.title,
  date: c.date || "",
  story: c.story || "",
  quote: c.quote || "",
  kind: c.kind,
  reveal: c.reveal || {},
  gallery_mode: c.gallery_mode || "editorial",
  layout: c.layout || {},
});
export function ModularEditor() {
  const navigate = useNavigate();
  const { slug } = useParams(),
    { notify } = useApp();
  useLocale();
  const [journey, setJourney] = useState<Journey | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploadBusy, setUploadBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [selected, select] = useState<Selection>({ type: "hero" }),
    [mode, setMode] = useState<"edit" | "visit">("edit"),
    [mobile, setMobile] = useState(window.innerWidth < 760),
    [picker, setPicker] = useState(false),
    [tab, setTab] = useState<"canvas" | "modules" | "settings">("canvas"),
    [previewReturn, setPreviewReturn] = useState(0),
    [replay, setReplay] = useState(0),
    [viewerPhotos, setViewerPhotos] = useState<Photo[]>([]),
    [viewer, setViewer] = useState<number | null>(null),
    [pending, setPending] = useState("");
  const [deletingModule, setDeletingModule] = useState<{ id: number; title: string; navigator: boolean } | null>(null);
  const deletingModuleRef = useRef(deletingModule);
  const deleteReturn = useRef<HTMLElement | null>(null);
  const [library, setLibrary] = useState(false),
    [discard, setDiscard] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false),
    [autoError, setAutoError] = useState(false),
    [replaceOpen, setReplaceOpen] = useState(false),
    [replaceCover, setReplaceCover] = useState(false),
    [deletingPhoto, setDeletingPhoto] = useState<Photo | null>(null),
    [deleteError, setDeleteError] = useState("");
  const [publishReview, setPublishReview] = useState<{
      content: string;
      revision: number;
    } | null>(null),
    [publishResult, setPublishResult] = useState<{
      title: string;
      slug: string;
    } | null>(null);
  const [addTarget, setAddTarget] = useState<number | null>(null),
    [chosenPhotos, setChosenPhotos] = useState<number[]>([]),
    [drag, setDrag] = useState<{
      id: number;
      target: number;
      after: boolean;
      inside?: boolean;
    } | null>(null);
  const dragStart = useRef<{
    id: number;
    y: number;
    active: boolean;
    pointerId: number;
    clientX: number;
    clientY: number;
    handle: HTMLButtonElement;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragTarget = useRef<typeof drag>(null);
  const dragFrame = useRef<number | null>(null);
  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelDrag();
    };
    const hidden = () => { if (document.hidden) cancelDrag(); };
    document.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", cancelDrag);
    return () => {
      cancelDrag();
      document.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", cancelDrag);
    };
  }, [mode, tab, slug]);
  const [conflicted, setConflicted] = useState(false);
  const conflictBanner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conflicted)
      conflictBanner.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [conflicted]);
  const conflictMessage = t(
    "This journey has changed since you opened it. Your draft is still here. Open the current version in another tab to compare and reapply your edits.",
    "Diese Reise wurde seit dem Öffnen geändert. Dein Entwurf ist noch da. Öffne den aktuellen Stand in einem anderen Tab, um zu vergleichen und deine Änderungen erneut zu übernehmen.",
  );
  function markConflict() {
    setConflicted(true);
    setError("");
    setPublishReview(null);
  }
  const [recoveries, setRecoveries] = useState<RecoveryCopy[]>([]);
  const ownedRecovery = useRef<RecoveryCopy | null>(null);
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);
  function refreshRecoveries(id: number) {
    const owned = ownedRecovery.current;
    setRecoveries(readRecoveries(recoveryStores(), id).filter(
      (copy) => copy.storage !== owned?.storage || copy.raw !== owned.raw,
    ));
  }
  function clearRecovery(copy: RecoveryCopy) {
    if (!removeRecovery(copy)) return false;
    if (ownedRecovery.current === copy) ownedRecovery.current = null;
    refreshRecoveries(copy.draft.id);
    return true;
  }
  const revision = useRef(0),
    saving = useRef(false);
  const saved = useRef<Journey | null>(null),
    draftRef = useRef(journey);
  draftRef.current = journey;
  useEffect(() => {
    let alive = true;
    api<Journey>(`/journeys/${slug}`)
      .then((j) => {
        if (alive) {
          setConflicted(false);
          saved.current = j;
          ownedRecovery.current = null;
          setDirty(false);
          refreshRecoveries(j.id);
          setJourney(j);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [slug]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!a || a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey)
        return;
      const url = new URL(a.href);
      if (
        url.origin === location.origin &&
        url.pathname !== location.pathname
      ) {
        e.preventDefault();
        e.stopPropagation();
        setPending(url.pathname + url.search);
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  // Preserve unfinished edits across an accidental reload, without replacing server data.
  useEffect(() => {
    if (!journey || !dirty) return;
    let active = true;
    void withRecoveryLock(journey.id, () => {
      if (!active) return;
      const copy = writeRecovery(recoveryStores(), journey, ownedRecovery.current);
      if (copy) ownedRecovery.current = copy;
      setRecoveryUnavailable(!copy);
    }).catch(() => {
      if (active) setRecoveryUnavailable(true);
    });
    return () => { active = false; };
  }, [journey, dirty]);
  useEffect(() => {
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    if (innerWidth <= 760 && tab !== "canvas") return;
    const frame = requestAnimationFrame(() => {
      const doc =
        document.querySelector<HTMLIFrameElement>(
          ".preview-frame",
        )?.contentDocument;
      if (!doc) return;
      const moduleId =
        selected.type === "module"
          ? selected.id
          : selected.type === "photo"
            ? selected.moduleId
            : undefined;
      let target: Element | null =
        moduleId !== undefined
          ? doc.getElementById(`canvas-module-${moduleId}`)
          : doc.querySelector(
              selected.type === "intro"
                ? ".journal-intro"
                : selected.type === "photo" && selected.context === "loose"
                  ? ".journal-loose"
                  : selected.type === "photo" &&
                      selected.context === "filmstrip"
                    ? ".journal-canvas > .filmstrip-section"
                    : ".journal-cover",
            );
      if (
        target &&
        selected.type === "photo" &&
        selected.placementId &&
        moduleId !== undefined &&
        journey
      ) {
        const chapter = journey.chapters.find((c) => c.id === moduleId);
        const index = chapter
          ? modulePhotos(chapter, journey).findIndex(
              (p) => p.placement_id === selected.placementId,
            )
          : -1;
        const figures = Array.from(
          target.querySelectorAll(
            "figure, .film-group:not(.film-duplicate) > .film-frame",
          ),
        ).filter((figure) => figure.closest(".journal-module") === target);
        if (index >= 0) target = figures[index] || target;
      }
      if (
        target &&
        selected.type === "photo" &&
        selected.placementId &&
        !moduleId &&
        journey &&
        (selected.context === "loose" || selected.context === "filmstrip")
      ) {
        const index = rootPhotos(journey, selected.context).findIndex(
          (p) => p.placement_id === selected.placementId,
        );
        if (index >= 0)
          target =
            target.querySelectorAll(
              "figure, .film-group:not(.film-duplicate) > .film-frame",
            )[index] || target;
      }
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, tab, previewReturn]);
  function change(patch: Partial<Journey>) {
    revision.current++;
    setAutoError(false);
    setJourney((j) => (j ? { ...j, ...patch } : j));
    setDirty(true);
  }
  function moduleChange(id: number, patch: Partial<Chapter>) {
    revision.current++;
    setAutoError(false);
    setJourney((j) =>
      j
        ? {
            ...j,
            chapters: j.chapters.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          }
        : j,
    );
    setDirty(true);
  }
  function photoChange(id: number, patch: Partial<Photo>) {
    revision.current++;
    setAutoError(false);
    setJourney((j) =>
      j
        ? {
            ...j,
            photos: j.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
            cover: j.cover?.id === id ? { ...j.cover, ...patch } : j.cover,
          }
        : j,
    );
    setDirty(true);
  }
  function layoutChange(id: number | null, patch: Partial<Layout>) {
    if (!journey) return;
    if (id === null) change({ layout: { ...journey.layout, ...patch } });
    else {
      const c = journey.chapters.find((c) => c.id === id);
      if (c) moduleChange(id, { layout: { ...c.layout, ...patch } });
    }
  }
  async function save(
    publish = false,
    silent = false,
  ): Promise<Journey | null> {
    const current = draftRef.current;
    if (!current || saving.current || uploadBusy || conflicted) return null;
    saving.current = true;
    const sentRevision = revision.current;
    setAutoError(false);
    if (silent) setBackgroundSaving(true);
    else setBusy(true);
    setError("");
    try {
      const next = await api<Journey>(
        `/journeys/${current.id}/composition`,
        json("PATCH", {
          base_version: current.composition_version,
          base_slug: current.slug,
          journey: {
            title: current.title,
            subtitle: current.subtitle,
            location: current.location,
            country: current.country,
            start_date: current.start_date,
            end_date: current.end_date,
            introduction: current.introduction,
            reflection: current.reflection,
            closing: current.closing,
            description: current.description,
            cover_id: current.cover_id,
            layout: current.layout || {},
            story_template: current.story_template,
            reveal_settings: current.reveal_settings,
          },
          chapters: current.chapters.map(cleanChapter),
          photo_order: current.photos.map((p) => p.id),
          photos: current.photos.map((p) => ({
            id: p.id,
            edits: p.edits || {},
            title: p.title,
            description: p.description,
            alt: p.alt,
            featured: p.featured,
          })),
          publish,
        }),
      );
      const changed = revision.current !== sentRevision;
      const idMap = new Map(
        current.chapters.map((c, i) => [c.id, next.chapters[i]?.id ?? c.id]),
      );
      select((active) =>
        active.type === "module"
          ? idMap.get(active.id) && idMap.get(active.id) !== active.id
            ? { ...active, id: idMap.get(active.id)! }
            : active
          : active.type === "photo" &&
              active.moduleId &&
              idMap.get(active.moduleId) !== active.moduleId &&
              idMap.has(active.moduleId)
            ? {
                ...active,
                moduleId: idMap.get(active.moduleId) ?? active.moduleId,
              }
            : active,
      );
      setAddTarget((target) =>
        target === null ? null : (idMap.get(target) ?? target),
      );
      if (deletingModuleRef.current) {
        const pending = deletingModuleRef.current;
        deletingModuleRef.current = { ...pending, id: idMap.get(pending.id) ?? pending.id };
        setDeletingModule(deletingModuleRef.current);
      }
      // Saving a new module replaces its keyed row. Cancel an in-flight gesture
      // before that replacement and return keyboard focus to the same module.
      const focusedHandle = document.activeElement;
      const focusedControl = focusedHandle?.classList.contains("module-delete-button") ? "module-delete-button" : "module-drag-handle";
      const focusedId = focusedHandle?.classList.contains(focusedControl)
        ? Number(
            (focusedHandle.closest("[data-module-id]") as HTMLElement)?.dataset
              .moduleId,
          )
        : null;
      if (
        dragStart.current &&
        idMap.get(dragStart.current.id) !== dragStart.current.id
      ) {
        cancelDrag();
      }
      if (
        focusedId !== null &&
        idMap.has(focusedId) &&
        idMap.get(focusedId) !== focusedId
      )
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLButtonElement>(
              `[data-module-id="${idMap.get(focusedId)}"] > .${focusedControl}`,
            )
            ?.focus({ preventScroll: true }),
        );
      if (imageReturn.current)
        imageReturn.current.moduleId =
          idMap.get(imageReturn.current.moduleId) ??
          imageReturn.current.moduleId;
      saved.current = next;
      setJourney((local) =>
        local && changed ? mergeSavedJourney(local, current, next) : next,
      );
      setDirty(changed);
      if (!changed) {
        try {
          await withRecoveryLock(current.id, () => {
            const copy = ownedRecovery.current;
            if (revision.current !== sentRevision || copy?.draft.id !== current.id) return;
            if (!clearRecovery(copy)) {
              ownedRecovery.current = null;
              refreshRecoveries(current.id);
            }
          });
        } catch {
          ownedRecovery.current = null;
          refreshRecoveries(current.id);
        }
      }
      if (publish) {
        setPublishReview(null);
        setPublishResult({ title: current.title, slug: next.slug });
      }
      if (!silent)
        notify(
          publish
            ? changed
              ? t(
                  "Reviewed version published. Newer changes remain in your draft.",
                  "Geprüfte Fassung veröffentlicht. Neuere Änderungen bleiben im Entwurf.",
                )
              : t(
                  "Reviewed version published.",
                  "Geprüfte Fassung veröffentlicht.",
                )
            : t("Draft saved.", "Entwurf gespeichert."),
        );
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.code === "composition_conflict") markConflict();
      else {
        setError((e as Error).message);
        setAutoError(true);
      }
      return null;
    } finally {
      saving.current = false;
      setBackgroundSaving(false);
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!dirty || busy || backgroundSaving || uploadBusy || autoError || conflicted) return;
    const timer = setTimeout(() => void save(false, true), 850);
    return () => clearTimeout(timer);
  }, [journey, dirty, busy, backgroundSaving, uploadBusy, autoError, conflicted]);
  function nextModuleId() {
    return (
      Math.min(
        -Date.now(),
        ...(draftRef.current?.chapters.map((c) => c.id) || []),
      ) - 1
    );
  }
  function add(kind: Chapter["kind"]) {
    if (!journey) return;
    const parent =
      selected.type === "module"
        ? journey.chapters.find((c) => c.id === selected.id)
        : undefined;
    const day =
      kind !== "chapter"
        ? parent?.kind === "chapter"
          ? parent.id
          : parent?.layout?.parent_id
        : undefined;
    const c: Chapter = {
      id: nextModuleId(),
      kind,
      title: t(...moduleNames[kind]),
      date: kind === "chapter" ? journey.start_date : "",
      story: "",
      quote: "",
      position: journey.chapters.length,
      reveal: {
        effect: kind === "text" || kind === "quote" ? "none" : "fade",
        duration: 1000,
      },
      gallery_mode: "editorial",
      layout: {
        edition: "inherit",
        ...(day ? { parent_id: day } : {}),
        ...(kind === "pair" ? { columns: 2 } : {}),
        ...(kind === "wall" ? { columns: 4, rows: 4, gap: 12 } : {}),
        ...(kind === "hero" ? { parallax: true, title_style: "overlay" } : {}),
        show_title: ![
          "image",
          "pair",
          "rail",
          "filmstrip",
          "wall",
          "gallery",
        ].includes(kind),
      },
    };
    change({ chapters: [...journey.chapters, c] });
    select({ type: "module", id: c.id });
    setPicker(false);
    setTab("settings");
  }
  function requestModuleRemoval(id: number, trigger: HTMLElement, navigator = false) {
    const current = draftRef.current;
    const chapter = current?.chapters.find((c) => c.id === id);
    if (!chapter) return;
    cancelDrag();
    deleteReturn.current = trigger;
    deletingModuleRef.current = { id, title: chapter.title, navigator };
    setDeletingModule(deletingModuleRef.current);
  }
  function closeModuleRemoval() {
    const pending = deletingModuleRef.current;
    deletingModuleRef.current = null;
    setDeletingModule(null);
    requestAnimationFrame(() => {
      const original = deleteReturn.current;
      if (original?.isConnected) original.focus({ preventScroll: true });
      else if (pending) document.querySelector<HTMLButtonElement>(
        `.module-navigator [data-module-id="${pending.id}"] > .module-delete-button`,
      )?.focus({ preventScroll: true });
    });
  }
  function remove(id: number) {
    cancelDrag();
    const current = draftRef.current;
    if (!current) return;
    const visible = current.chapters.filter((c) => !c.layout?.parent_id).flatMap((c) =>
      [c, ...current.chapters.filter((child) => child.layout?.parent_id === c.id)],
    );
    const index = visible.findIndex((c) => c.id === id);
    const neighbor = visible[index + 1] || visible[index - 1];
    const navigator = deletingModuleRef.current?.navigator;
    const next = removeModuleFromDraft(current, id);
    if (next !== current) {
      draftRef.current = next;
      change({ chapters: next.chapters, photos: next.photos });
      select((active) => selectionAfterModuleRemoval(active, id));
      if (imageReturn.current?.moduleId === id) imageReturn.current = null;
      setAddTarget((target) => target === id ? null : target);
    }
    deletingModuleRef.current = null;
    setDeletingModule(null);
    if (window.innerWidth < 760) setTab("modules");
    requestAnimationFrame(() => {
      const target = navigator && neighbor
        ? document.querySelector<HTMLButtonElement>(
            `.module-navigator [data-module-id="${neighbor.id}"] > .module-delete-button`,
          )
        : document.querySelector<HTMLButtonElement>(".module-navigator .cover-nav");
      target?.focus({ preventScroll: true });
    });
  }
  function duplicate(c: Chapter) {
    if (!journey) return;
    const copy = {
      ...c,
      id: nextModuleId(),
      layout: {
        ...c.layout,
        placements: placementsFor(c, journey).map((f) => ({
          ...f,
          id: crypto.randomUUID(),
        })),
      },
    };
    const list = [...journey.chapters];
    const children =
      c.kind === "chapter"
        ? journey.chapters
            .filter((child) => child.layout?.parent_id === c.id)
            .map((child, index) => ({
              ...child,
              id: copy.id - index - 1,
              layout: {
                ...child.layout,
                parent_id: copy.id,
                placements: placementsFor(child, journey).map((f) => ({
                  ...f,
                  id: crypto.randomUUID(),
                })),
              },
            }))
        : [];
    list.splice(list.findIndex((m) => m.id === c.id) + 1, 0, copy, ...children);
    change({ chapters: list });
    select({ type: "module", id: copy.id });
  }
  function focusMoveHandle(id: number, reveal = false) {
    requestAnimationFrame(() => {
      const handle = document.querySelector<HTMLButtonElement>(
        `.module-navigator [data-module-id="${id}"] > .module-drag-handle`,
      );
      handle?.focus({ preventScroll: true });
      if (reveal) handle?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }
  function announceMove(chapters: Chapter[], id: number) {
    const source = chapters.find((c) => c.id === id);
    if (!source) return;
    const peers = chapters.filter(
      (c) => (c.layout?.parent_id || null) === (source.layout?.parent_id || null),
    );
    setMoveAnnouncement(`${source.title}: ${t("Position", "Position")} ${peers.indexOf(source) + 1} ${t("of", "von")} ${peers.length}`);
  }
  function reorder(id: number, dir: number, fromHandle = false) {
    cancelDrag();
    const current = draftRef.current;
    if (!current) return;
    const source = current.chapters.find((c) => c.id === id);
    if (!source) return;
    const siblings = current.chapters.filter(
      (c) =>
        (c.layout?.parent_id || null) === (source.layout?.parent_id || null),
    );
    const target = siblings[siblings.indexOf(source) + dir];
    if (target) {
      const chapters = moveModule(current.chapters, id, target.id, dir > 0);
      change({ chapters });
      announceMove(chapters, id);
      if (fromHandle) focusMoveHandle(id, true);
    }
  }

  function cancelDrag() {
    const start = dragStart.current;
    dragStart.current = null;
    dragTarget.current = null;
    setDraggingId(null);
    if (start?.active)
      setMoveAnnouncement(t("Move cancelled.", "Verschieben abgebrochen."));
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
    setDrag(null);
    if (start?.handle.hasPointerCapture(start.pointerId))
      start.handle.releasePointerCapture(start.pointerId);
  }
  function updateDragTarget() {
    const start = dragStart.current;
    const current = draftRef.current;
    if (!start?.active || !current) return;
    const source = current.chapters.find((c) => c.id === start.id);
    const panel = start.handle.closest<HTMLElement>(".module-navigator");
    if (!source || !panel) return;
    const bounds = panel.getBoundingClientRect();
    const inside = start.clientX >= bounds.left && start.clientX <= bounds.right &&
      start.clientY >= Math.max(0, bounds.top) &&
      start.clientY <= Math.min(window.innerHeight, bounds.bottom);
    const peers = new Set(current.chapters.filter((c) =>
      source.kind !== "chapter" || !c.layout?.parent_id,
    ).map((c) => c.id));
    const rows = Array.from(panel.querySelectorAll<HTMLElement>("[data-module-id]"))
      .filter((row) => peers.has(Number(row.dataset.moduleId)))
      .map((row) => {
        const chapter = current.chapters.find((c) => c.id === Number(row.dataset.moduleId));
        const rect = (source.kind === "chapter" ? row : row.querySelector(".module-nav-select") || row).getBoundingClientRect();
        return { id: Number(row.dataset.moduleId), top: rect.top, bottom: rect.bottom, chapter: chapter?.kind === "chapter" };
      });
    const target: typeof drag = inside ? (source.kind === "chapter"
      ? moduleDropTarget(rows, start.id, start.clientY)
      : moduleTransferTarget(rows, start.id, start.clientY)) : null;
    const old = dragTarget.current;
    dragTarget.current = target;
    if (old?.id !== target?.id || old?.target !== target?.target || old?.after !== target?.after || old?.inside !== target?.inside)
      setDrag(target);
  }
  function startDragScroll() {
    let previous = performance.now();
    const frame = (now: number) => {
      const start = dragStart.current;
      if (!start?.active) return;
      const panel = start.handle.closest<HTMLElement>(".module-navigator");
      if (!panel) { cancelDrag(); return; }
      const bounds = panel.getBoundingClientRect();
      // On mobile the navigator grows with the document; desktop owns its scroll.
      const ownScroll = panel.scrollHeight > panel.clientHeight + 1;
      const scroller = ownScroll ? panel : document.scrollingElement;
      const insideX = start.clientX >= bounds.left && start.clientX <= bounds.right;
      const speed = insideX ? moduleScrollSpeed(start.clientY,
        Math.max(0, bounds.top), Math.min(window.innerHeight, bounds.bottom)) : 0;
      if (scroller && speed) {
        scroller.scrollTo({
          top: scroller.scrollTop + speed * Math.min(32, now - previous) / 1000,
          behavior: "instant",
        });
      }
      previous = now;
      updateDragTarget();
      dragFrame.current = requestAnimationFrame(frame);
    };
    dragFrame.current = requestAnimationFrame(frame);
  }
  function uploaded(value: Journey) {
    saved.current = value;
    setJourney((j) =>
      j
        ? {
            ...j,
            photos: [
              ...j.photos,
              ...value.photos.filter((p) => !j.photos.some((old) => old.id === p.id)),
            ],
            chapters: j.chapters.map((c) => {
              const added = value.photos.filter(
                (p) =>
                  p.chapter_id === c.id &&
                  !j.photos.some((old) => old.id === p.id),
              );
              if (c.layout?.placements && added.length) {
                const server = value.chapters.find((m) => m.id === c.id);
                return {
                  ...c,
                  layout: {
                    ...c.layout,
                    placements: [
                      ...c.layout.placements,
                      ...(server?.layout?.placements || []).filter((f) =>
                        added.some((p) => p.id === f.photo_id),
                      ),
                    ],
                  },
                };
              }
              return c.layout?.photo_ids && added.length
                ? {
                    ...c,
                    layout: {
                      ...c.layout,
                      photo_ids: [
                        ...c.layout.photo_ids,
                        ...added.map((p) => p.id),
                      ],
                    },
                  }
                : c;
            }),
            cover_id: j.cover_id ?? value.cover_id,
            cover: j.cover || value.cover,
            composition_version: value.composition_version,
            has_unpublished_changes: value.has_unpublished_changes,
          }
        : value,
    );
  }
  const imageHistory = useRef(crypto.randomUUID()),
    imageReturn = useRef<{
      moduleId: number;
      pageY: number;
      inspectorY: number;
      placementId?: string;
    } | null>(null),
    restoring = useRef(false);
  function restoreModule() {
    const back = imageReturn.current;
    if (!back) return;
    restoring.current = true;
    select({ type: "module", id: back.moduleId });
    setTab("settings");
    requestAnimationFrame(() => {
      const panel = document.querySelector(".module-inspector");
      if (panel) panel.scrollTop = back.inspectorY;
      window.scrollTo({ top: back.pageY, behavior: "instant" });
      if (back.placementId)
        document
          .querySelector<HTMLButtonElement>(
            `[data-placement-id="${back.placementId}"]`,
          )
          ?.focus({ preventScroll: true });
    });
    imageReturn.current = null;
  }
  useEffect(() => {
    const pop = () => {
      if (
        imageReturn.current &&
        history.state?.wanderImageEditor !== imageHistory.current
      )
        restoreModule();
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const module =
    selected.type === "module"
      ? journey?.chapters.find((c) => c.id === selected.id)
      : undefined;
  const selectedPhoto =
    selected.type === "photo"
      ? journey?.photos.find((p) => p.id === selected.id)
      : undefined;
  const photoModule =
    selected.type === "photo" && selected.moduleId
      ? journey?.chapters.find((c) => c.id === selected.moduleId)
      : undefined;
  const photo =
    selectedPhoto && photoModule
      ? modulePhotos(photoModule, journey!).find((p) =>
          selected.type === "photo" && selected.placementId
            ? p.placement_id === selected.placementId
            : p.id === selectedPhoto.id,
        ) || selectedPhoto
      : selectedPhoto &&
          selected.type === "photo" &&
          (selected.context === "loose" || selected.context === "filmstrip")
        ? rootPhotos(journey!, selected.context).find(
            (p) => p.placement_id === selected.placementId,
          ) || selectedPhoto
        : selectedPhoto;
  const layout = module?.layout || journey?.layout || {};
  if (!journey)
    return (
      <PageState
        title={
          error
            ? t("This journey is out of reach.")
            : t("Opening the editor…", "Editor wird geöffnet…")
        }
        text={error || undefined}
      />
    );
  const j = journey;
  const selectionLabel = photo
    ? `${photo.title === "Untitled photograph" ? t("Photograph", "Foto") : photo.title}${photoModule ? ` · ${photoModule.title || t(...moduleNames[photoModule.kind])} · ${modulePhotos(photoModule, j).findIndex((p) => p.placement_id === photo.placement_id) + 1}` : ""}`
    : selected.type === "intro"
      ? t("Introduction", "Einleitung")
      : module?.title || j.title;
  const selectCanvas = (s: Selection) => {
    if (s.type === "photo" && s.moduleId) {
      if (history.state?.wanderImageEditor !== imageHistory.current) {
        imageReturn.current = {
          moduleId: s.moduleId,
          placementId: s.placementId,
          pageY: window.scrollY,
          inspectorY:
            document.querySelector(".module-inspector")?.scrollTop || 0,
        };
        history.pushState(
          {
            ...history.state,
            idx: (history.state?.idx || 0) + 1,
            wanderImageEditor: imageHistory.current,
          },
          "",
        );
      }
    }
    select(s);
    setTab("settings");
  };
  function returnToModule() {
    if (history.state?.wanderImageEditor === imageHistory.current)
      history.back();
    else restoreModule();
  }
  function replacePhoto(p: Photo, uploadedJourney?: Journey) {
    if (
      replaceCover ||
      selected.type === "hero" ||
      (selected.type === "photo" && selected.context === "cover")
    ) {
      change({ cover_id: p.id, cover: p });
      if (selected.type === "photo") select({ ...selected, id: p.id });
    } else if (selected.type === "photo" && photoModule) {
      const frames = placementsFor(photoModule, j);
      const target =
        selected.placementId ||
        frames.find((f) => f.photo_id === selected.id)?.id;
      layoutChange(photoModule.id, {
        placements: frames.map((f) =>
          f.id === target ? { ...f, photo_id: p.id, edits: {} } : f,
        ),
      });
      select({ ...selected, id: p.id, placementId: target });
    } else if (
      selected.type === "photo" &&
      (selected.context === "loose" || selected.context === "filmstrip")
    ) {
      const key =
        selected.context === "loose" ? "placements" : "filmstrip_placements";
      layoutChange(null, {
        [key]: rootPhotos(j, selected.context).map((f) => ({
          id: f.placement_id!,
          photo_id: f.placement_id === selected.placementId ? p.id : f.id,
          edits: f.placement_id === selected.placementId ? {} : f.edits,
        })),
      });
      select({ ...selected, id: p.id });
    } else if (selected.type === "photo") {
      const base = uploadedJourney
        ? {
            ...j,
            photos: uploadedJourney.photos.map(
              (p) => j.photos.find((old) => old.id === p.id) || p,
            ),
          }
        : j;
      change(replaceSourceReferences(base, selected.id, p.id));
      select({ ...selected, id: p.id });
    }
    setReplaceOpen(false);
    setReplaceCover(false);
  }
  function removePlacement() {
    if (selected.type !== "photo") return;
    if (photoModule) {
      layoutChange(photoModule.id, {
        placements: placementsFor(photoModule, j).filter(
          (f) => f.id !== selected.placementId,
        ),
      });
      returnToModule();
    } else if (
      selected.context === "loose" ||
      selected.context === "filmstrip"
    ) {
      const key =
        selected.context === "loose" ? "placements" : "filmstrip_placements";
      layoutChange(null, {
        [key]: rootPhotos(j, selected.context)
          .filter((p) => p.placement_id !== selected.placementId)
          .map((p) => ({
            id: p.placement_id!,
            photo_id: p.id,
            edits: p.edits,
          })),
      });
      select({ type: "hero" });
    }
  }
  async function deleteSource() {
    if (!deletingPhoto || saving.current || uploadBusy || conflicted) return;
    setDeleteError("");
    const beforeSave = revision.current;
    const base = dirty ? await save(false, true) : draftRef.current;
    if (!base || revision.current !== beforeSave) return;
    setBusy(true);
    try {
      const next = await api<Journey>(`/photos/${deletingPhoto.id}`, {
        method: "DELETE",
        headers: {
          "X-Composition-Version": String(base.composition_version ?? 0),
          "X-Composition-Journey": base.slug,
        },
      });
      saved.current = next;
      setJourney(next);
      setDirty(false);
      setDeletingPhoto(null);
      if (selected.type === "photo" && selected.id === deletingPhoto.id) {
        if (imageReturn.current) returnToModule();
        else select({ type: "hero" });
      }
      notify(t("Photograph deleted.", "Foto gelöscht."));
    } catch (e) {
      if (e instanceof ApiError && e.code === "composition_conflict") {
        markConflict();
        setDeletingPhoto(null);
      } else {
        setDeleteError((e as Error).message);
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }
  const imageUses =
    (j.photos.some((p) => p.id === j.cover_id) || j.cover ? 1 : 0) +
    rootPhotos(j, "loose").length +
    rootPhotos(j, "filmstrip").length +
    j.chapters.reduce((total, chapter) => {
      const count = modulePhotos(chapter, j).length;
      return (
        total +
        (chapter.kind === "hero" || chapter.kind === "image"
          ? Math.min(1, count)
          : count)
      );
    }, 0);
  const reviewChanged =
    publishReview !== null &&
    (publishReview.content !== JSON.stringify(j) ||
      publishReview.revision !== revision.current);
  const status = autoError
    ? t("Save failed · retry", "Speichern fehlgeschlagen · erneut versuchen")
    : backgroundSaving
      ? t("Saving draft…", "Entwurf wird gespeichert…")
      : dirty
        ? t("Unsaved changes", "Ungespeicherte Änderungen")
        : j.has_unpublished_changes
          ? t(
              "Draft saved · unpublished changes",
              "Entwurf gespeichert · Änderungen unveröffentlicht",
            )
          : j.published
            ? t("Saved & published", "Gespeichert & veröffentlicht")
            : t("Private draft saved", "Privater Entwurf gespeichert");
  const moduleList = (parent?: number) =>
    j.chapters
      .filter((c) => (c.layout?.parent_id || undefined) === parent)
      .map((c) => (
        <div
          key={c.id}
          data-module-id={c.id}
          className={`module-nav-item ${draggingId === c.id ? "module-dragging" : ""} ${drag?.target === c.id ? (drag.inside ? "module-drop-inside" : drag.after ? "module-drop-after" : "module-drop-before") : ""}`}
        >
          <button
            type="button"
            className="module-drag-handle"
            aria-label={`${t("Move module", "Modul verschieben")}: ${c.title}`}
            title={t(
              "Drag to reorder; use Up/Down keys",
              "Zum Verschieben ziehen; Pfeiltasten oben/unten verwenden",
            )}
            aria-describedby="module-reorder-help"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                reorder(c.id, e.key === "ArrowUp" ? -1 : 1, true);
              }
              if (e.key === "Escape") cancelDrag();
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 || !e.isPrimary || dragStart.current) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              e.currentTarget.focus({ preventScroll: true });
              dragStart.current = {
                id: c.id, y: e.clientY, active: false, pointerId: e.pointerId,
                clientX: e.clientX, clientY: e.clientY, handle: e.currentTarget,
              };
            }}
            onPointerMove={(e) => {
              const start = dragStart.current;
              if (!start || start.id !== c.id || start.pointerId !== e.pointerId) return;
              start.clientX = e.clientX;
              start.clientY = e.clientY;
              if (!start.active) {
                if (Math.abs(e.clientY - start.y) < 6) return;
                start.active = true;
                setDraggingId(c.id);
                setMoveAnnouncement(t("Moving module. Escape to cancel.", "Modul wird verschoben. Escape zum Abbrechen."));
                startDragScroll();
              }
              updateDragTarget();
            }}
            onPointerUp={(e) => {
              const start = dragStart.current;
              if (!start || start.pointerId !== e.pointerId) return;
              const target = dragTarget.current;
              const current = draftRef.current;
              cancelDrag();
              // Commit exactly the previewed slot; a release alone never starts a drag.
              if (start.active && target && current) {
                const panel = start.handle.closest<HTMLElement>(".module-navigator");
                const bounds = panel?.getBoundingClientRect();
                if (bounds && e.clientX >= bounds.left && e.clientX <= bounds.right &&
                    e.clientY >= Math.max(0, bounds.top) &&
                    e.clientY <= Math.min(window.innerHeight, bounds.bottom)) {
                  const chapters = moveModule(current.chapters, target.id, target.target, target.after, target.inside ? "inside" : "transfer");
                  if (chapters !== current.chapters) {
                    change({ chapters });
                    announceMove(chapters, start.id);
                    focusMoveHandle(start.id);
                  }
                }
              }
            }}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
          >
            <GripVertical size={16} />
          </button>
          <button
            title={c.title}
            className={`module-nav-select ${selected.type === "module" && selected.id === c.id ? "active" : ""}`}
            onClick={() => {
              select({ type: "module", id: c.id });
              setTab("settings");
            }}
          >
            <span>{t(...moduleNames[c.kind])}</span>
            <strong>{c.title}</strong>
          </button>
          <button
            type="button"
            className="module-delete-button"
            aria-label={`${t("Delete module", "Modul löschen")}: ${c.title}`}
            title={t("Delete module", "Modul löschen")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              requestModuleRemoval(c.id, e.currentTarget, true);
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
          {c.kind === "chapter" && (
            <div className="module-nav-children">{moduleList(c.id)}</div>
          )}
        </div>
      ));
  const moduleIndex = module
    ? j.chapters
        .filter(
          (c) =>
            (c.layout?.parent_id || null) ===
            (module.layout?.parent_id || null),
        )
        .findIndex((c) => c.id === module.id)
    : 0;
  return (
    <main
      id="main"
      className={`modular-studio studio-tab-${tab} ${mode === "visit" ? "visitor-preview" : ""}`}
    >
      <header className="editor-bar">
        <div className="editor-identity">
          <Link
            to="/"
            className="editor-brand"
            aria-label={t("WANDER home", "WANDER Startseite")}
          >
            <img
              src="/assets/brand/logos/wander-monogram-black.svg"
              width="32"
              height="32"
              alt=""
            />
          </Link>
          <Link
            to="/studio"
            aria-label={t("Back to studio", "Zurück zum Studio")}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <strong>{j.title}</strong>
            <span role="status">
              <i className={dirty ? "dirty" : ""} />
              {status}
            </span>
          </div>
        </div>
        <div
          className="editor-devices"
          aria-label={t("Preview size", "Vorschaugröße")}
        >
          <button
            className={!mobile ? "active" : ""}
            aria-pressed={!mobile}
            aria-label={t("Desktop preview", "Desktopvorschau")}
            onClick={() => setMobile(false)}
          >
            <Monitor size={18} />
          </button>
          <button
            className={mobile ? "active" : ""}
            aria-pressed={mobile}
            aria-label={t("Mobile preview", "Mobile Vorschau")}
            onClick={() => setMobile(true)}
          >
            <Smartphone size={18} />
          </button>
        </div>
        <div className="editor-actions">
          <button
            aria-label={
              mode === "edit"
                ? t("Visitor preview", "Besuchervorschau")
                : t("Edit", "Bearbeiten")
            }
            className="editor-mode"
            onClick={() => setMode(mode === "edit" ? "visit" : "edit")}
            aria-pressed={mode === "visit"}
          >
            {mode === "edit" ? <Eye size={17} /> : <Pencil size={17} />}
            <span>
              {mode === "edit"
                ? t("Visitor preview", "Besuchervorschau")
                : t("Edit", "Bearbeiten")}
            </span>
          </button>
          <button
            aria-label={t("Save draft", "Entwurf speichern")}
            className="button button-outline"
            disabled={
              busy ||
              backgroundSaving ||
              uploadBusy ||
              conflicted ||
              (!dirty && !j.has_unpublished_changes)
            }
            onClick={() => void save()}
          >
            <Save size={16} />
            <span>
              {busy ? t("Saving…", "Speichern…") : t("Save", "Speichern")}
            </span>
          </button>
          <button
            aria-label={t("Publish journey", "Reise veröffentlichen")}
            className="button"
            disabled={busy || backgroundSaving || uploadBusy || conflicted}
            onClick={() => {
              if (saving.current || busy || backgroundSaving || uploadBusy)
                return;
              setPublishReview({
                content: JSON.stringify(draftRef.current),
                revision: revision.current,
              });
            }}
          >
            <Globe size={16} />
            <span>{t("Publish", "Veröffentlichen")}</span>
          </button>
        </div>
      </header>
      {conflicted && (
        <div className="editor-error" role="alert" ref={conflictBanner}>
          {conflictMessage}
        </div>
      )}
      {error && (
        <div className="editor-error" role="alert">
          {error}
          {autoError && (
            <button
              onClick={() => void save()}
              disabled={busy || backgroundSaving}
            >
              {t("Retry saving", "Speichern erneut versuchen")}
            </button>
          )}
          <button
            onClick={() => setError("")}
            aria-label={t("Dismiss", "Schließen")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {dirty && recoveryUnavailable && (
        <div className="editor-error" role="status">
          {t(
            "This browser could not back up your current changes. Save before leaving.",
            "Dieser Browser konnte deine aktuellen Änderungen nicht lokal sichern. Speichere vor dem Verlassen.",
          )}
        </div>
      )}
      {recoveries.map((recovery, index) => (
        <div className="recovery-banner" key={index}>
          {recoveries.length > 1 && <strong>{recovery.draft.title}</strong>}
          {canRestoreRecovery(recovery.draft, j) && !conflicted ? (
            <>
              {t(
                "Unfinished changes are available from your last session.",
                "Es gibt offene Änderungen aus deiner letzten Sitzung.",
              )}
              <button
                disabled={dirty || busy || backgroundSaving || uploadBusy}
                onClick={() => {
                  if (dirty || saving.current || busy || uploadBusy) return;
                  const available = readRecoveries(recoveryStores(), j.id).some(
                    (copy) => copy.storage === recovery.storage && copy.raw === recovery.raw,
                  );
                  if (!available) {
                    refreshRecoveries(j.id);
                    return;
                  }
                  revision.current++;
                  ownedRecovery.current = recovery;
                  setJourney(recovery.draft);
                  select({ type: "hero" });
                  setAutoError(false);
                  setDirty(true);
                  setRecoveries((copies) => copies.filter((copy) => copy !== recovery));
                }}
              >
                {t("Restore", "Wiederherstellen")}
              </button>
            </>
          ) : (
            <>
              {t(
                "This local draft has a different or unknown starting version, or its photo sources have changed. Download a copy to compare and reapply your changes to the current version.",
                "Dieser lokale Entwurf hat eine andere oder unbekannte Ausgangsversion oder seine Fotoquellen haben sich geändert. Lade eine Kopie herunter, um zu vergleichen und Änderungen im aktuellen Stand erneut zu übernehmen.",
              )}
              <button
                onClick={() => {
                  const url = URL.createObjectURL(new Blob([recovery.raw], { type: "application/json" }));
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${j.slug}-draft.json`;
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                {t("Download draft", "Entwurf herunterladen")}
              </button>
            </>
          )}
          <button
            onClick={async () => {
              const cleared = await withRecoveryLock(j.id, () => clearRecovery(recovery)).catch(() => false);
              if (!cleared)
                setError(t("The local draft could not be discarded.", "Der lokale Entwurf konnte nicht verworfen werden."));
            }}
          >
            {t("Discard local draft", "Lokalen Entwurf verwerfen")}
          </button>
        </div>
      ))}
      <div className="studio-workspace" inert={busy || undefined}>
        {mode === "edit" && (
          <aside className="module-navigator">
            <p id="module-reorder-help" className="sr-only">
              {t("Drag the handle to reorder or move into a chapter. Up and Down keys reorder within the group. Escape cancels dragging. Chapter placement is also available in module settings.", "Am Griff ziehen, um umzusortieren oder in ein Kapitel zu verschieben. Pfeiltasten oben und unten sortieren innerhalb der Gruppe. Escape bricht das Ziehen ab. Die Kapitelzuordnung ist auch in den Moduleinstellungen verfügbar.")}
            </p>
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{moveAnnouncement}</p>
            <div className="panel-heading">
              <span>{t("Your story", "Deine Geschichte")}</span>
              <LayoutGrid size={17} />
            </div>
            <button
              className={`cover-nav ${selected.type === "hero" ? "active" : ""}`}
              onClick={() => {
                select({ type: "hero" });
                setTab("settings");
              }}
            >
              {t("Journey cover", "Reisetitelbild")}
            </button>
            {moduleList()}
            <button
              className="add-module-button"
              onClick={() => setPicker(true)}
            >
              <Plus size={17} />
              {t("Add module", "Modul hinzufügen")}
            </button>
            <button className="library-button" onClick={() => setLibrary(true)}>
              <Images size={17} />
              {t("Photographs", "Fotosammlung")}
              <span>{j.photos.length}</span>
            </button>
          </aside>
        )}
        <div className="canvas-area">
          {mode === "edit" && (
            <div className="canvas-selection">
              <span>
                {t("Selected", "Ausgewählt")}: {selectionLabel}
              </span>
              <button
                type="button"
                className="text-link"
                onClick={() => setTab("settings")}
              >
                {t("Edit selection", "Auswahl bearbeiten")}
              </button>
            </div>
          )}
          <div className="canvas-context">
            {mode === "edit" ? (
              <button
                className="collection-shortcut"
                onClick={() => setLibrary(true)}
              >
                <Images size={16} />
                {t("Photographs", "Fotosammlung")}
              </button>
            ) : (
              <span>
                {t(
                  "Visitor preview · editing tools hidden",
                  "Besuchervorschau · Bearbeitungswerkzeuge ausgeblendet",
                )}
              </span>
            )}
            {mode === "edit" && (
              <button onClick={() => setReplay((v) => v + 1)}>
                <Play size={13} />
                {t("Replay motion", "Bewegung abspielen")}
              </button>
            )}
          </div>
          <div className={`canvas-device ${mobile ? "device-mobile" : ""}`}>
            <PreviewFrame mobile={mobile}>
              <JournalCanvas
                journey={j}
                editing={mode === "edit"}
                selected={selected}
                onSelect={selectCanvas}
                onEmptyModule={(id) => {
                  selectCanvas({ type: "module", id });
                  setAddTarget(id);
                  setChosenPhotos([]);
                }}
                onPhoto={(p, sequence = j.photos) => {
                  setViewerPhotos(sequence);
                  setViewer(sequenceIndex(sequence, p));
                }}
                replay={replay}
              />
            </PreviewFrame>
          </div>
          {mode === "edit" && (
            <button className="canvas-add" onClick={() => setPicker(true)}>
              <Plus size={18} />
              {t("Add a moment", "Einen Moment hinzufügen")}
            </button>
          )}
        </div>
        {mode === "edit" && (
          <aside className="module-inspector">
            <div className="panel-heading">
              <span>
                {photo
                  ? t("Photograph", "Foto")
                  : module
                    ? t(...moduleNames[module.kind])
                    : selected.type === "intro"
                      ? t("Introduction", "Einleitung")
                      : t("Journey cover", "Reisetitelbild")}
              </span>
              <Settings2 size={17} />
            </div>
            <div className="inspector-body">
              <div className="inspector-selection">
                {photo && (
                  <>
                    <span>
                      {t("This image placement", "Diese Bildverwendung")}
                    </span>
                    <strong>{selectionLabel}</strong>
                  </>
                )}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setTab("canvas");
                    setPreviewReturn((value) => value + 1);
                  }}
                >
                  {t(
                    "Show selection in preview",
                    "Auswahl in der Vorschau zeigen",
                  )}
                </button>
              </div>
              <h3 className="inspector-group-title">
                {module && !["text", "quote"].includes(module.kind)
                  ? t("Image content", "Bildinhalt")
                  : t("Content", "Inhalt")}
              </h3>
              {photo ? (
                <>
                  {photoModule && (
                    <button className="back-to-module" onClick={returnToModule}>
                      <ArrowLeft size={17} />
                      {photoModule.kind === "wall"
                        ? t("Back to photo wall", "Zurück zur Fotowand")
                        : t("Back to module", "Zurück zum Modul")}
                    </button>
                  )}
                  <button
                    className="button button-outline"
                    onClick={() => {
                      setReplaceCover(false);
                      setReplaceOpen(true);
                    }}
                  >
                    <Images size={16} />
                    {t("Choose / upload image", "Bild auswählen / hochladen")}
                  </button>
                  {photoModule && (
                    <p className="inspector-note">
                      {t(
                        "Crop adjustments apply only to this image placement, including when the same source is used again. Titles and descriptions belong to the source photograph.",
                        "Zuschnittänderungen gelten nur für diese Bildverwendung, auch bei mehrfach verwendeter Quelle. Titel und Beschreibungen gehören zum Ausgangsfoto.",
                      )}
                    </p>
                  )}
                  <ImageControls
                    photo={photo}
                    onChange={(p) => {
                      if (p.edits && photoModule) {
                        layoutChange(photoModule.id, {
                          placements: placementsFor(photoModule, j).map((f) =>
                            f.id === photo.placement_id
                              ? { ...f, edits: p.edits }
                              : f,
                          ),
                        });
                      } else if (
                        p.edits &&
                        selected.type === "photo" &&
                        (selected.context === "loose" ||
                          selected.context === "filmstrip")
                      ) {
                        const key =
                          selected.context === "loose"
                            ? "placements"
                            : "filmstrip_placements";
                        layoutChange(null, {
                          [key]: rootPhotos(j, selected.context).map((f) => ({
                            id: f.placement_id!,
                            photo_id: f.id,
                            edits:
                              f.placement_id === selected.placementId
                                ? p.edits
                                : f.edits,
                          })),
                        });
                      } else photoChange(photo.id, p);
                    }}
                  />
                  <div className="photo-delete-actions">
                    {(photoModule ||
                      (selected.type === "photo" &&
                        ["loose", "filmstrip"].includes(
                          selected.context || "",
                        ))) && (
                      <button className="text-link" onClick={removePlacement}>
                        <Trash2 size={16} />
                        {t(
                          "Remove this placement",
                          "Diese Bildverwendung entfernen",
                        )}
                      </button>
                    )}
                    <button
                      className="text-link danger-action"
                      disabled={busy || backgroundSaving || uploadBusy}
                      onClick={() => setDeletingPhoto(photo)}
                    >
                      <Trash2 size={16} />
                      {t("Delete from collection", "Aus Fotosammlung löschen")}
                    </button>
                  </div>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={photo.featured}
                      onChange={(e) =>
                        photoChange(photo.id, { featured: e.target.checked })
                      }
                    />
                    {t("Favourite photograph", "Favoritenfoto")}
                  </label>
                  <button
                    className="button button-outline"
                    onClick={() => change({ cover_id: photo.id, cover: photo })}
                  >
                    {t("Use as journey cover", "Als Reisetitelbild verwenden")}
                  </button>
                </>
              ) : selected.type === "intro" ? (
                <Field label={t("Introduction", "Einleitung")}>
                  <textarea
                    rows={8}
                    maxLength={20000}
                    value={j.introduction}
                    onChange={(e) => change({ introduction: e.target.value })}
                  />
                </Field>
              ) : (
                <>
                  {module && !["text", "quote"].includes(module.kind) && (
                    <>
                      <ModulePhotographs
                        key={module.id}
                        module={module}
                        journey={j}
                        onDelete={setDeletingPhoto}
                        deleteDisabled={busy || backgroundSaving || uploadBusy}
                        onChange={(p) => layoutChange(module.id, p)}
                        onPhoto={(p) =>
                          selectCanvas({
                            type: "photo",
                            id: p.id,
                            moduleId: module.id,
                            placementId: p.placement_id,
                          })
                        }
                      />
                      {module.kind === "chapter" && (
                        <button
                          className="button button-outline"
                          onClick={() => setPicker(true)}
                        >
                          <Plus size={16} />
                          {t(
                            "Add module to this day",
                            "Modul zu diesem Tag hinzufügen",
                          )}
                        </button>
                      )}
                      {module.kind === "chapter" && module.id < 0 ? (
                        <button
                          className="button button-outline"
                          onClick={() => void save()}
                          disabled={busy}
                        >
                          {t(
                            "Save day to upload photos",
                            "Tag speichern und Fotos hochladen",
                          )}
                        </button>
                      ) : (
                        <Upload
                          disabled={backgroundSaving || conflicted}
                          composition={{ slug: j.slug, version: j.composition_version ?? 0 }}
                          onConflict={markConflict}
                          journeyId={j.id}
                          chapterId={
                            module.kind === "chapter" ? module.id : null
                          }
                          onSave={uploaded}
                          onBusy={setUploadBusy}
                        />
                      )}
                    </>
                  )}
                  {!module && (
                    <button
                      className="button button-outline cover-replace-button"
                      onClick={() => {
                        setReplaceCover(true);
                        setReplaceOpen(true);
                      }}
                    >
                      <Images size={16} />
                      {t(
                        "Choose / upload cover image",
                        "Titelbild auswählen / hochladen",
                      )}
                    </button>
                  )}
                  <details
                    className="inspector-section"
                    open={
                      !module ||
                      ["chapter", "text", "quote", "hero"].includes(module.kind)
                    }
                  >
                    <summary>
                      {module
                        ? t("Heading & text", "Überschrift & Text")
                        : t("Journey details", "Reisedetails")}
                    </summary>
                    <Field label={t("Title", "Titel")}>
                      <input
                        maxLength={160}
                        value={module?.title ?? j.title}
                        onChange={(e) =>
                          module
                            ? moduleChange(module.id, { title: e.target.value })
                            : change({ title: e.target.value })
                        }
                      />
                    </Field>
                    {module ? (
                      <>
                        {!["text", "quote"].includes(module.kind) && (
                          <label className="check-field">
                            <input
                              type="checkbox"
                              checked={
                                module.layout?.show_title ??
                                ["chapter", "hero"].includes(module.kind)
                              }
                              onChange={(e) =>
                                layoutChange(module.id, {
                                  show_title: e.target.checked,
                                })
                              }
                            />
                            {t("Show heading", "Überschrift anzeigen")}
                          </label>
                        )}
                        {["chapter", "text", "hero"].includes(module.kind) && (
                          <Field label={t("Text", "Text")}>
                            <textarea
                              rows={4}
                              maxLength={20000}
                              value={module.story}
                              onChange={(e) =>
                                moduleChange(module.id, {
                                  story: e.target.value,
                                })
                              }
                            />
                          </Field>
                        )}
                        {module.kind === "quote" && (
                          <Field label={t("Quote", "Zitat")}>
                            <textarea
                              rows={5}
                              maxLength={1000}
                              value={module.quote}
                              onChange={(e) =>
                                moduleChange(module.id, {
                                  quote: e.target.value,
                                })
                              }
                            />
                          </Field>
                        )}
                        {module.kind === "chapter" && (
                          <Field label={t("Date", "Datum")}>
                            <input
                              type="date"
                              value={module.date}
                              onChange={(e) =>
                                moduleChange(module.id, {
                                  date: e.target.value,
                                })
                              }
                            />
                          </Field>
                        )}
                      </>
                    ) : (
                      <>
                        <Field label={t("Subtitle", "Untertitel")}>
                          <textarea
                            rows={2}
                            maxLength={300}
                            value={j.subtitle}
                            onChange={(e) =>
                              change({ subtitle: e.target.value })
                            }
                          />
                        </Field>
                        <Field label={t("Place", "Ort")}>
                          <input
                            maxLength={160}
                            value={j.location}
                            onChange={(e) =>
                              change({ location: e.target.value })
                            }
                          />
                        </Field>
                        <div className="field-pair">
                          <Field label={t("From", "Von")}>
                            <input
                              type="date"
                              value={j.start_date}
                              onChange={(e) =>
                                change({ start_date: e.target.value })
                              }
                            />
                          </Field>
                          <Field label={t("Until", "Bis")}>
                            <input
                              type="date"
                              value={j.end_date}
                              onChange={(e) =>
                                change({ end_date: e.target.value })
                              }
                            />
                          </Field>
                        </div>
                        <Field label={t("Starting edition", "Startedition")}>
                          <select
                            value={j.story_template}
                            onChange={(e) =>
                              change({
                                story_template: e.target
                                  .value as Journey["story_template"],
                              })
                            }
                          >
                            <option value="quiet-atlas">Quiet Atlas</option>
                            <option value="after-hours">After Hours</option>
                          </select>
                        </Field>
                        <p className="inspector-note">
                          {t(
                            "A starting point. Each module can use either edition.",
                            "Ein Startpunkt. Jedes Modul kann eine andere Edition verwenden.",
                          )}
                        </p>
                        <Field label={t("Cover photograph", "Titelbild")}>
                          <select
                            value={j.cover_id || ""}
                            onChange={(e) => {
                              const p = j.photos.find(
                                (p) => p.id === Number(e.target.value),
                              );
                              change({
                                cover_id: p?.id || null,
                                cover: p || null,
                              });
                            }}
                          >
                            {j.photos.map((p, i) => (
                              <option key={p.id} value={p.id}>
                                {t("Photograph", "Foto")} {i + 1}
                                {p.edits?.show_title ? ` · ${p.title}` : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
                  </details>
                  {!module && (
                    <details className="inspector-section">
                      <summary>{t("Story text", "Reisetexte")}</summary>
                      {(
                        [
                          "introduction",
                          "reflection",
                          "closing",
                          "description",
                        ] as const
                      ).map((key, i) => (
                        <Field
                          key={key}
                          label={
                            [
                              t("Introduction", "Einleitung"),
                              t("Reflection", "Rückblick"),
                              t("Closing", "Abschluss"),
                              t(
                                "Archive description",
                                "Beschreibung im Archiv",
                              ),
                            ][i]
                          }
                        >
                          <textarea
                            rows={3}
                            maxLength={
                              key === "introduction"
                                ? 20000
                                : key === "closing"
                                  ? 5000
                                  : 2000
                            }
                            value={j[key]}
                            onChange={(e) => change({ [key]: e.target.value })}
                          />
                        </Field>
                      ))}
                    </details>
                  )}
                  {module && !["text", "quote"].includes(module.kind) && (
                    <>
                      <details className="inspector-section" open>
                        <summary>
                          {t("Layout & dimensions", "Layout & Abmessungen")}
                        </summary>
                        {["gallery", "wall", "pair", "chapter"].includes(
                          module.kind,
                        ) && (
                          <>
                            <WallSettings
                              module={module}
                              onChange={(p) => layoutChange(module.id, p)}
                            />
                          </>
                        )}
                        {(module.kind === "rail" ||
                          (module.kind === "chapter" &&
                            module.gallery_mode === "horizontal")) && (
                          <RailSettings
                            layout={layout}
                            onChange={(p) => layoutChange(module.id, p)}
                          />
                        )}
                        {module.kind !== "filmstrip" && (
                          <MediaLayoutSettings
                            layout={layout}
                            onChange={(p) => layoutChange(module.id, p)}
                          />
                        )}
                        <Field label={t("Image format", "Bildformat")}>
                          <select
                            value={layout.ratio || "original"}
                            onChange={(e) =>
                              layoutChange(module.id, {
                                ratio: e.target.value as Layout["ratio"],
                              })
                            }
                          >
                            {ratios
                              .filter((r) => r !== "free")
                              .map((r) => (
                                <option key={r} value={r}>
                                  {r === "original"
                                    ? t("Per photograph", "Pro Foto")
                                    : r}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Field
                          label={`${t("Module spacing", "Modulabstand")} · ${layout.padding ?? 36} px`}
                        >
                          <input
                            type="range"
                            min={0}
                            max={160}
                            value={layout.padding ?? 36}
                            onChange={(e) =>
                              layoutChange(module.id, {
                                padding: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      </details>
                      <details className="inspector-section">
                        <summary>
                          {t("Mobile overrides", "Eigene Mobilwerte")}
                          <Smartphone size={14} />
                        </summary>
                        <p className="inspector-note">
                          {t(
                            "Empty values inherit desktop spacing. Columns inherit up to two for a readable mobile layout.",
                            "Leere Werte übernehmen die Desktopabstände. Spalten werden für lesbare Mobilansichten auf maximal zwei begrenzt.",
                          )}
                        </p>
                        {(
                          [
                            "mobile_columns",
                            "mobile_gap",
                            "mobile_padding",
                          ] as const
                        ).map((key, i) => (
                          <Field
                            key={key}
                            label={
                              [
                                t("Mobile columns", "Mobile Spalten"),
                                t("Mobile image gap", "Mobiler Bildabstand"),
                                t(
                                  "Mobile outer spacing",
                                  "Mobiler Außenabstand",
                                ),
                              ][i]
                            }
                          >
                            <input
                              type="number"
                              min={i === 0 ? 1 : 0}
                              max={i === 0 ? 4 : i === 1 ? 40 : 80}
                              placeholder={t("Inherit", "Übernehmen")}
                              value={layout[key] ?? ""}
                              onChange={(e) =>
                                layoutChange(module.id, {
                                  [key]:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                        ))}
                      </details>
                    </>
                  )}
                  <h3 className="inspector-group-title">
                    {t("Appearance & typography", "Darstellung & Typografie")}
                  </h3>
                  {module && (
                    <details className="inspector-section">
                      <summary>
                        {t("Edition & placement", "Edition & Einordnung")}
                      </summary>
                      {module.kind !== "chapter" && (
                        <Field
                          label={t("Inside a day", "Innerhalb eines Tages")}
                        >
                          <select
                            value={module.layout?.parent_id || ""}
                            onChange={(e) =>
                              layoutChange(module.id, {
                                parent_id: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                          >
                            <option value="">
                              {t("Journey level", "Reiseebene")}
                            </option>
                            {j.chapters
                              .filter(
                                (c) =>
                                  c.kind === "chapter" && !c.layout?.parent_id,
                              )
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                          </select>
                        </Field>
                      )}
                      <Field label={t("Design world", "Gestaltungswelt")}>
                        <select
                          value={module.layout?.edition || "inherit"}
                          onChange={(e) =>
                            layoutChange(module.id, {
                              edition: e.target.value as Layout["edition"],
                            })
                          }
                        >
                          <option value="inherit">
                            {t(
                              "Inherit journey edition",
                              "Edition der Reise übernehmen",
                            )}
                          </option>
                          <option value="quiet-atlas">Quiet Atlas</option>
                          <option value="after-hours">After Hours</option>
                        </select>
                      </Field>{" "}
                    </details>
                  )}
                  <AppearanceSettings
                    moduleScope={!!module}
                    layout={layout}
                    edition={
                      module?.layout?.edition &&
                      module.layout.edition !== "inherit"
                        ? module.layout.edition
                        : j.story_template
                    }
                    inherited={
                      module &&
                      (!module.layout?.edition ||
                        module.layout.edition === "inherit")
                        ? j.layout?.background
                        : undefined
                    }
                    onChange={(p) => layoutChange(module?.id ?? null, p)}
                  />
                  {(!module || module.kind === "hero") && (
                    <>
                      <Field label={t("Title composition", "Titelkomposition")}>
                        <select
                          value={layout.title_style || "overlay"}
                          onChange={(e) =>
                            layoutChange(module?.id ?? null, {
                              title_style: e.target
                                .value as Layout["title_style"],
                            })
                          }
                        >
                          <option value="overlay">
                            {t("Over the image", "Auf dem Bild")}
                          </option>
                          <option value="overlap">
                            {t("Compact overlap", "Kompakte Überlappung")}
                          </option>
                          <option value="below">
                            {t("Close to the image", "Bildnah darunter")}
                          </option>
                        </select>
                      </Field>
                      <Field label={t("Heading size", "Überschriftengröße")}>
                        <input
                          type="range"
                          min={28}
                          max={160}
                          value={layout.title_size || 100}
                          onChange={(e) =>
                            layoutChange(module?.id ?? null, {
                              title_size: Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                    </>
                  )}
                  {module &&
                    (["text", "quote", "chapter", "hero"].includes(
                      module.kind,
                    ) ||
                      layout.show_title) && (
                      <TypographySettings
                        open={["text", "quote"].includes(module.kind)}
                        layout={layout}
                        background={
                          layout.background ||
                          (layout.edition && layout.edition !== "inherit"
                            ? editionColors[layout.edition]
                            : j.layout?.background ||
                              editionColors[j.story_template])
                        }
                        onChange={(p) => layoutChange(module.id, p)}
                      />
                    )}
                  <details className="inspector-section">
                    <summary>
                      {t("Movement & details", "Bewegung & Details")}
                    </summary>
                    {module?.kind === "filmstrip" && (
                      <Field
                        label={t(
                          "Loop duration (seconds)",
                          "Durchlaufdauer (Sekunden)",
                        )}
                      >
                        <input
                          type="range"
                          min={10}
                          max={180}
                          value={layout.speed || 45}
                          onChange={(e) =>
                            layoutChange(module.id, {
                              speed: Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                    )}
                    {!module && (
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={j.layout?.text_animations !== false}
                          onChange={(e) =>
                            layoutChange(null, {
                              text_animations: e.target.checked,
                            })
                          }
                        />
                        {t(
                          "Allow individual text animations",
                          "Individuelle Textanimationen zulassen",
                        )}
                      </label>
                    )}
                    {(!module ||
                      !["text", "quote", "filmstrip"].includes(module.kind)) && (
                      <>
                        <label className="check-field">
                          <input
                            type="checkbox"
                            checked={
                              imageParallax(layout, !module || module.kind === "hero").enabled
                            }
                            onChange={(e) =>
                              layoutChange(module?.id ?? null, {
                                image_parallax: e.target.checked,
                              })
                            }
                          />
                          {t("Parallax", "Parallax")}
                        </label>
                        <p className="inspector-note">
                          {t(
                            "Contained photographs and single-image rail pages stay still to preserve the full image.",
                            "Vollständig eingepasste Fotos und Einzelbildseiten bleiben unbewegt, damit das ganze Motiv erhalten bleibt.",
                          )}
                        </p>
                      </>
                    )}
                    {(!module || !["text", "quote"].includes(module.kind)) && (
                      <HoverZoomControl
                        value={layout.hover_zoom}
                        onChange={(hover_zoom) =>
                          layoutChange(module?.id ?? null, { hover_zoom })
                        }
                      />
                    )}
                    {module?.kind === "filmstrip" && (
                      <p className="inspector-note">
                        {t(
                          "Parallax is unavailable for moving filmstrips to keep the automatic loop seamless.",
                          "Parallax ist für laufende Fotostreifen nicht verfügbar, damit die automatische Schleife nahtlos bleibt.",
                        )}
                      </p>
                    )}
                    {module && (
                      <MotionControl
                        inherit={false}
                        value={module.reveal || { effect: "none" }}
                        label={t("Module motion", "Modulbewegung")}
                        text={module.story || module.title}
                        onChange={(v) => {
                          moduleChange(module.id, { reveal: v });
                          setReplay((r) => r + 1);
                        }}
                      />
                    )}
                    {module && (
                      <div className="module-tools">
                        <button
                          disabled={moduleIndex === 0}
                          aria-label={t("Move up", "Nach oben")}
                          onClick={() => reorder(module.id, -1)}
                        >
                          <ArrowUp size={17} />
                        </button>
                        <button
                          disabled={
                            moduleIndex ===
                            j.chapters.filter(
                              (c) =>
                                (c.layout?.parent_id || null) ===
                                (module.layout?.parent_id || null),
                            ).length -
                              1
                          }
                          aria-label={t("Move down", "Nach unten")}
                          onClick={() => reorder(module.id, 1)}
                        >
                          <ArrowDown size={17} />
                        </button>
                        <button
                          aria-label={t(
                            "Duplicate module",
                            "Modul duplizieren",
                          )}
                          onClick={() => duplicate(module)}
                        >
                          <Copy size={17} />
                        </button>
                        <button
                          aria-label={t(
                            "Remove module; photographs are preserved",
                            "Modul entfernen; Fotos bleiben erhalten",
                          )}
                          onClick={(e) => requestModuleRemoval(module.id, e.currentTarget)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    )}
                  </details>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
      {mode === "edit" && (
        <nav
          className="studio-mobile-tabs"
          aria-label={t("Editor panels", "Editorbereiche")}
        >
          {(
            [
              ["modules", LayoutGrid, t("Modules", "Module")],
              ["canvas", Eye, t("Preview", "Vorschau")],
              ["settings", Settings2, t("Settings", "Einstellungen")],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {picker && (
        <Modal
          title={t("Add module", "Modul hinzufügen")}
          onClose={() => setPicker(false)}
          className="module-picker"
        >
          <h2>{t("Make it your own.", "Deine Geschichte, dein Rhythmus.")}</h2>
          <p>
            {t(
              "Choose a module. Every detail can change later.",
              "Wähle ein Modul. Jedes Detail lässt sich später anpassen.",
            )}
          </p>
          <div className="module-picker-groups">
            {([
              {
                title: t("Tell the story", "Erzählen"),
                note: t(
                  "Set a scene, add a thought, or keep a line.",
                  "Einen Tag eröffnen, Gedanken teilen oder einen Satz bewahren.",
                ),
                kinds: ["chapter", "text", "quote"],
              },
              {
                title: t("Show photographs", "Bilder zeigen"),
                note: t(
                  "Choose one frame or bring photographs into relation.",
                  "Ein Motiv zeigen oder mehrere Bilder in Beziehung setzen.",
                ),
                kinds: ["image", "pair", "wall", "gallery", "hero"],
              },
              {
                title: t("Build a sequence", "Sequenzen"),
                note: t(
                  "Let readers discover at their own pace, or add a moving accent.",
                  "Lass Leser selbst entdecken oder setze einen bewegten Akzent.",
                ),
                kinds: ["rail", "filmstrip"],
              },
            ] as const).map((group) => (
              <section className="module-picker-group" key={group.title}>
                <div className="module-picker-group-heading">
                  <h3>{group.title}</h3>
                  <p>{group.note}</p>
                </div>
                <div className="module-picker-grid">
                  {group.kinds.map((key) => {
                    const names = moduleNames[key];
                    const use = ({
                      pair: t(
                        "Show the relationship between two photographs.",
                        "Die Beziehung zwischen zwei Fotos zeigen.",
                      ),
                      wall: t(
                        "Give an overview of a place or a moment.",
                        "Einen Überblick über einen Ort oder Moment geben.",
                      ),
                      rail: t(
                        "Invite readers to explore the photographs at their own pace.",
                        "Zum Entdecken im eigenen Tempo einladen.",
                      ),
                      filmstrip: t(
                        "Add a moving, atmospheric accent.",
                        "Einen bewegten, atmosphärischen Akzent setzen.",
                      ),
                      image: t(
                        "Give one photograph room to speak.",
                        "Einem einzelnen Foto Raum geben.",
                      ),
                      gallery: t(
                        "Gather photographs into a browsable collection.",
                        "Fotos in einer blätterbaren Sammlung bündeln.",
                      ),
                      hero: t(
                        "Open with a defining photograph.",
                        "Mit einem prägenden Foto eröffnen.",
                      ),
                    } as Partial<Record<Chapter["kind"], string>>)[key];
                    return (
                      <button key={key} onClick={() => add(key)}>
                        <span className={`module-schematic schematic-${key}`}>
                          {key === "quote" ? (
                            <span className="quote-sample">
                              <b>“</b>
                              {t("A moment, kept.", "Ein Moment, der bleibt.")}
                            </span>
                          ) : key === "rail" || key === "filmstrip" ? (
                            <span className="sequence-sample">
                              {[
                                "forest",
                                "river",
                                "mountains",
                                "moss",
                                "forest",
                                "river",
                              ].map((name, index) => (
                                <img
                                  key={index}
                                  src={`/images/${name}-640.webp`}
                                  alt=""
                                />
                              ))}
                              <span className="sequence-cue">
                                {key === "rail" ? "↔" : "∞"}
                              </span>
                            </span>
                          ) : (
                            <>
                              <i />
                              <i />
                              <i />
                              <i />
                            </>
                          )}
                        </span>
                        <span className="module-picker-card-copy">
                          <strong>{t(...names)}</strong>
                          {use && <small>{use}</small>}
                        </span>
                        <Plus size={16} />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </Modal>
      )}
      {addTarget !== null &&
        (() => {
          const target = j.chapters.find((c) => c.id === addTarget);
          if (!target) return null;
          const single = ["image", "hero"].includes(target.kind);
          return (
            <Modal
              title={t("Choose / upload image", "Bild auswählen / hochladen")}
              className="collection-modal"
              onClose={() => {
                if (!uploadBusy) {
                  setAddTarget(null);
                  setChosenPhotos([]);
                }
              }}
            >
              <h2>{target.title}</h2>
              <Upload
                journeyId={j.id}
                multiple={!single}
                disabled={backgroundSaving || conflicted}
                composition={{ slug: j.slug, version: j.composition_version ?? 0 }}
                onConflict={markConflict}
                onBusy={setUploadBusy}
                onSave={(next) => {
                  const added = next.photos.filter(
                    (p) =>
                      !draftRef.current?.photos.some((old) => old.id === p.id),
                  );
                  uploaded(next);
                  setChosenPhotos((ids) =>
                    single
                      ? added.slice(-1).map((p) => p.id)
                      : [...ids, ...added.map((p) => p.id)],
                  );
                }}
              />
              <div className="collection-grid">
                {j.photos.map((p, i) => (
                  <button
                    key={p.id}
                    aria-label={`${t("Use photograph", "Foto verwenden")} ${i + 1}`}
                    aria-pressed={chosenPhotos.includes(p.id)}
                    className={chosenPhotos.includes(p.id) ? "selected" : ""}
                    onClick={() =>
                      setChosenPhotos((ids) =>
                        ids.includes(p.id)
                          ? ids.filter((id) => id !== p.id)
                          : single
                            ? [p.id]
                            : [...ids, p.id],
                      )
                    }
                  >
                    <Picture photo={p} sizes="240px" />
                    {chosenPhotos.includes(p.id) && (
                      <span>{chosenPhotos.indexOf(p.id) + 1}</span>
                    )}
                  </button>
                ))}
              </div>
              <button
                className="button"
                disabled={!chosenPhotos.length || uploadBusy}
                onClick={() => {
                  const current = draftRef.current;
                  const module = current?.chapters.find(
                    (c) => c.id === addTarget,
                  );
                  if (module && current)
                    layoutChange(module.id, {
                      placements: [
                        ...(single ? [] : placementsFor(module, current)),
                        ...chosenPhotos.map((photo_id) => ({
                          id: crypto.randomUUID(),
                          photo_id,
                        })),
                      ],
                    });
                  setAddTarget(null);
                  setChosenPhotos([]);
                }}
              >
                {t("Use selected photographs", "Ausgewählte Fotos verwenden")}
              </button>
            </Modal>
          );
        })()}
      {replaceOpen && (
        <Modal
          title={t("Choose / upload image", "Bild auswählen / hochladen")}
          onClose={() => {
            if (!uploadBusy) {
              setReplaceOpen(false);
              setReplaceCover(false);
            }
          }}
          className="collection-modal"
        >
          <h2>{t("A different frame.", "Ein anderer Blick.")}</h2>
          <p>
            {t(
              "Choose a source image. Repeated motifs reuse the same file.",
              "Wähle ein Ausgangsfoto. Wiederholte Motive verwenden dieselbe Datei.",
            )}
          </p>
          <Upload
            disabled={backgroundSaving || conflicted}
            composition={{ slug: j.slug, version: j.composition_version ?? 0 }}
            onConflict={markConflict}
            journeyId={j.id}
            multiple={false}
            onBusy={setUploadBusy}
            onSave={(next) => {
              const added = next.photos.find(
                (p) => !j.photos.some((old) => old.id === p.id),
              );
              uploaded(next);
              if (added) replacePhoto(added, next);
            }}
          />
          <div className="collection-grid">
            {j.photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => replacePhoto(p)}
                aria-label={`${t("Use photograph", "Foto verwenden")} ${i + 1}`}
              >
                <Picture photo={p} sizes="240px" />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {library && (
        <Modal
          title={t("Photographs", "Fotosammlung")}
          onClose={() => {
            if (!uploadBusy) setLibrary(false);
          }}
          className="collection-modal"
        >
          <h2>{t("The photographs.", "Die Fotosammlung.")}</h2>
          <p>
            {t(
              "One collection for every day and module.",
              "Eine Sammlung für alle Tage und Module.",
            )}
          </p>
          <Upload
            disabled={backgroundSaving || conflicted}
            composition={{ slug: j.slug, version: j.composition_version ?? 0 }}
            onConflict={markConflict}
            journeyId={j.id}
            onSave={uploaded}
            onBusy={setUploadBusy}
          />
          <div className="collection-grid">
            {j.photos.map((p, i) => (
              <div className="collection-item" key={p.id}>
                <button
                  className="collection-photo"
                  onClick={() => {
                    select({ type: "photo", id: p.id });
                    setLibrary(false);
                    setTab("settings");
                  }}
                  aria-label={
                    t("Edit photograph", "Foto bearbeiten") + ` ${i + 1}`
                  }
                >
                  <Picture photo={p} sizes="240px" />
                  <span>{String(i + 1).padStart(2, "0")}</span>
                </button>
                <div className="collection-order">
                  <button
                    className="collection-delete danger-action"
                    disabled={busy || backgroundSaving || uploadBusy}
                    aria-label={`${t("Delete photograph", "Foto löschen")} ${i + 1}`}
                    title={t("Delete photograph", "Foto löschen")}
                    onClick={() => setDeletingPhoto(p)}
                  >
                    <Trash2 size={17} />
                  </button>
                  <button
                    disabled={i === 0}
                    aria-label={t("Move image earlier", "Bild nach vorne")}
                    onClick={() => {
                      const list = [...j.photos];
                      [list[i], list[i - 1]] = [list[i - 1], list[i]];
                      change({ photos: list });
                    }}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    disabled={i === j.photos.length - 1}
                    aria-label={t("Move image later", "Bild nach hinten")}
                    onClick={() => {
                      const list = [...j.photos];
                      [list[i], list[i + 1]] = [list[i + 1], list[i]];
                      change({ photos: list });
                    }}
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {deletingModule && (
        <Modal
          title={t("Delete module?", "Modul löschen?")}
          className="module-delete-modal"
          onClose={closeModuleRemoval}
        >
          <h2>{t("Delete module?", "Modul löschen?")}</h2>
          <p><strong>{deletingModule.title}</strong></p>
          <p>{t(
            "Only this module will be removed. Photographs and contained modules are preserved.",
            "Nur dieses Modul wird entfernt. Fotos und enthaltene Module bleiben erhalten.",
          )}</p>
          <div className="confirm-actions">
            <button autoFocus className="button button-outline" onClick={closeModuleRemoval}>
              {t("Cancel", "Abbrechen")}
            </button>
            <button className="button danger-button" onClick={() => {
              const pending = deletingModuleRef.current;
              if (pending) remove(pending.id);
            }}>
              {t("Delete module", "Modul löschen")}
            </button>
          </div>
        </Modal>
      )}
      {deletingPhoto && (
        <Modal
          title={t("Delete photograph?", "Foto löschen?")}
          onClose={() => {
            if (!busy) setDeletingPhoto(null);
          }}
        >
          <h2>{t("Delete this photograph?", "Dieses Foto löschen?")}</h2>
          {deleteError && (
            <p role="alert" className="form-error">
              {deleteError}
            </p>
          )}
          <Picture
            photo={deletingPhoto}
            sizes="360px"
            className="delete-photo-preview"
          />
          <p>
            {t(
              "This permanently removes the image from the collection, all modules and the published version. Other photographs remain unchanged.",
              "Das Bild wird endgültig aus der Fotosammlung, allen Modulen und der veröffentlichten Version gelöscht. Andere Fotos bleiben erhalten.",
            )}
          </p>
          <div className="confirm-actions">
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => setDeletingPhoto(null)}
            >
              {t("Cancel", "Abbrechen")}
            </button>
            <button
              className="button danger-button"
              disabled={busy || backgroundSaving || uploadBusy}
              onClick={() => void deleteSource()}
            >
              <Trash2 size={16} />
              {t("Permanently delete photograph", "Foto endgültig löschen")}
            </button>
          </div>
        </Modal>
      )}
      {(publishReview || publishResult) && (
        <Modal
          key={publishResult ? "published" : "review"}
          title={
            publishResult
              ? t("Version published", "Fassung veröffentlicht")
              : t("Review before publishing", "Vor Veröffentlichung prüfen")
          }
          className="publish-review"
          onClose={() => {
            if (saving.current || busy) return;
            setPublishReview(null);
            setPublishResult(null);
          }}
        >
          <span className="eyebrow">
            {publishResult
              ? t("VISITOR VERSION", "BESUCHERVERSION")
              : t("CURRENT LOCAL DRAFT", "AKTUELLER LOKALER ENTWURF")}
          </span>
          <h2>{publishResult ? publishResult.title : j.title}</h2>
          {publishResult ? (
            <>
              <p role="status">
                {t(
                  "The reviewed version is now available to visitors.",
                  "Die geprüfte Fassung ist jetzt für Besucher verfügbar.",
                )}
                {(dirty || j.has_unpublished_changes) && (
                  <>
                    {" "}
                    {t(
                      "Newer changes remain in your draft and are not published.",
                      "Neuere Änderungen bleiben im Entwurf und sind unveröffentlicht.",
                    )}
                  </>
                )}
              </p>
              <div className="confirm-actions">
                <button
                  className="button button-outline"
                  onClick={() => setPublishResult(null)}
                >
                  {t("Continue editing", "Weiter bearbeiten")}
                </button>
                <Link
                  className="button"
                  to={`/journeys/${publishResult.slug}`}
                  target="_blank"
                  rel="noopener"
                >
                  {t("Open visitor version", "Besucherversion öffnen")}
                  <Eye size={17} />
                </Link>
              </div>
            </>
          ) : (
            publishReview && (
              <>
                <dl className="publish-summary">
                  <div>
                    <dt>{t("Photo sources", "Fotoquellen")}</dt>
                    <dd>{j.photos.length}</dd>
                  </div>
                  <div>
                    <dt>{t("Image uses", "Bildverwendungen")}</dt>
                    <dd>{imageUses}</dd>
                  </div>
                  <div>
                    <dt>{t("Modules", "Module")}</dt>
                    <dd>{j.chapters.length}</dd>
                  </div>
                </dl>
                <p>
                  {t(
                    "Photo sources form your collection. Image uses include the cover, modules and filmstrip; one source can appear more than once with its own crop.",
                    "Fotoquellen bilden deine Sammlung. Bildverwendungen zählen Titelbild, Module und Fotostreifen; eine Quelle kann mehrfach mit eigenem Zuschnitt vorkommen.",
                  )}
                </p>
                <p>
                  {t(
                    "Saving keeps your working draft private. Publishing replaces the visitor version with this reviewed draft. Later edits stay in the draft until you publish again.",
                    "Speichern hält deinen Arbeitsentwurf privat. Veröffentlichen ersetzt die Besucherversion durch diesen geprüften Entwurf. Spätere Änderungen bleiben bis zur nächsten Veröffentlichung im Entwurf.",
                  )}
                </p>
                {reviewChanged && (
                  <p className="publish-review-update" role="status">
                    {t(
                      "Your draft changed during review. The summary is up to date. Review this version again before publishing.",
                      "Dein Entwurf hat sich während der Kontrolle geändert. Die Übersicht ist aktuell. Prüfe diese Fassung erneut vor dem Veröffentlichen.",
                    )}
                  </p>
                )}
                {(busy || backgroundSaving || uploadBusy) && (
                  <p role="status">
                    {t(
                      "Wait until saving or uploading has finished.",
                      "Warte, bis Speichern oder Hochladen abgeschlossen ist.",
                    )}
                  </p>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="confirm-actions">
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => setPublishReview(null)}
                  >
                    {t("Cancel", "Abbrechen")}
                  </button>
                  <button
                    className="button"
                    disabled={busy || backgroundSaving || uploadBusy}
                    onClick={() => {
                      if (
                        saving.current ||
                        busy ||
                        backgroundSaving ||
                        uploadBusy
                      )
                        return;
                      const content = JSON.stringify(draftRef.current);
                      if (
                        publishReview.content !== content ||
                        publishReview.revision !== revision.current
                      ) {
                        setPublishReview({
                          content,
                          revision: revision.current,
                        });
                        return;
                      }
                      void save(true);
                    }}
                  >
                    {busy
                      ? t("Publishing…", "Wird veröffentlicht…")
                      : reviewChanged
                        ? t("Review updated version", "Aktuelle Fassung prüfen")
                        : t(
                            "Publish this version",
                            "Diese Fassung veröffentlichen",
                          )}
                  </button>
                </div>
              </>
            )
          )}
        </Modal>
      )}
      {viewer !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initial={viewer}
          onClose={() => setViewer(null)}
        />
      )}
      {(pending || discard) && (
        <Modal
          title={t("Unsaved changes", "Ungespeicherte Änderungen")}
          onClose={() => {
            setPending("");
            setDiscard(false);
          }}
        >
          <h2>{t("Keep this moment?", "Diesen Stand behalten?")}</h2>
          <p>
            {t(
              "Save your draft before leaving, or discard the open changes.",
              "Speichere den Entwurf vor dem Verlassen oder verwirf die offenen Änderungen.",
            )}
          </p>
          <div className="confirm-actions">
            <button
              className="button"
              onClick={async () => {
                if (await save()) {
                  const next = pending;
                  setPending("");
                  setDiscard(false);
                  if (next) navigate(next);
                }
              }}
            >
              {t("Save & continue", "Speichern & weiter")}
            </button>
            <button
              className="button button-outline"
              disabled={busy || backgroundSaving || uploadBusy}
              onClick={async () => {
                if (saving.current || busy || uploadBusy) return;
                const cleared = await withRecoveryLock(j.id, () => {
                  if (saving.current) return false;
                  return !ownedRecovery.current || clearRecovery(ownedRecovery.current);
                }).catch(() => false);
                if (!cleared) {
                  setError(t("The local draft could not be discarded.", "Der lokale Entwurf konnte nicht verworfen werden."));
                  setDiscard(false);
                  return;
                }
                setDirty(false);
                setJourney(saved.current);
                const next = pending;
                setPending("");
                setDiscard(false);
                if (next) navigate(next);
              }}
            >
              {t("Discard changes", "Änderungen verwerfen")}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
