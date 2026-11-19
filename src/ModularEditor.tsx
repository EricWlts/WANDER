import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  Monitor,
  Smartphone,
  Pencil,
  Plus,
  Trash2,
  X,
  Images,
  Sparkles,
  Settings2,
  Play,
  Globe,
  GripVertical,
  Copy,
  Quote,
  Type,
} from "lucide-react";
import { ApiError, api } from "./api";
import { photoDateRange, shouldAdoptDates, type DateRange } from "./journeyDates";
import {
  draftChapterTitle,
  formOf,
  initialDraftMode,
  isPlaceholderTitleOfAnyForm,
  suggestMomentTitle,
} from "./journeyForm";
import { useApp, PageState } from "./App";
import { Modal, Picture, dateLabel } from "./components";
import {
  JournalCanvas,
  moduleNames,
  modulePhotos,
  type Selection,
} from "./JournalCanvas";
import {
  placementsFor,
  sequenceIndex,
  rootPhotos,
  replaceSourceReferences,
} from "./journalModel";
import {
  applyPreset,
  pickerGroups,
  initialLayoutFor,
  stepVariant,
  variantState,
  type StylePreset,
} from "./editorPresets";
import { VariantContext, type VariantActions } from "./EditorControls";
import { StoryDraftDialog } from "./StoryDraftDialog";
import { cachedLights, readLights } from "./photoMood";
import { draftModeFromParam, parseWords, wordsKey, type StoryWords } from "./newStoryFlow";
import {
  dayOf,
  draftStory,
  suggestJourneyTitle,
  type DraftMode,
} from "./storyDraft";
import {
  applyStoryDraft,
  applyStoryWords,
  restoreStoryDraft,
  type DraftSnapshot,
} from "./storyDraftApply";
import { Upload } from "./Upload";
import { useMotionOff } from "./Motion";
import { PhotoViewer, StoryExperience } from "./StoryExperience";
import { t, useLocale } from "./I18n";
import { removeModuleFromDraft, selectionAfterModuleRemoval } from "./moduleDeletion";
import { canRestoreRecovery } from "./recoveryModel";
import { retryDelayMs, retrySeconds } from "./autosaveRetry";
import {
  mappedId,
  remapSelection,
} from "./editor/compositionModel";
import { useComposition } from "./editor/useComposition";
import { EditorContext, type EditorContextValue } from "./editor/EditorContext";
import { PublishedDialog } from "./EditorDialogs";
import { Inspector } from "./editor/Inspector";
import { useModuleDrag } from "./editor/useModuleDrag";
import type { Chapter, Journey, Photo } from "./types";

/** Name of a module in lists and notices: its title, or the module type when it has none. */
const moduleLabel = (c: Chapter) => c.title.trim() || t(...moduleNames[c.kind]);

/** Small contact sheet of a module's real photographs for the screenplay list. */
function NavThumbs({ module, journey }: { module: Chapter; journey: Journey }) {
  const shown = modulePhotos(module, journey).slice(0, 3);
  return (
    <span className={`nav-thumbs nav-thumbs-${Math.max(shown.length, 1)}`} aria-hidden="true">
      {shown.length ? (
        shown.map((p) => (
          <img
            key={p.placement_id ?? p.id}
            src={p.url}
            srcSet={p.srcset || undefined}
            sizes="48px"
            alt=""
            loading="lazy"
            decoding="async"
          />
        ))
      ) : module.kind === "quote" ? (
        <Quote size={14} />
      ) : (
        <Type size={14} />
      )}
    </span>
  );
}

/** Stable comparison of two layouts: key order and unset fields do not matter. */
function sameLayout(a: Chapter["layout"] | undefined, b: Chapter["layout"] | undefined) {
  const norm = (l: Chapter["layout"] | undefined) =>
    JSON.stringify(
      Object.entries(l || {})
        .filter(([, v]) => v !== undefined)
        .sort(([x], [y]) => (x < y ? -1 : 1)),
    );
  return norm(a) === norm(b);
}

/** Where arrow keys and ⌘Z belong to something else: typing, dialogs, controls with own arrows. */
const OWN_KEYS =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], dialog, .modal, [role="tablist"], [role="radiogroup"], [role="slider"], [role="listbox"], [role="menu"], .photo-rail-shell';

/** Arrow left/right browse the variants of the selected module. */
function variantKey(e: KeyboardEvent): 1 | -1 | null {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return null;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest(OWN_KEYS)) return null;
  return e.key === "ArrowRight" ? 1 : -1;
}

/** ⌘Z / Ctrl+Z outside text fields: undo the last variant change. */
function undoKey(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.altKey || e.shiftKey || !(e.metaKey || e.ctrlKey)) return false;
  if (e.key !== "z" && e.key !== "Z") return false;
  const target = e.target instanceof Element ? e.target : null;
  return !target?.closest(OWN_KEYS);
}

function motionIsOff() {
  return (
    document.documentElement.dataset.motion === "off" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * „Variante 2 von 4“ on the selected module of the stage: two arrows, the dots and the name.
 * Rendered inside the preview document, at the top right of the module.
 */
function StageVariants({
  moduleId,
  revision,
  index,
  count,
  name,
  customised,
  onStep,
}: {
  moduleId: number | null;
  revision: unknown;
  index: number;
  count: number;
  name: string;
  customised: boolean;
  onStep: (dir: 1 | -1) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    const doc = ref.current?.ownerDocument;
    const win = doc?.defaultView;
    if (!doc || !win) return;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = moduleId === null ? null : doc.getElementById(`canvas-module-${moduleId}`);
        const label = el?.querySelector<HTMLElement>(":scope > .canvas-module-label");
        if (!el || !label) return setPos(null);
        const r = el.getBoundingClientRect();
        const l = label.getBoundingClientRect();
        setPos({
          top: Math.max(0, l.top + win.scrollY),
          right: Math.max(8, doc.documentElement.clientWidth - r.right + 8),
        });
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(doc.body);
    win.addEventListener("resize", place);
    win.addEventListener("scroll", place, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      win.removeEventListener("resize", place);
      win.removeEventListener("scroll", place);
    };
  }, [moduleId, revision]);
  const visible = !!pos && count > 1;
  return (
    <div
      ref={ref}
      className="stage-variants"
      role="group"
      aria-label={t("Variants", "Varianten")}
      hidden={!visible}
      style={pos ? { top: pos.top, right: pos.right } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={t("Previous variant", "Vorige Variante")}
        title={t("Previous variant (←)", "Vorige Variante (←)")}
        onClick={() => onStep(-1)}
      >
        <ChevronLeft size={15} aria-hidden="true" />
      </button>
      <span className="stage-variant-dots" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <i key={i} data-active={i === index ? (customised ? "base" : "") : undefined} />
        ))}
      </span>
      <span className="stage-variant-text" role="status">
        {t(`Variant ${index + 1} of ${count}`, `Variante ${index + 1} von ${count}`)}
        <span className="stage-variant-name">
          {" · "}
          {customised ? t("Customised", "Angepasst") : name}
        </span>
      </span>
      <button
        type="button"
        aria-label={t("Next variant", "Nächste Variante")}
        title={t("Next variant (→)", "Nächste Variante (→)")}
        onClick={() => onStep(1)}
      >
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Keyboard target for the preview (F toggles, Esc returns): never while typing or inside a dialog. */
function previewKey(e: KeyboardEvent): "toggle" | "exit" | null {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return null;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest('[role="dialog"], dialog, .modal')) return null;
  if (e.key === "Escape") return document.querySelector('[role="dialog"], dialog[open], .modal') ? null : "exit";
  if (e.key !== "f" && e.key !== "F") return null;
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return null;
  return "toggle";
}

/**
 * Quiet actions next to the label of the selected module on the stage. Rendered inside the
 * preview document and positioned on the label, so the canvas itself stays untouched.
 */
function StageActions({
  moduleId,
  revision,
  canUp,
  canDown,
  onUp,
  onDown,
  onDuplicate,
  onRemove,
  onKey,
}: {
  moduleId: number | null;
  revision: unknown;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDuplicate: () => void;
  onRemove: (trigger: HTMLElement) => void;
  onKey: (e: KeyboardEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const doc = ref.current?.ownerDocument;
    const win = doc?.defaultView;
    if (!doc || !win) return;
    const key = (e: KeyboardEvent) => keyRef.current(e);
    doc.addEventListener("keydown", key);
    return () => doc.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const doc = ref.current?.ownerDocument;
    const win = doc?.defaultView;
    if (!doc || !win) return;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const label =
          moduleId === null
            ? null
            : doc.querySelector<HTMLElement>(`#canvas-module-${moduleId} > .canvas-module-label`);
        if (!label) return setPos(null);
        const r = label.getBoundingClientRect();
        setPos({ top: Math.max(0, r.top + win.scrollY), left: r.right + win.scrollX + 6 });
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(doc.body);
    win.addEventListener("resize", place);
    win.addEventListener("scroll", place, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      win.removeEventListener("resize", place);
      win.removeEventListener("scroll", place);
    };
  }, [moduleId, revision]);
  return (
    <div
      ref={ref}
      className="stage-actions"
      role="toolbar"
      aria-label={t("Module actions", "Modulaktionen")}
      hidden={!pos}
      style={pos ? { top: pos.top, left: pos.left } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" disabled={!canUp} aria-label={t("Move up", "Nach oben")} title={t("Move up", "Nach oben")} onClick={onUp}>
        <ArrowUp size={15} aria-hidden="true" />
      </button>
      <button type="button" disabled={!canDown} aria-label={t("Move down", "Nach unten")} title={t("Move down", "Nach unten")} onClick={onDown}>
        <ArrowDown size={15} aria-hidden="true" />
      </button>
      <button type="button" aria-label={t("Duplicate module", "Modul duplizieren")} title={t("Duplicate module", "Modul duplizieren")} onClick={onDuplicate}>
        <Copy size={15} aria-hidden="true" />
      </button>
      <button type="button" className="stage-action-delete" aria-label={t("Delete module", "Modul löschen")} title={t("Delete module", "Modul löschen")} onClick={(e) => onRemove(e.currentTarget)}>
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
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
export function ModularEditor() {
  const navigate = useNavigate();
  const { slug } = useParams(),
    { notify } = useApp();
  const { locale: uiLocale } = useLocale();
  const motionOff = useMotionOff();
  const [uploadBusy, setUploadBusy] = useState(false);
  const {
    journey,
    setJourney,
    layoutIssue,
    saveFailure,
    error,
    setError,
    busy,
    setBusy,
    dirty,
    setDirty,
    backgroundSaving,
    autoError,
    failures,
    online,
    conflicted,
    conflictBusy,
    recoveries,
    recoveryUnavailable,
    saving,
    revision,
    saved,
    draftRef,
    change,
    moduleChange,
    photoChange,
    layoutChange,
    save,
    markConflict,
    loadCurrentVersion,
    keepMyVersion,
    restoreRecovery,
    discardRecovery,
    discardChanges,
  } = useComposition({
    slug,
    uploadBusy,
    notify,
    onIdsReassigned: reassignModuleIds,
    onPublished: (published) => {
      setPublishReview(null);
      setPublishResult(published);
    },
    onReviewInvalid: () => setPublishReview(null),
    onVersionLoaded: () => select({ type: "hero" }),
  });
  const [selected, select] = useState<Selection>({ type: "hero" }),
    [mode] = useState<"edit" | "visit">("edit"),
    [mobile, setMobile] = useState(window.innerWidth < 760),
    [picker, setPicker] = useState(false),
    [tab, setTab] = useState<"canvas" | "modules" | "settings">("canvas"),
    [previewReturn, setPreviewReturn] = useState(0),
    [replay, setReplay] = useState(0),
    [viewerPhotos, setViewerPhotos] = useState<Photo[]>([]),
    [viewer, setViewer] = useState<number | null>(null),
    [pending, setPending] = useState(""),
    [previewing, setPreviewing] = useState(false),
    [previewMobile, setPreviewMobile] = useState(false);
  /** Where the stage and the page stood before „Vorschau“, restored on „Bearbeiten“. */
  const previewReturnTo = useRef<{ stage: number; page: number } | null>(null);
  function openPreview() {
    const stage = document.querySelector<HTMLIFrameElement>(".modular-studio .preview-frame")?.contentWindow;
    previewReturnTo.current = { stage: stage?.scrollY ?? 0, page: window.scrollY };
    setPreviewMobile(mobile);
    setPreviewing(true);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }
  function closePreview() {
    setPreviewing(false);
  }
  useEffect(() => {
    const back = previewReturnTo.current;
    if (previewing || !back) return;
    previewReturnTo.current = null;
    window.scrollTo({ top: back.page, behavior: "instant" as ScrollBehavior });
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLIFrameElement>(".modular-studio .preview-frame")
        ?.contentWindow?.scrollTo({ top: back.stage, behavior: "instant" as ScrollBehavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [previewing]);
  const cinemaHandler = (e: KeyboardEvent) => {
    const action = previewKey(e);
    if (!action) return;
    if (action === "exit") {
      if (previewing) closePreview();
      return;
    }
    e.preventDefault();
    if (previewing) closePreview();
    else openPreview();
  };
  /** Variant changes for „Rückgängig“: one entry per change, valid while it is the latest edit. */
  const variantUndo = useRef<{ id: number; before: Chapter["layout"]; after: Chapter["layout"] }[]>([]);
  const [, setVariantUndoCount] = useState(0);
  function switchVariant(moduleId: number, preset: StylePreset) {
    const module = journey?.chapters.find((c) => c.id === moduleId);
    if (!module) return;
    const before = module.layout || {};
    const after = applyPreset(before, preset);
    if (sameLayout(before, after)) return;
    const run = () => {
      flushSync(() => moduleChange(moduleId, { layout: after }));
      variantUndo.current = [...variantUndo.current.slice(-49), { id: moduleId, before, after }];
      setVariantUndoCount(variantUndo.current.length);
    };
    const doc = document.querySelector<HTMLIFrameElement>(".preview-frame")?.contentDocument;
    const el = doc?.getElementById(`canvas-module-${moduleId}`);
    if (!doc || !el || motionIsOff()) return run();
    // 420 ms crossfade of the module on the stage (builder.css: ::view-transition-*(wander-variant)).
    const start = (doc as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }).startViewTransition;
    if (start) {
      el.style.setProperty("view-transition-name", "wander-variant");
      start
        .call(doc, run)
        .finished.catch(() => {})
        .finally(() => el.style.removeProperty("view-transition-name"));
    } else {
      run();
      el.animate([{ opacity: 0.35 }, { opacity: 1 }], {
        duration: 420,
        easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      });
    }
  }
  /** The last variant change, if nothing else changed that module since. */
  function lastVariantChange(moduleId?: number) {
    const top = variantUndo.current[variantUndo.current.length - 1];
    if (!top || (moduleId !== undefined && top.id !== moduleId)) return null;
    const module = journey?.chapters.find((c) => c.id === top.id);
    if (!module || !sameLayout(module.layout, top.after)) return null;
    return top;
  }
  function undoVariant(moduleId?: number) {
    const top = lastVariantChange(moduleId);
    if (!top) {
      if (variantUndo.current.length) {
        variantUndo.current = [];
        setVariantUndoCount(0);
      }
      return false;
    }
    variantUndo.current = variantUndo.current.slice(0, -1);
    setVariantUndoCount(variantUndo.current.length);
    moduleChange(top.id, { layout: top.before });
    if (selected.type !== "module" || selected.id !== top.id) select({ type: "module", id: top.id });
    return true;
  }
  const variantActions: VariantActions = {
    apply: switchVariant,
    undo: (id) => undoVariant(id),
    canUndo: (id) => !!lastVariantChange(id),
  };
  const stageKeys = (e: KeyboardEvent) => {
    if (mode === "edit" && journey && !previewing) {
      if (undoKey(e) && undoVariant()) {
        e.preventDefault();
        return;
      }
      const dir = variantKey(e);
      const current =
        dir && selected.type === "module"
          ? journey.chapters.find((c) => c.id === selected.id)
          : undefined;
      const next = current && dir ? stepVariant(current.layout, current.kind, dir) : null;
      if (current && next) {
        e.preventDefault();
        switchVariant(current.id, next);
        return;
      }
    }
    cinemaHandler(e);
  };
  const cinemaHandlerRef = useRef(stageKeys);
  cinemaHandlerRef.current = stageKeys;
  useEffect(() => {
    const key = (e: KeyboardEvent) => cinemaHandlerRef.current(e);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const [deletingModule, setDeletingModule] = useState<{ id: number; title: string; navigator: boolean } | null>(null);
  const deletingModuleRef = useRef(deletingModule);
  const deleteReturn = useRef<HTMLElement | null>(null);
  const [library, setLibrary] = useState(false),
    [discard, setDiscard] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false),
    [replaceCover, setReplaceCover] = useState(false),
    [deletingPhoto, setDeletingPhoto] = useState<Photo | null>(null),
    [deleteError, setDeleteError] = useState("");
  const [overwriteAsk, setOverwriteAsk] = useState(false);
  const [textFocus, setTextFocus] = useState<EditorContextValue["textFocus"]>(null);
  const [publishReview, setPublishReview] = useState<{
      content: string;
      revision: number;
    } | null>(null),
    [publishResult, setPublishResult] = useState<{
      title: string;
      slug: string;
    } | null>(null);
  // The draft is serialised only while the review dialog is open, once per change of the draft.
  const reviewOpen = publishReview !== null;
  const reviewContent = useMemo(
    () => (reviewOpen && journey ? JSON.stringify(journey) : null),
    [reviewOpen, journey],
  );
  const [addTarget, setAddTarget] = useState<number | null>(null),
    [chosenPhotos, setChosenPhotos] = useState<number[]>([]);
  const {
    drag,
    draggingId,
    moveAnnouncement,
    cancelDrag,
    reorder,
    dragHandleProps,
    rowDragProps,
    settleAfterIdChange,
  } = useModuleDrag({ draftRef, change, resetKey: `${mode}|${tab}|${slug}` });
  const [storyDraftOpen, setStoryDraftOpen] = useState(false),
    [draftWelcome, setDraftWelcome] = useState(false),
    [storyDraftUndo, setStoryDraftUndo] = useState<{
      snapshot: DraftSnapshot;
      revision: number;
      count: number;
      mode: DraftMode;
    } | null>(null),
    [freshIds, setFreshIds] = useState<number[]>([]),
    [titleFocus, setTitleFocus] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // After the automatic start: the suggested title is selected, so typing replaces it.
    if (!titleFocus) return;
    const input = titleInput.current;
    if (!input) return;
    setTitleFocus(false);
    input.focus();
    input.select();
  }, [titleFocus, journey]);
  const conflictBanner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conflicted)
      conflictBanner.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [conflicted]);
  const conflictMessage = t(
    "This story was changed elsewhere since you opened it. Choose which version to continue with. If you load the current one, your edits stay available as a local copy.",
    "Diese Geschichte wurde seit dem Öffnen woanders geändert. Wähle, mit welcher Version du weitermachst. Lädst du die aktuelle, bleiben deine Änderungen als lokale Wiederherstellung erhalten.",
  );
  useEffect(() => {
    if (!dirty && !uploadBusy) return;
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
  }, [dirty, uploadBusy]);
  // The link guard only has something to say while changes or an upload are open.
  useEffect(() => {
    if (pending && !dirty && !uploadBusy) setPending("");
  }, [pending, dirty, uploadBusy]);
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
  useEffect(() => {
    // Any manual edit after the draft makes "undo" ambiguous: retire the notice.
    if (storyDraftUndo && revision.current !== storyDraftUndo.revision)
      setStoryDraftUndo(null);
  }, [journey, storyDraftUndo]);
  useEffect(() => {
    if (!storyDraftUndo) return;
    const timer = setTimeout(() => setStoryDraftUndo(null), 120000);
    return () => clearTimeout(timer);
  }, [storyDraftUndo]);
  useEffect(() => {
    if (!freshIds.length) return;
    const timer = setTimeout(() => setFreshIds([]), 3000);
    return () => clearTimeout(timer);
  }, [freshIds]);
  /** Saving gave new modules their real IDs: everything that pointed at the temporary ID follows. */
  function reassignModuleIds(idMap: Map<number, number>) {
    select((active) => remapSelection(active, idMap));
    setAddTarget((target) =>
      target === null ? null : mappedId(target, idMap),
    );
    if (deletingModuleRef.current) {
      const pending = deletingModuleRef.current;
      deletingModuleRef.current = { ...pending, id: mappedId(pending.id, idMap) };
      setDeletingModule(deletingModuleRef.current);
    }
    settleAfterIdChange(idMap);
    if (imageReturn.current)
      imageReturn.current.moduleId = mappedId(imageReturn.current.moduleId, idMap);
  }
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
      title: kind === "chapter" && formOf(journey) !== "journey" ? t("Chapter", "Kapitel") : t(...moduleNames[kind]),
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
        ...initialLayoutFor(kind),
        ...(day ? { parent_id: day } : {}),
        ...(kind === "pair" ? { columns: 2 } : {}),
        ...(kind === "wall" ? { wall_mode: "balanced" as const, gap: 12 } : {}),
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
  function keepSelection(chapters: Chapter[]) {
    select((active) =>
      (active.type === "module" && !chapters.some((c) => c.id === active.id)) ||
      (active.type === "photo" && active.moduleId !== undefined && active.moduleId !== null &&
        !chapters.some((c) => c.id === active.moduleId))
        ? { type: "hero" }
        : active,
    );
  }
  function createStoryDraft(mode: DraftMode, words?: StoryWords | null) {
    const current = draftRef.current;
    setStoryDraftOpen(false);
    if (!current || conflicted || uploadBusy) return;
    cancelDrag();
    const form = formOf(current);
    // "By mood" follows the light arc (not for a moment): read the light first, then draft.
    const lit = mode === "mood" && form !== "moment";
    const light = lit ? cachedLights(current.photos) : undefined;
    if (lit && !light) {
      void readLights(current.photos).then(() => createStoryDraft(mode, words));
      return;
    }
    const modules = draftStory(
      current.photos.map((p) => ({
        id: p.id,
        width: p.width,
        height: p.height,
        taken_at: p.taken_at,
        position: p.position,
        featured: p.featured,
      })),
      mode,
      { locale: uiLocale, coverPhotoId: current.cover_id ?? current.cover?.id ?? null, light },
    ).map((module) =>
      // "Day n" is only handed out automatically for journeys.
      module.kind === "chapter"
        ? {
            ...module,
            title: draftChapterTitle(
              form,
              module.title,
              module.date,
              (day) => dateLabel(day, { day: "numeric", month: "long" }),
              uiLocale,
            ),
          }
        : module,
    );
    // Every new module gets the usual default title; only a day / chapter must not be untitled.
    const titleFor = (kind: Chapter["kind"]) =>
      kind === "chapter" && form !== "journey" ? t("Chapter", "Kapitel") : t(...moduleNames[kind]);
    const result = applyStoryDraft(current, modules, {
      firstId: nextModuleId(),
      newPlacementId: () => crypto.randomUUID(),
      titleFor,
    });
    if (!result) {
      setError(
        t(
          "This draft would exceed the maximum number of modules. Nothing was changed.",
          "Dieser Entwurf würde die maximale Modulanzahl überschreiten. Es wurde nichts geändert.",
        ),
      );
      return;
    }
    const snapshot = { chapters: current.chapters, photos: current.photos };
    // Words from the assistant (step 4) are written into the fresh modules right away.
    const nextChapters = words
      ? applyStoryWords(result.chapters, words, () => nextModuleId() - result.chapters.length - 1, titleFor)
      : result.chapters;
    const createdIds = nextChapters.filter((c) => !current.chapters.some((o) => o.id === c.id)).map((c) => c.id);
    draftRef.current = { ...current, chapters: nextChapters, photos: result.photos };
    change({ chapters: nextChapters, photos: result.photos });
    keepSelection(nextChapters);
    setFreshIds(motionOff ? [] : createdIds);
    setStoryDraftUndo({
      snapshot,
      revision: revision.current,
      count: createdIds.length,
      mode,
    });
  }
  /** "By days" ⇄ "By mood" straight from the undo notice: restore, then draft the other way. */
  function switchStoryDraft() {
    const state = storyDraftUndo;
    if (!state) return;
    undoStoryDraft();
    createStoryDraft(state.mode === "days" ? "mood" : "days");
  }
  function undoStoryDraft() {
    const state = storyDraftUndo,
      current = draftRef.current;
    setStoryDraftUndo(null);
    setFreshIds([]);
    if (!state || !current || revision.current !== state.revision) return;
    cancelDrag();
    const restored = restoreStoryDraft(current, state.snapshot, nextModuleId());
    draftRef.current = { ...current, ...restored };
    change(restored);
    keepSelection(restored.chapters);
  }
  function requestModuleRemoval(id: number, trigger: HTMLElement, navigator = false) {
    const current = draftRef.current;
    const chapter = current?.chapters.find((c) => c.id === id);
    if (!chapter) return;
    cancelDrag();
    deleteReturn.current = trigger;
    deletingModuleRef.current = { id, title: moduleLabel(chapter), navigator };
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
  function adoptPhotoDates(range: DateRange) {
    change({
      start_date: range.start,
      end_date: formOf(journey) === "moment" ? range.start : range.end,
      layout: { ...journey?.layout, dates_from_photos: true },
    });
  }
  const startChecked = useRef(false);
  useEffect(() => {
    // /studio/new?start=1 → design the story once without asking (undo stays available), then drop the parameter.
    if (!journey || startChecked.current) return;
    startChecked.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get("start") !== "1") return;
    const requestedMode = draftModeFromParam(url.searchParams.get("mode"));
    url.searchParams.delete("start");
    url.searchParams.delete("mode");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    // Words typed in the assistant wait in sessionStorage: read once, then remove.
    let words: StoryWords | null = null;
    try {
      const key = wordsKey(journey.slug);
      words = parseWords(window.sessionStorage.getItem(key));
      window.sessionStorage.removeItem(key);
    } catch {
      /* storage unavailable: start without words */
    }
    if (journey.photos.length === 0) return;
    const form = formOf(journey);
    const range = photoDateRange(journey.photos);
    const suggestion = isPlaceholderTitleOfAnyForm(journey.title)
      ? form === "journey"
        ? suggestJourneyTitle(range, uiLocale)
        : form === "moment"
          ? suggestMomentTitle(range, uiLocale)
          : null
      : null;
    // The title comes first so that the undo notice of the draft stays valid.
    if (words?.title) change({ title: words.title });
    else if (suggestion) change({ title: suggestion });
    if (journey.photos.length >= 2)
      createStoryDraft(
        requestedMode ??
          initialDraftMode(form, journey.photos.length, journey.photos.filter((p) => dayOf(p.taken_at)).length),
        words,
      );
    if (window.innerWidth >= 760) setTitleFocus(true);
  }, [journey]);
  const lastRange = useRef<DateRange | null | undefined>(undefined);
  useEffect(() => {
    if (!journey) return;
    const next = photoDateRange(journey.photos);
    const before = lastRange.current;
    lastRange.current = next;
    // First load only records the baseline; later photo changes may update the dates.
    if (before === undefined) {
      if (next && journey.layout?.dates_from_photos === true &&
          (journey.start_date !== next.start ||
            journey.end_date !== (formOf(journey) === "moment" ? next.start : next.end)))
        adoptPhotoDates(next);
      return;
    }
    if (next && shouldAdoptDates(journey.layout?.dates_from_photos, before, next))
      adoptPhotoDates(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey?.photos]);
  const layoutIssueRef = useRef(layoutIssue);
  useEffect(() => {
    if (!layoutIssue || layoutIssueRef.current === layoutIssue) return;
    layoutIssueRef.current = layoutIssue;
    openLayoutIssue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutIssue]);
  if (!journey)
    return (
      <PageState
        title={
          error
            ? t("This story is out of reach.")
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
  /** Selects the module a rejected setting belongs to and opens its settings. */
  function openLayoutIssue() {
    const id = layoutIssue?.moduleId;
    if (id == null || !journey?.chapters.some((c) => c.id === id)) return;
    select({ type: "module", id });
    setTab("settings");
  }
  async function deleteSource() {
    if (!deletingPhoto || saving.current || uploadBusy || conflicted) return;
    setDeleteError("");
    const beforeSave = revision.current;
    const base = dirty ? await save(false, true) : draftRef.current;
    if (!base) {
      // Deleting needs the saved version first; say why it stopped instead of doing nothing.
      setDeleteError(
        t("The photograph was not deleted because your changes could not be saved first: ", "Das Foto wurde nicht gelöscht, weil deine Änderungen vorher nicht gespeichert werden konnten: ") +
          (saveFailure.current || t("Please try again.", "Bitte versuche es noch einmal.")),
      );
      return;
    }
    if (revision.current !== beforeSave) {
      setDeleteError(t("Your story changed while saving. Please delete again.", "Deine Geschichte hat sich beim Speichern geändert. Bitte lösche noch einmal."));
      return;
    }
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
  const uploadPhotoIds = j.photos.map((p) => p.id);
  // The upload list asks to delete through the same confirm dialog as the grid.
  const askDeleteUploaded = (id: number) => {
    const photo = j.photos.find((p) => p.id === id);
    if (photo) setDeletingPhoto(photo);
  };
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
    (publishReview.content !== reviewContent ||
      publishReview.revision !== revision.current);
  const retryIn = retryDelayMs({ failures });
  const retryPlanned = autoError && dirty && !conflicted && !uploadBusy && retryIn !== null;
  const status = autoError
    ? retryPlanned
      ? backgroundSaving
        ? t("Trying to save again…", "Speichern wird erneut versucht…")
        : !online
          ? t("Offline – will retry automatically", "Offline – wird automatisch erneut versucht")
          : t(
              `Save failed – retrying in ${retrySeconds(retryIn)} s`,
              `Speichern fehlgeschlagen – neuer Versuch in ${retrySeconds(retryIn)} s`,
            )
      : t("Save failed · retry", "Speichern fehlgeschlagen · erneut versuchen")
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
  const dayNumbers = new Map(
    j.chapters.filter((c) => c.kind === "chapter").map((c, i) => [c.id, i + 1]),
  );
  const moduleList = (parent?: number) =>
    j.chapters
      .filter((c) => (c.layout?.parent_id || undefined) === parent)
      .map((c) => (
        <div
          key={c.id}
          data-module-id={c.id}
          style={freshIds.includes(c.id) ? ({ "--fresh-index": freshIds.indexOf(c.id) } as CSSProperties) : undefined}
          {...rowDragProps(c.id)}
          className={`module-nav-item ${freshIds.includes(c.id) ? "story-draft-fresh" : ""} ${draggingId === c.id ? "module-dragging" : ""} ${drag?.target === c.id ? (drag.inside ? "module-drop-inside" : drag.after ? "module-drop-after" : "module-drop-before") : ""}`}
        >
          <button
            type="button"
            className="module-drag-handle"
            aria-label={`${t("Move module", "Modul verschieben")}: ${moduleLabel(c)}`}
            title={t(
              "Drag to reorder; use Up/Down keys",
              "Zum Verschieben ziehen; Pfeiltasten oben/unten verwenden",
            )}
            aria-describedby="module-reorder-help"
            {...dragHandleProps(c.id)}
          >
            <GripVertical size={16} />
          </button>
          <button
            title={`${t(...moduleNames[c.kind])} · ${moduleLabel(c)}`}
            className={`module-nav-select ${c.kind === "chapter" ? "is-day" : "is-shot"} ${selected.type === "module" && selected.id === c.id ? "active" : ""}`}
            onClick={() => {
              select({ type: "module", id: c.id });
              setTab("settings");
            }}
          >
            {c.kind === "chapter" ? (
              <span className="nav-day">
                <span className="nav-day-no">{String(dayNumbers.get(c.id) ?? 1).padStart(2, "0")}</span>
                <strong>{moduleLabel(c)}</strong>
                {/^\d{4}-\d{2}-\d{2}$/.test(c.date) && (
                  <small>{dateLabel(c.date, { day: "numeric", month: "short" })}</small>
                )}
              </span>
            ) : (
              <>
                <NavThumbs module={c} journey={j} />
                <strong className="nav-shot-name">{moduleLabel(c)}</strong>
              </>
            )}
          </button>
          <button
            type="button"
            className="module-delete-button"
            aria-label={`${t("Delete module", "Modul löschen")}: ${moduleLabel(c)}`}
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
  const pickerCard = (key: Chapter["kind"]) => {
    const names = moduleNames[key];
    const use = {
      chapter: t("Opens a day with a heading", "Eröffnet einen Tag mit Überschrift"),
      text: t("A few words between photographs", "Ein paar Worte zwischen den Fotos"),
      quote: t("One line that stays", "Ein Satz, der bleibt"),
      hero: t("Opens with a defining photograph", "Eröffnet mit einem prägenden Foto"),
      image: t("One photograph, given room", "Ein Foto, dem Raum gehört"),
      pair: t("Two photographs in conversation", "Zwei Fotos im Zwiegespräch"),
      rail: t("Explore at your own pace", "Im eigenen Tempo entdecken"),
      wall: t("Several photos, calmly side by side", "Mehrere Fotos, ruhig nebeneinander"),
      gallery: t("A browsable collection", "Eine blätterbare Sammlung"),
      filmstrip: t("A moving, atmospheric band", "Ein bewegtes Band als Akzent"),
    }[key];
    const shapes: Record<Chapter["kind"], ReactNode> = {
      chapter: (
        <>
          <text x="6" y="30" fontSize="26" fontFamily="Instrument Serif, serif" fill="currentColor" opacity="0.7">1</text>
          <path d="M28 22h46M28 30h30" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
        </>
      ),
      text: (
        <path d="M8 10h64M8 18h64M8 26h64M8 34h40" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      ),
      quote: (
        <text x="6" y="40" fontSize="44" fontFamily="Instrument Serif, serif" fill="currentColor" opacity="0.6">“</text>
      ),
      hero: (
        <>
          <rect x="2" y="3" width="76" height="36" fill="currentColor" opacity="0.22" />
          <path d="M10 30h34" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        </>
      ),
      image: <rect x="22" y="4" width="36" height="34" fill="currentColor" opacity="0.28" />,
      pair: (
        <>
          <rect x="6" y="6" width="32" height="30" fill="currentColor" opacity="0.28" />
          <rect x="42" y="6" width="32" height="30" fill="currentColor" opacity="0.18" />
        </>
      ),
      rail: (
        <>
          <rect x="4" y="9" width="22" height="24" fill="currentColor" opacity="0.28" />
          <rect x="29" y="9" width="22" height="24" fill="currentColor" opacity="0.2" />
          <rect x="54" y="9" width="22" height="24" fill="currentColor" opacity="0.12" />
        </>
      ),
      wall: (
        <g fill="currentColor">
          <rect x="4" y="4" width="30" height="16" opacity="0.28" />
          <rect x="37" y="4" width="39" height="16" opacity="0.18" />
          <rect x="4" y="23" width="42" height="16" opacity="0.2" />
          <rect x="49" y="23" width="27" height="16" opacity="0.3" />
        </g>
      ),
      gallery: (
        <g fill="currentColor">
          <rect x="6" y="5" width="20" height="14" opacity="0.28" />
          <rect x="30" y="5" width="20" height="14" opacity="0.2" />
          <rect x="54" y="5" width="20" height="14" opacity="0.28" />
          <rect x="6" y="23" width="20" height="14" opacity="0.2" />
          <rect x="30" y="23" width="20" height="14" opacity="0.28" />
          <rect x="54" y="23" width="20" height="14" opacity="0.2" />
        </g>
      ),
      filmstrip: (
        <g fill="currentColor">
          <rect x="-6" y="11" width="24" height="20" opacity="0.28" />
          <rect x="21" y="11" width="24" height="20" opacity="0.2" />
          <rect x="48" y="11" width="24" height="20" opacity="0.28" />
          <rect x="75" y="11" width="24" height="20" opacity="0.2" />
        </g>
      ),
    };
    return (
      <button key={key} type="button" className="mp-card" onClick={() => add(key)}>
        <svg className="mp-thumb" viewBox="0 0 80 42" aria-hidden="true" focusable="false">
          {shapes[key]}
        </svg>
        <strong>{t(...names)}</strong>
        <small>{use}</small>
      </button>
    );
  };
  const editor: EditorContextValue = {
    journey: j,
    selected,
    module,
    photo,
    photoModule,
    selectionLabel,
    busy,
    backgroundSaving,
    uploadBusy,
    conflicted,
    titleInput,
    change,
    moduleChange,
    photoChange,
    layoutChange,
    save,
    selectCanvas,
    returnToModule,
    removePlacement,
    adoptPhotoDates,
    reorder,
    duplicate,
    requestModuleRemoval,
    uploaded,
    askDeleteUploaded,
    markConflict,
    setUploadBusy,
    openPicker: () => setPicker(true),
    chooseImage: (forCover) => {
      setReplaceCover(forCover);
      setReplaceOpen(true);
    },
    deletePhoto: setDeletingPhoto,
    textFocus,
    layoutIssue,
    clearTextFocus: () => setTextFocus(null),
    showSelectionInPreview: () => {
      setTab("canvas");
      setPreviewReturn((value) => value + 1);
    },
  };
  // „Vorschau“: the visitor page itself (same renderer, current draft). It comes first in the
  // document so its own #main is the one the page effects find; the editor stays mounted, hidden.
  const preview = previewing && (
    <div className={`story-preview-layer ${previewMobile ? "is-phone" : ""}`}>
      <div className="story-preview-pill" role="toolbar" aria-label={t("Preview", "Vorschau")}>
        <span>{t("Preview", "Vorschau")}</span>
        <span className="story-preview-devices">
          <button type="button" aria-pressed={!previewMobile} onClick={() => setPreviewMobile(false)}>
            {t("Desktop", "Desktop")}
          </button>
          <button type="button" aria-pressed={previewMobile} onClick={() => setPreviewMobile(true)}>
            {t("Phone", "Handy")}
          </button>
        </span>
        <button type="button" className="story-preview-edit" onClick={closePreview}>
          <Pencil size={15} aria-hidden="true" />
          {t("Edit", "Bearbeiten")}
        </button>
      </div>
      {previewMobile ? (
        <div className="story-preview-phone">
          <PreviewFrame mobile>
            <StoryExperience journey={j} preview />
          </PreviewFrame>
        </div>
      ) : (
        <StoryExperience journey={j} preview />
      )}
    </div>
  );
  return (
    <>
    {preview}
    <main
      id="main"
      className={`modular-studio studio-tab-${tab} ${mode === "visit" ? "visitor-preview" : ""}`}
      style={previewing ? { display: "none" } : undefined}
    >
      <header className="editor-bar">
        <div className="editor-identity">
          <Link
            to="/studio"
            aria-label={t("Back to studio", "Zurück zum Studio")}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <input
              className="editor-title-input"
              aria-label={t("Story title", "Titel der Geschichte")}
              title={t("Click to rename", "Zum Umbenennen klicken")}
              placeholder={t("Untitled", "Ohne Titel")}
              maxLength={160}
              size={Math.max(6, Math.min(40, j.title.length + 1))}
              value={j.title}
              onChange={(e) => change({ title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
              }}
            />
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
            type="button"
            className="editor-mode editor-preview-toggle"
            aria-pressed={previewing}
            title={t("Preview (F) · Esc returns", "Vorschau (F) · Esc kehrt zurück")}
            onClick={openPreview}
          >
            <Eye size={17} aria-hidden="true" />
            <span>{t("Preview", "Vorschau")}</span>
          </button>
          <button
            aria-label={t("Publish story", "Geschichte veröffentlichen")}
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
          <button
            onClick={() => void loadCurrentVersion()}
            disabled={conflictBusy || busy || backgroundSaving || uploadBusy}
          >
            {t("Load current version", "Aktuelle Version laden")}
          </button>
          <button
            onClick={() => setOverwriteAsk(true)}
            disabled={conflictBusy || busy || backgroundSaving || uploadBusy}
          >
            {t("Keep my version", "Meine Version behalten")}
          </button>
        </div>
      )}
      {error && (
        <div className="editor-error" role="alert">
          {error}
          {layoutIssue?.moduleId != null && (
            <button onClick={() => openLayoutIssue()}>
              {t("Go to module", "Zum Modul")}
            </button>
          )}
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
                  if (restoreRecovery(recovery)) select({ type: "hero" });
                }}
              >
                {t("Restore", "Wiederherstellen")}
              </button>
            </>
          ) : (
            <>
              {t(
                "This device still holds an older version of this story. You can back it up or discard it.",
                "Auf diesem Gerät liegt noch eine ältere Fassung dieser Geschichte. Du kannst sie sichern oder verwerfen.",
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
                {t("Save a copy", "Fassung sichern")}
              </button>
            </>
          )}
          <button
            onClick={async () => {
              const cleared = await discardRecovery(recovery);
              if (!cleared)
                setError(t("The local draft could not be discarded.", "Der lokale Entwurf konnte nicht verworfen werden."));
            }}
          >
            {t("Discard", "Verwerfen")}
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
              type="button"
              className="story-draft-button"
              disabled={j.photos.length < 2 || conflicted || uploadBusy}
              aria-describedby={j.photos.length < 2 ? "story-draft-hint" : undefined}
              onClick={() => setStoryDraftOpen(true)}
            >
              <Sparkles size={17} aria-hidden="true" />
              {t("Design story", "Story gestalten")}
            </button>
            {j.photos.length < 2 && (
              <small id="story-draft-hint" className="story-draft-hint">
                {t(
                  "Add at least two photographs to create a draft.",
                  "Lade mindestens zwei Fotos hoch, um einen Entwurf zu erstellen.",
                )}
              </small>
            )}
            <button className="library-button" onClick={() => setLibrary(true)}>
              <Images size={17} />
              {t("Photographs", "Fotosammlung")}
              <span>{j.photos.length}</span>
            </button>
            <button
              className={`cover-nav ${selected.type === "hero" ? "active" : ""}`}
              onClick={() => {
                select({ type: "hero" });
                setTab("settings");
              }}
            >
              {t("Story cover", "Titelbild")}
            </button>
            {moduleList()}
            <button
              className="add-module-button"
              onClick={() => setPicker(true)}
            >
              <Plus size={17} />
              {t("Add module", "Modul hinzufügen")}
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
          <div
            className={`canvas-device ${mobile ? "device-mobile" : ""}`}
            data-edition={j.story_template === "after-hours" ? "last-light" : "first-light"}
          >
            <PreviewFrame mobile={mobile}>
              <JournalCanvas
                journey={j}
                editing={mode === "edit"}
                emptyState={
                  mode === "edit" ? (
                    <div className="editor-empty-state">
                      <p>
                        {t(
                          "No modules yet. “Design story” arranges your photographs automatically – or add a module.",
                          "Noch keine Module. „Story gestalten“ ordnet deine Fotos automatisch – oder füge ein Modul hinzu.",
                        )}
                      </p>
                      <div>
                        <button
                          type="button"
                          className="button"
                          disabled={j.photos.length < 2 || conflicted || uploadBusy}
                          onClick={() => setStoryDraftOpen(true)}
                        >
                          <Sparkles size={16} aria-hidden="true" />
                          {t("Design story", "Story gestalten")}
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => setPicker(true)}
                        >
                          <Plus size={16} aria-hidden="true" />
                          {t("Add module", "Modul hinzufügen")}
                        </button>
                      </div>
                    </div>
                  ) : undefined
                }
                selected={selected}
                onSelect={selectCanvas}
                onEmptyModule={(id) => {
                  selectCanvas({ type: "module", id });
                  setAddTarget(id);
                  setChosenPhotos([]);
                }}
                onWriteText={(id) => {
                  selectCanvas({ type: "module", id });
                  setTextFocus({ moduleId: id, field: "story", nonce: Date.now() });
                }}
                onEditText={(target, value) => {
                  if ("journey" in target) {
                    // A story keeps a title: an emptied title springs back.
                    if (target.journey === "title" && !value) return;
                    change({ [target.journey]: value });
                  } else moduleChange(target.module, { [target.field]: value });
                }}
                onPhoto={(p, sequence = j.photos) => {
                  setViewerPhotos(sequence);
                  setViewer(sequenceIndex(sequence, p));
                }}
                replay={replay}
              />
              {mode === "edit" && (() => {
                const current =
                  selected.type === "module"
                    ? j.chapters.find((c) => c.id === selected.id) ?? null
                    : null;
                if (!current) return null;
                const state = variantState(current.layout, current.kind);
                return (
                  <StageVariants
                    moduleId={current.id}
                    revision={j}
                    index={state.index}
                    count={state.list.length}
                    name={state.index >= 0 ? t(...state.list[state.index].label) : ""}
                    customised={state.customised}
                    onStep={(dir) => {
                      const next = stepVariant(current.layout, current.kind, dir);
                      if (next) switchVariant(current.id, next);
                    }}
                  />
                );
              })()}
              {mode === "edit" && (() => {
                const current =
                  selected.type === "module"
                    ? j.chapters.find((c) => c.id === selected.id) ?? null
                    : null;
                const siblings = current
                  ? j.chapters.filter(
                      (c) => (c.layout?.parent_id || null) === (current.layout?.parent_id || null),
                    )
                  : [];
                const index = current ? siblings.findIndex((c) => c.id === current.id) : -1;
                return (
                  <StageActions
                    moduleId={current?.id ?? null}
                    revision={j}
                    canUp={index > 0}
                    canDown={index >= 0 && index < siblings.length - 1}
                    onUp={() => current && reorder(current.id, -1)}
                    onDown={() => current && reorder(current.id, 1)}
                    onDuplicate={() => current && duplicate(current)}
                    onRemove={(trigger) => current && requestModuleRemoval(current.id, trigger)}
                    onKey={stageKeys}
                  />
                );
              })()}
            </PreviewFrame>
          </div>
          {mode === "edit" && (
            <button className="canvas-add" onClick={() => setPicker(true)}>
              <Plus size={18} />
              {t("Add module", "Modul hinzufügen")}
            </button>
          )}
        </div>
        {mode === "edit" && (
          <EditorContext.Provider value={editor}>
            <VariantContext.Provider value={variantActions}>
              <Inspector />
            </VariantContext.Provider>
          </EditorContext.Provider>
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
          className="module-picker module-picker-v2"
        >
          <h2>{t("Add module", "Modul hinzufügen")}</h2>
          <div className="mp-groups">
            {pickerGroups.map((g) => (
              <section key={g.id} className="mp-group">
                <h3>{t(...g.title)}</h3>
                <div className={`mp-grid mp-grid-${g.kinds.length}`}>{g.kinds.map(pickerCard)}</div>
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
                photoIds={uploadPhotoIds}
                onRemovePhoto={askDeleteUploaded}
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
      {storyDraftOpen && (
        <StoryDraftDialog
          total={j.photos.length}
          dated={j.photos.filter((p) => dayOf(p.taken_at)).length}
          form={formOf(j)}
          welcome={draftWelcome}
          onCreate={createStoryDraft}
          onClose={() => {
            setStoryDraftOpen(false);
            setDraftWelcome(false);
          }}
        />
      )}
      <div className="story-draft-toast-region" role="status" aria-live="polite">
        {storyDraftUndo && (
          <div className="story-draft-toast">
            <span>
              {t("Draft created", "Entwurf erstellt")} ·{" "}
              {t(
                `${storyDraftUndo.count} modules`,
                `${storyDraftUndo.count} Module`,
              )}
            </span>
            <button
              type="button"
              className="story-draft-undo"
              onClick={undoStoryDraft}
            >
              {t("Undo", "Rückgängig")}
            </button>
            {(storyDraftUndo.mode === "days" ||
              j.photos.some((p) => dayOf(p.taken_at))) && (
              <button
                type="button"
                className="story-draft-undo"
                onClick={switchStoryDraft}
              >
                {storyDraftUndo.mode === "days"
                  ? t("By mood", "Nach Stimmung")
                  : t("By days", "Nach Tagen")}
              </button>
            )}
            <button
              type="button"
              className="story-draft-undo story-draft-close"
              aria-label={t("Dismiss", "Schließen")}
              onClick={() => setStoryDraftUndo(null)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
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
            photoIds={uploadPhotoIds}
            onRemovePhoto={askDeleteUploaded}
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
      {publishReview && (
        <Modal
          key="review"
          title={t("Review before publishing", "Vor Veröffentlichung prüfen")}
          className="publish-review"
          onClose={() => {
            if (saving.current || busy) return;
            setPublishReview(null);
          }}
        >
          <span className="eyebrow">
            {t("CURRENT LOCAL DRAFT", "AKTUELLER LOKALER ENTWURF")}
          </span>
          <h2>{j.title}</h2>
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
        </Modal>
      )}
      {publishResult && (
        <PublishedDialog
          title={publishResult.title}
          slug={publishResult.slug}
          cover={j.photos.find((p) => p.id === j.cover_id) ?? j.cover ?? null}
          newerChanges={dirty || !!j.has_unpublished_changes}
          onClose={() => setPublishResult(null)}
        />
      )}
      {viewer !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initial={viewer}
          onClose={() => setViewer(null)}
        />
      )}
      {overwriteAsk && conflicted && (
        <Modal
          title={t("Keep my version", "Meine Version behalten")}
          onClose={() => setOverwriteAsk(false)}
        >
          <h2>{t("Overwrite the other version?", "Die andere Version überschreiben?")}</h2>
          <p>
            {t(
              "Saving your version replaces the changes made elsewhere since you opened this story. They cannot be restored afterwards.",
              "Wenn du deine Version speicherst, werden die Änderungen überschrieben, die seit dem Öffnen woanders gemacht wurden. Sie lassen sich danach nicht wiederherstellen.",
            )}
          </p>
          <div className="confirm-actions">
            <button className="button button-outline" onClick={() => setOverwriteAsk(false)}>
              {t("Cancel", "Abbrechen")}
            </button>
            <button
              className="button"
              onClick={() => {
                setOverwriteAsk(false);
                void keepMyVersion();
              }}
            >
              {t("Overwrite", "Überschreiben")}
            </button>
          </div>
        </Modal>
      )}
      {(pending || discard) && uploadBusy && (
        <Modal
          title={t("Upload in progress", "Upload läuft")}
          onClose={() => {
            setPending("");
            setDiscard(false);
          }}
        >
          <h2>{t("Leave while uploading?", "Während des Uploads verlassen?")}</h2>
          <p>
            {t("An upload is still running.", "Ein Upload läuft noch.")}{" "}
            {t(
              "If you leave now, it may be interrupted.",
              "Wenn du jetzt gehst, kann er abbrechen.",
            )}
          </p>
          <div className="confirm-actions">
            <button
              className="button"
              onClick={() => {
                setPending("");
                setDiscard(false);
              }}
            >
              {t("Stay here", "Hier bleiben")}
            </button>
            {pending && (
              <button
                className="button button-outline"
                onClick={() => {
                  const next = pending;
                  setPending("");
                  setDiscard(false);
                  navigate(next);
                }}
              >
                {t("Leave anyway", "Trotzdem verlassen")}
              </button>
            )}
          </div>
        </Modal>
      )}
      {(pending || discard) && !uploadBusy && (
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
                const outcome = await discardChanges();
                if (outcome === "blocked") return;
                if (outcome === "failed") {
                  setError(t("The local draft could not be discarded.", "Der lokale Entwurf konnte nicht verworfen werden."));
                  setDiscard(false);
                  return;
                }
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
    </>
  );
}
