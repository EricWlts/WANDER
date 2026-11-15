import { useEffect, useRef, useState } from "react";
import { ApiError, api, json } from "../api";
import { t } from "../I18n";
import { mergeSavedJourney } from "../journalModel";
import { moduleNames } from "../JournalCanvas";
import { layoutIssue as describeLayoutIssue, type LayoutIssue } from "./layoutIssue";
import {
  readRecoveries,
  removeRecovery,
  writeRecovery,
  type RecoveryCopy,
} from "../recoveryModel";
import {
  initialRetryState,
  nextRetryState,
  retryDelayMs,
  type RetryEvent,
} from "../autosaveRetry";
import type { Chapter, Journey, Layout, Photo } from "../types";
import {
  canAutosave,
  canRetry,
  chapterIdMap,
  compositionPayload,
  reconcileWithServer,
} from "./compositionModel";

function recoveryStores(): Storage[] {
  return (["localStorage", "sessionStorage"] as const).flatMap((name) => {
    try {
      return [window[name]];
    } catch {
      return [];
    }
  });
}

/** Wartezeit nach der letzten Änderung, bevor der Entwurf lokal gesichert wird. */
const RECOVERY_DEBOUNCE_MS = 1000;

async function withRecoveryLock<T>(id: number, action: () => T): Promise<T> {
  // Tabs using this editor serialize read/modify/write on the shared local slot.
  if (navigator.locks) return navigator.locks.request(`wander-recovery-${id}`, action);
  return action();
}

export type CompositionOptions = {
  slug: string | undefined;
  /** An upload blocks saving, autosave and loading another version. */
  uploadBusy: boolean;
  notify: (message: string) => void;
  /** Saving replaced temporary module IDs: selection, drag, focus and dialogs follow them. */
  onIdsReassigned: (idMap: Map<number, number>) => void;
  /** A publish went through. */
  onPublished: (result: { title: string; slug: string }) => void;
  /** A conflict or a reload makes an open publish review obsolete. */
  onReviewInvalid: () => void;
  /** The current server version replaced the draft. */
  onVersionLoaded: () => void;
};

/**
 * The composition core of the editor: the draft, its revision, saving with
 * autosave and retry, version conflicts and the local recovery copy.
 * Everything that only concerns the screen is reported through the options.
 */
export function useComposition(options: CompositionOptions) {
  const { slug, uploadBusy, notify } = options;
  const [journey, setJourney] = useState<Journey | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false),
    [autoError, setAutoError] = useState(false);
  /** Last save rejected because of one module's setting; null when the last save went through. */
  const [layoutIssue, setLayoutIssue] = useState<LayoutIssue | null>(null);
  /** Why the last save() returned null (shown where a follow-up action had to stop). */
  const saveFailure = useRef("");
  const [failures, setFailures] = useState(0),
    [online, setOnline] = useState(() => navigator.onLine),
    [conflictBusy, setConflictBusy] = useState(false);
  const retry = useRef(initialRetryState);
  function retryEvent(event: RetryEvent) {
    retry.current = nextRetryState(retry.current, event);
    setFailures(retry.current.failures);
  }
  const [conflicted, setConflicted] = useState(false);
  function markConflict() {
    setConflicted(true);
    setAutoError(false);
    retryEvent("success");
    setError("");
    options.onReviewInvalid();
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
  // Preserve unfinished edits across an accidental reload, without replacing server data.
  // Debounced: a burst of keystrokes writes the draft once, 1 s after the last change.
  // Leaving the page or the editor writes a pending copy immediately.
  const flushRecovery = useRef<(() => void) | null>(null);
  useEffect(() => {
    const flush = () => flushRecovery.current?.();
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    // Declared before the writing effect, so on unmount it runs while that write is still wanted.
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, []);
  useEffect(() => {
    if (!journey || !dirty) {
      flushRecovery.current = null;
      return;
    }
    // `active` ends when a newer draft (or a save) replaces this one; a flush on leaving ignores it.
    let active = true;
    const write = (force: boolean) => {
      window.clearTimeout(timer);
      if (flushRecovery.current === flush) flushRecovery.current = null;
      void withRecoveryLock(journey.id, () => {
        if (!active && !force) return;
        const copy = writeRecovery(recoveryStores(), journey, ownedRecovery.current);
        if (copy) ownedRecovery.current = copy;
        setRecoveryUnavailable(!copy);
      }).catch(() => {
        if (active || force) setRecoveryUnavailable(true);
      });
    };
    const flush = () => write(true);
    const timer = window.setTimeout(() => write(false), RECOVERY_DEBOUNCE_MS);
    flushRecovery.current = flush;
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [journey, dirty]);
  function change(patch: Partial<Journey>) {
    revision.current++;
    setJourney((j) => (j ? { ...j, ...patch } : j));
    setDirty(true);
  }
  function moduleChange(id: number, patch: Partial<Chapter>) {
    revision.current++;
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
  async function loadCurrentVersion() {
    const mine = draftRef.current;
    if (!mine || saving.current || uploadBusy) return;
    setConflictBusy(true);
    try {
      if (dirty) {
        // Make sure the local copy matches the draft before it is replaced.
        const copy = await withRecoveryLock(mine.id, () =>
          writeRecovery(recoveryStores(), mine, ownedRecovery.current),
        );
        if (!copy) {
          setError(
            t(
              "Your changes could not be backed up in this browser, so the current version was not loaded. Choose “Keep my version” instead.",
              "Deine Änderungen ließen sich in diesem Browser nicht sichern, deshalb wurde die aktuelle Version nicht geladen. Wähle stattdessen „Meine Version behalten“.",
            ),
          );
          return;
        }
        ownedRecovery.current = copy;
      }
      const server = await api<Journey>(`/journeys/${slug}`);
      revision.current++;
      ownedRecovery.current = null;
      saved.current = server;
      retryEvent("success");
      setConflicted(false);
      setError("");
      setAutoError(false);
      options.onReviewInvalid();
      setDirty(false);
      options.onVersionLoaded();
      refreshRecoveries(server.id);
      setJourney(server);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConflictBusy(false);
    }
  }
  async function keepMyVersion() {
    const mine = draftRef.current;
    if (!mine || saving.current || uploadBusy) return;
    setConflictBusy(true);
    try {
      const server = await api<Journey>(`/journeys/${slug}`);
      const merged = reconcileWithServer(mine, server);
      revision.current++;
      saved.current = server;
      draftRef.current = merged;
      setJourney(merged);
      setDirty(true);
      setConflicted(false);
      await save(false, false, true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConflictBusy(false);
    }
  }
  async function save(
    publish = false,
    silent = false,
    force = false,
  ): Promise<Journey | null> {
    const current = draftRef.current;
    if (!current || saving.current || uploadBusy || (conflicted && !force)) {
      saveFailure.current = uploadBusy
        ? t("Please wait until the upload has finished.", "Bitte warte, bis der Upload fertig ist.")
        : conflicted
          ? t("This story was changed elsewhere. Resolve that first.", "Die Geschichte wurde anderswo geändert. Kläre das zuerst.")
          : t("Saving is still in progress. Please try again in a moment.", "Es wird noch gespeichert. Bitte versuche es gleich noch einmal.");
      return null;
    }
    saving.current = true;
    saveFailure.current = "";
    const sentRevision = revision.current;
    // A manual save restarts the retry plan. Plan-driven attempts keep the
    // failure state so the status line does not flicker with every attempt.
    if (!silent) retryEvent("manual-save");
    const retrying = silent && retry.current.failures > 0;
    if (!retrying) {
      setAutoError(false);
      setError("");
    }
    if (silent) setBackgroundSaving(true);
    else setBusy(true);
    try {
      const next = await api<Journey>(
        `/journeys/${current.id}/composition`,
        json("PATCH", compositionPayload(current, publish)),
      );
      retryEvent("success");
      setAutoError(false);
      setError("");
      setLayoutIssue(null);
      const changed = revision.current !== sentRevision;
      const idMap = chapterIdMap(current.chapters, next.chapters);
      options.onIdsReassigned(idMap);
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
      if (publish) options.onPublished({ title: current.title, slug: next.slug });
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
      if (e instanceof ApiError && e.code === "composition_conflict") {
        markConflict();
        saveFailure.current = t("This story was changed elsewhere. Resolve that first.", "Die Geschichte wurde anderswo geändert. Kläre das zuerst.");
      } else if (e instanceof ApiError && e.code === "invalid_layout") {
        // Not a network hiccup: retrying cannot help, so point to the module instead.
        const id = typeof e.moduleId === "number" ? e.moduleId : null;
        const kind = id === null ? null : current.chapters.find((c) => c.id === id)?.kind;
        const issue = describeLayoutIssue(kind ? id : null, e.key ?? null, kind ? moduleNames[kind] : null, t);
        setLayoutIssue(issue);
        setError(issue.message);
        saveFailure.current = issue.message;
      } else {
        setError((e as Error).message);
        setAutoError(true);
        retryEvent("failure");
        saveFailure.current = (e as Error).message;
      }
      return null;
    } finally {
      saving.current = false;
      setBackgroundSaving(false);
      setBusy(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  const retryReady = canRetry({ dirty, busy, backgroundSaving, uploadBusy, autoError, conflicted });
  useEffect(() => {
    if (!retryReady) return;
    const delay = retryDelayMs({ failures });
    if (delay === null) return;
    const timer = setTimeout(() => void saveRef.current(false, true), delay);
    return () => clearTimeout(timer);
  }, [retryReady, failures]);
  const shortcutSaveRef = useRef(() => {});
  shortcutSaveRef.current = () => {
    if (busy || backgroundSaving || uploadBusy || conflicted) return;
    if (!dirty && !journey?.has_unpublished_changes) return;
    void save();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        shortcutSaveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const onlineRef = useRef(() => {});
  onlineRef.current = () => {
    if (!autoError || !dirty || conflicted) return;
    retryEvent("online");
    void save(false, true);
  };
  useEffect(() => {
    const on = () => {
      setOnline(true);
      onlineRef.current();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (!canAutosave({ dirty, busy, backgroundSaving, uploadBusy, autoError, conflicted })) return;
    const timer = setTimeout(() => void save(false, true), 850);
    return () => clearTimeout(timer);
  }, [journey, dirty, busy, backgroundSaving, uploadBusy, autoError, conflicted]);

  /** Puts a local copy back as the draft. True when it was restored. */
  function restoreRecovery(recovery: RecoveryCopy): boolean {
    const id = journey?.id;
    if (id === undefined || dirty || saving.current || busy || uploadBusy) return false;
    const available = readRecoveries(recoveryStores(), id).some(
      (copy) => copy.storage === recovery.storage && copy.raw === recovery.raw,
    );
    if (!available) {
      refreshRecoveries(id);
      return false;
    }
    revision.current++;
    ownedRecovery.current = recovery;
    setJourney(recovery.draft);
    setAutoError(false);
    setDirty(true);
    setRecoveries((copies) => copies.filter((copy) => copy !== recovery));
    return true;
  }
  /** Deletes one local copy. False when it could not be removed. */
  async function discardRecovery(recovery: RecoveryCopy): Promise<boolean> {
    const id = journey?.id;
    if (id === undefined) return false;
    return withRecoveryLock(id, () => clearRecovery(recovery)).catch(() => false);
  }
  /** Throws the open changes away and goes back to the last saved state. */
  async function discardChanges(): Promise<"blocked" | "failed" | "done"> {
    const id = journey?.id;
    if (id === undefined || saving.current || busy || uploadBusy) return "blocked";
    const cleared = await withRecoveryLock(id, () => {
      if (saving.current) return false;
      return !ownedRecovery.current || clearRecovery(ownedRecovery.current);
    }).catch(() => false);
    if (!cleared) return "failed";
    setDirty(false);
    setJourney(saved.current);
    return "done";
  }
  return {
    journey,
    setJourney,
    layoutIssue,
    setLayoutIssue,
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
  };
}
