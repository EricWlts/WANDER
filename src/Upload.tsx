import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { UploadCloud, RotateCcw, CheckCircle2, Trash2, Plus, X } from "lucide-react";
import { api, ApiError, uploadPhoto } from "./api";
import { t, useLocale } from "./I18n";
import {
  createFrameBatcher,
  formatMegabytes,
  formatSheetLine,
  formatSummary,
  isStaleSnapshot,
  sheetProgress,
  runPool,
  shouldSummarize,
  summarizeUploads,
  uploadConcurrency,
} from "./uploadProgress";
import type { Journey } from "./types";
type Item = {
  file: File;
  status: "waiting" | "uploading" | "processing" | "done" | "error" | "removed";
  percent: number;
  /** Bytes of the file transferred so far (excludes multipart overhead). */
  loaded?: number;
  error?: string;
  /** Removable lists only: local preview while uploading, the server variant afterwards. */
  thumb?: string;
  localPreview?: string;
  photoId?: number;
  abort?: AbortController;
};
export function Upload({
  journeyId,
  chapterId = null,
  onSave,
  onBusy,
  ensureJourney,
  multiple = true,
  disabled = false,
  removable = false,
  composition,
  onConflict,
  onFinish,
  photoIds,
  onRemovePhoto,
  variant = "list",
  photos,
  lead,
  pageDrop = false,
}: {
  journeyId?: number;
  composition?: { slug: string; version: number };
  onConflict?: () => void;
  multiple?: boolean;
  disabled?: boolean;
  /** Show a thumbnail and a remove button per photograph (cancels a running upload or deletes the uploaded photograph). */
  removable?: boolean;
  ensureJourney?: () => Promise<Journey>;
  chapterId?: number | null;
  onSave: (j: Journey) => void;
  onBusy?: (v: boolean) => void;
  /** After a batch: how many photographs arrived and how many failed (removed ones do not count). */
  onFinish?: (result: { added: number; failed: number }) => void;
  /** Ids of the photographs the host still has. Uploaded entries whose photograph is gone disappear from the list. */
  photoIds?: number[];
  /** Host-owned deletion (e.g. the editor's confirm dialog): adds a trash button to the long result list. */
  onRemovePhoto?: (photoId: number) => void;
  /** "lighttable": dark contact sheet of "Neue Geschichte" (step 1); "list": the compact editor list. */
  variant?: "list" | "lighttable";
  /** Light table: photographs the story already has (shown as developed frames when no file of this batch belongs to them). */
  photos?: Journey["photos"];
  /** Light table: shown on top of the table (the cover preview). */
  lead?: ReactNode;
  /** Light table: the whole page accepts dropped files and shows a veil while dragging. */
  pageDrop?: boolean;
}) {
  const { locale } = useLocale();
  const [items, setItems] = useState<Item[]>([]),
    [batch, setBatch] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState(false);
  const running = useRef(false),
    input = useRef<HTMLInputElement>(null),
    previews = useRef<string[]>([]),
    // Progress events only mutate the items; one re-render per animation frame shows them.
    refresh = useRef<ReturnType<typeof createFrameBatcher> | null>(null);
  if (!refresh.current)
    refresh.current = createFrameBatcher(
      () => setItems((list) => [...list]),
      (callback) => window.requestAnimationFrame(callback),
      (handle) => window.cancelAnimationFrame(handle),
    );
  useEffect(
    () => () => {
      refresh.current?.cancel();
      previews.current.forEach((url) => URL.revokeObjectURL(url));
      previews.current = [];
    },
    [],
  );
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0),
    dropFiles = useRef<(files: File[]) => void>(() => {});
  useEffect(() => {
    if (!pageDrop) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      dropFiles.current(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      dragDepth.current = 0;
      setDragging(false);
    };
  }, [pageDrop]);
  const makeItem = (file: File): Item => {
    const item: Item = { file, status: "waiting", percent: 0 };
    if (removable) {
      item.localPreview = URL.createObjectURL(file);
      item.thumb = item.localPreview;
      previews.current.push(item.localPreview);
    }
    return item;
  };
  async function remove(item: Item) {
    if (item.status === "uploading") {
      item.abort?.abort();
      return;
    }
    if (item.status === "waiting") {
      item.status = "removed";
      refresh.current?.request();
      return;
    }
    if (item.status === "error") {
      item.status = "removed";
      refresh.current?.request();
      return;
    }
    if (item.status === "done" && item.photoId !== undefined) {
      try {
        const saved = await api<Journey>(`/photos/${item.photoId}`, { method: "DELETE" });
        item.status = "removed";
        refresh.current?.request();
        onSave(saved);
      } catch (e) {
        item.error = (e as Error).message;
        refresh.current?.request();
      }
    }
  }
  async function run(next: Item[]) {
    if (running.current || disabled) return;
    running.current = true;
    setBusy(true);
    onBusy?.(true);
    setBatch(
      next.filter((item) => item.status !== "done" && item.status !== "error"),
    );
    setItems([...next]);
    try {
      const id = journeyId || (await ensureJourney?.())?.id;
      if (!id)
        throw new Error(
          t("Create a journey first.", "Bitte zuerst eine Reise anlegen."),
        );
      let basis = composition;
      let newest = 0;
      const upload = async (item: Item) => {
        item.error = undefined;
        item.status = "uploading";
        item.abort = new AbortController();
        item.percent = 0;
        item.loaded = 0;
        refresh.current?.request();
        try {
          const saved = await uploadPhoto<Journey>(
            `/journeys/${id}/photos`,
            item.file,
            chapterId,
            (p, loaded, total) => {
              const bytes =
                loaded !== undefined && total
                  ? Math.min(item.file.size, (item.file.size * loaded) / total)
                  : (item.file.size * p) / 100;
              item.percent = p;
              item.loaded = p === 100 ? item.file.size : bytes;
              item.status = p === 100 ? "processing" : "uploading";
              refresh.current?.request();
            },
            basis,
            item.abort.signal,
          );
          if (basis) basis = { ...basis, version: saved.composition_version ?? 0 };
          // With parallel uploads an older snapshot can arrive after a newer one: never let it win.
          if (!isStaleSnapshot(saved.composition_version, newest)) {
            newest = Math.max(newest, saved.composition_version ?? 0);
            onSave(saved);
          }
          item.loaded = item.file.size;
          const added = saved.photos.reduce<Journey["photos"][number] | undefined>((a, p) => (!a || p.id > a.id ? p : a), undefined);
          if (added) {
            item.thumb = added.url; // small preview in the result list
            if (removable || onRemovePhoto) item.photoId = added.id;
            if (item.localPreview) URL.revokeObjectURL(item.localPreview);
            previews.current = previews.current.filter((url) => url !== item.localPreview);
            item.localPreview = undefined;
          }
          item.status = "done";
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            item.status = "removed";
            refresh.current?.request();
            return;
          }
          if (e instanceof ApiError && e.code === "composition_conflict") {
            onConflict?.();
            throw e;
          }
          item.status = "error";
          item.error = (e as Error).message;
        }
        refresh.current?.request();
      };
      // Journeys guarded by a composition version stay sequential: the backend raises the
      // version per photo, so parallel requests with the same basis would conflict.
      await runPool(
        next,
        uploadConcurrency(Boolean(composition)),
        upload,
        (item) => item.status === "done" || item.status === "error" || item.status === "removed",
      );
    } catch (e) {
      next.forEach((item) => {
        if (item.status !== "done" && item.status !== "removed") {
          item.status = "error";
          item.error = (e as Error).message;
        }
      });
      refresh.current?.request();
    } finally {
      refresh.current?.flushNow();
      running.current = false;
      setBusy(false);
      onBusy?.(false);
      onFinish?.({
        added: next.filter((item) => item.status === "done").length,
        failed: next.filter((item) => item.status === "error").length,
      });
      if (input.current) input.current.value = "";
    }
  }
  const actives = items.filter(
    (i) => i.status === "uploading" || i.status === "processing",
  );
  const mb = (bytes: number) => formatMegabytes(bytes, locale);
  const live = photoIds ? new Set(photoIds) : null;
  const statusOf = (i: Item): Item["status"] =>
    i.status === "done" && live && i.photoId !== undefined && !live.has(i.photoId)
      ? "removed"
      : i.status;
  const summary = summarizeUploads(items.map(statusOf));
  const summarized = shouldSummarize(items.length);
  const finishedInBatch = batch.filter(
    (i) => i.status === "done" || i.status === "error" || i.status === "removed",
  ).length;
  const position = Math.min(batch.length, finishedInBatch + 1);
  const several = batch.length > 1 && actives.length > 0;
  const totalBytes = batch.reduce((sum, i) => sum + i.file.size, 0);
  const doneBytes = batch.reduce(
    (sum, i) =>
      sum + (i.status === "done" ? i.file.size : (i.loaded ?? 0)),
    0,
  );
  const phase = !actives.length
    ? ""
    : actives.every((i) => i.status === "processing")
      ? t("Processing …", "Wird verarbeitet …")
      : t("Uploading", "Wird übertragen");
  dropFiles.current = (files) => {
    if (!busy && !disabled && files.length) void run(files.slice(0, multiple ? undefined : 1).map(makeItem));
  };
  if (variant === "lighttable") {
    const fileInput = (
      <input
        ref={input}
        className="sr-only"
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files) dropFiles.current(Array.from(e.target.files));
        }}
        disabled={busy || disabled}
      />
    );
    const shown = items.filter((i) => statusOf(i) !== "removed");
    const own = new Set(shown.map((i) => i.photoId).filter((id): id is number => id !== undefined));
    const earlier = (photos ?? []).filter((p) => !own.has(p.id)).sort((a, b) => a.position - b.position);
    const progress = sheetProgress(
      shown.map((i) => ({ status: statusOf(i), size: i.file.size, loaded: i.loaded })),
      earlier.length,
    );
    const empty = !shown.length && !earlier.length;
    const line = formatSheetLine(progress, locale);
    // Each print mounts blurred and pale and "develops" once its image has loaded.
    const develop = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.setAttribute("data-developed", "");
    const hide = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.setAttribute("data-broken", "");
    async function removeEarlier(id: number) {
      try {
        onSave(await api<Journey>(`/photos/${id}`, { method: "DELETE" }));
      } catch {
        /* the photograph stays; the editor can remove it later */
      }
    }
    return (
      <div className={`upload-component light-table${empty ? " is-empty" : ""}`}>
        {fileInput}
        {lead}
        {empty ? (
          <div className="light-table-empty">
            <p className="light-table-call">
              <span className="light-table-call-drag">{t("Drag your photographs here", "Zieh deine Fotos hierher")}</span>
              <span className="light-table-call-touch">{t("Your photographs, developed here", "Hier entwickeln sich deine Fotos")}</span>
            </p>
            <button
              type="button"
              className="light-table-pick"
              onClick={() => input.current?.click()}
              disabled={busy || disabled}
            >
              {t("Choose photographs", "Fotos auswählen")}
            </button>
            <small>JPEG, PNG, WebP, HEIC · {t("up to 128 MB each", "bis 128 MB pro Bild")}</small>
          </div>
        ) : (
          <>
            <div className="light-table-bar">
              <p className="light-table-line" aria-hidden="true">{line}</p>
              <p className="sr-only" role="status" aria-live="polite">
                {formatSheetLine({ ...progress, doneBytes: 0, totalBytes: 0 }, locale)}
              </p>
              <button
                type="button"
                className="light-table-more"
                onClick={() => input.current?.click()}
                disabled={busy || disabled}
              >
                <Plus size={16} aria-hidden="true" />
                {t("More photographs", "Weitere Fotos")}
              </button>
              <div
                className={`light-table-meter${progress.active ? " is-running" : ""}`}
                role="progressbar"
                aria-label={t("Total upload progress", "Gesamtfortschritt")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((progress.doneBytes / (progress.totalBytes || 1)) * 100)}
                hidden={!progress.active}
              >
                <span style={{ transform: `scaleX(${progress.totalBytes ? progress.doneBytes / progress.totalBytes : 0})` }} />
              </div>
            </div>
            <ul className="contact-sheet">
              {earlier.map((p) => (
                <li key={`p${p.id}`} className="sheet-frame done">
                  <span className="sheet-print">
                    <img src={p.url} alt="" loading="lazy" onLoad={develop} onError={hide} />
                  </span>
                  {removable && (
                    <button
                      type="button"
                      className="sheet-remove"
                      disabled={busy}
                      aria-label={t("Remove photograph", "Foto entfernen") + (p.title ? ": " + p.title : "")}
                      onClick={() => void removeEarlier(p.id)}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
              {shown.map((item) => {
                const status = statusOf(item);
                const index = items.indexOf(item);
                return (
                  <li key={`i${index}`} className={`sheet-frame ${status}`}>
                    <span className="sheet-print">
                      {item.thumb && (
                        <img
                          key={item.thumb}
                          src={item.thumb}
                          alt=""
                          onLoad={status === "done" ? develop : undefined}
                          onError={hide}
                        />
                      )}
                      {status !== "done" && status !== "error" && (
                        <span
                          className={`sheet-meter${status === "processing" ? " is-processing" : ""}`}
                          aria-hidden="true"
                        >
                          <span style={{ transform: `scaleX(${status === "waiting" ? 0 : item.percent / 100})` }} />
                        </span>
                      )}
                    </span>
                    {status === "error" && (
                      <span className="sheet-error">
                        <span>{item.file.name}</span>
                        <small role="alert">{item.error}</small>
                        <button
                          type="button"
                          disabled={busy || disabled}
                          aria-label={t("Retry", "Erneut versuchen") + ": " + item.file.name}
                          onClick={() => void run(items.map((n) => (n === item ? { ...n, status: "waiting" } : n)))}
                        >
                          <RotateCcw size={15} aria-hidden="true" />
                          {t("Retry", "Erneut versuchen")}
                        </button>
                      </span>
                    )}
                    {removable && (
                      <button
                        type="button"
                        className="sheet-remove"
                        disabled={busy && status === "done"}
                        aria-label={t("Remove photograph", "Foto entfernen") + ": " + item.file.name}
                        onClick={() => void remove(item)}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {pageDrop &&
          createPortal(
            <div className={`light-table-veil${dragging ? " is-visible" : ""}`} aria-hidden="true">
              <p>{t("Let go to add them", "Loslassen, um sie hinzuzufügen")}</p>
            </div>,
            document.body,
          )}
      </div>
    );
  }
  return (
    <div
      className="upload-component"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy)
          void run(
            Array.from(e.dataTransfer.files)
              .slice(0, multiple ? undefined : 1)
              .map(makeItem),
          );
      }}
    >
      <input
        ref={input}
        className="sr-only"
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg"
        onChange={(e) => {
          if (e.target.files)
            void run(
              Array.from(e.target.files)
                .slice(0, multiple ? undefined : 1)
                .map(makeItem),
            );
        }}
        disabled={busy || disabled}
      />
      <button
        type="button"
        className="upload-pick"
        onClick={() => input.current?.click()}
        disabled={busy || disabled}
      >
        <UploadCloud size={24} />
        <span>{t("Add photographs", "Fotos hinzufügen")}</span>
        <small>
          JPEG, PNG, WebP, HEIC · {t("up to 128 MB each", "bis 128 MB pro Bild")}
        </small>
      </button>
      {summarized && (
        <>
          <div className="upload-overall">
            <strong>
              {formatSummary(summary, locale)}
              {actives.length > 0 && (
                <span>
                  {" · "}
                  {mb(doneBytes)} / {mb(totalBytes)} MB
                </span>
              )}
            </strong>
            {actives.length > 0 && (
              <div
                className="upload-meter is-thin"
                role="progressbar"
                aria-label={t("Total upload progress", "Gesamtfortschritt")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((doneBytes / (totalBytes || 1)) * 100)}
              >
                <span
                  style={{ width: `${(doneBytes / (totalBytes || 1)) * 100}%` }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className="button button-outline"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded
              ? t("Hide list", "Liste ausblenden")
              : t("Show list", "Liste anzeigen")}
          </button>
        </>
      )}
      {actives.length > 0 && (
        <div className="upload-current upload-progress-card">
          <p className="sr-only" role="status" aria-live="polite">
            {summarized
              ? formatSummary(summary, locale)
              : t(
                  `Image ${position} of ${batch.length}: ${phase}`,
                  `Bild ${position} von ${batch.length}: ${phase}`,
                )}
          </p>
          {several && !summarized && (
            <div className="upload-overall">
              <strong>
                {t(
                  `Image ${position} of ${batch.length}`,
                  `Bild ${position} von ${batch.length}`,
                )}
                <span>
                  {" · "}
                  {mb(doneBytes)} / {mb(totalBytes)} MB
                </span>
              </strong>
              <div
                className="upload-meter is-thin"
                role="progressbar"
                aria-label={t("Total upload progress", "Gesamtfortschritt")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((doneBytes / (totalBytes || 1)) * 100)}
              >
                <span
                  style={{ width: `${(doneBytes / (totalBytes || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
          {actives.map((active) => (
          <div key={items.indexOf(active)}>
          <span className="upload-file-name">
            {removable && active.thumb && <img className="upload-thumb" src={active.thumb} alt="" />}
            {active.file.name}
            {removable && active.status === "uploading" && (
              <button
                type="button"
                className="upload-remove"
                aria-label={t("Remove photograph", "Foto entfernen") + ": " + active.file.name}
                onClick={() => void remove(active)}
              >
                <Trash2 size={16} />
              </button>
            )}
          </span>
          <p className="upload-phase" aria-hidden="true">
            {phase}
            {active.status === "uploading" && (
              <span>
                {" · "}
                {mb(active.loaded ?? 0)} / {mb(active.file.size)} MB
              </span>
            )}
          </p>
          <div
            className={`upload-meter${active.status === "processing" ? " is-indeterminate" : ""}`}
            role="progressbar"
            aria-label={t("Upload progress", "Uploadfortschritt")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              active.status === "processing" ? undefined : active.percent
            }
            aria-valuetext={
              active.status === "processing"
                ? t("Processing …", "Wird verarbeitet …")
                : `${mb(active.loaded ?? 0)} / ${mb(active.file.size)} MB`
            }
          >
            <span
              style={
                active.status === "processing"
                  ? undefined
                  : { width: `${active.percent}%` }
              }
            />
          </div>
          </div>
          ))}
        </div>
      )}
      <ul className={`upload-results${removable || summarized ? " is-removable" : ""}`}>
        {items
          .map((item, index) => ({ item, index }))
          .filter(
            ({ item }) =>
              item.status === "error" ||
              (statusOf(item) === "done" && (!summarized || expanded)),
          )
          .map(({ item, index }) => (
            <li key={index} className={item.status}>
              {(removable || summarized) && item.thumb ? (
                <img className="upload-thumb" src={item.thumb} alt="" />
              ) : item.status === "done" ? (
                <CheckCircle2 size={16} />
              ) : null}
              <span>
                {item.file.name}
                {item.error && <small role="alert">{item.error}</small>}
                {item.status === "done" && (
                  <small className="upload-done-note">
                    {t("Done", "Fertig")} · {mb(item.file.size)} MB
                  </small>
                )}
              </span>
              {item.status === "error" && (
                <button
                  type="button"
                  disabled={busy || disabled}
                  aria-label={
                    t("Retry", "Erneut versuchen") + ": " + item.file.name
                  }
                  onClick={() =>
                    void run(
                      items.map((n) =>
                        n === item ? { ...n, status: "waiting" } : n,
                      ),
                    )
                  }
                >
                  <RotateCcw size={17} />
                  {t("Retry", "Erneut versuchen")}
                </button>
              )}
              {!removable && summarized && onRemovePhoto && item.photoId !== undefined && (
                <button
                  type="button"
                  className="upload-remove"
                  disabled={busy || disabled}
                  aria-label={t("Delete photograph", "Foto löschen") + ": " + item.file.name}
                  title={t("Delete photograph", "Foto löschen")}
                  onClick={() => onRemovePhoto(item.photoId!)}
                >
                  <Trash2 size={16} />
                </button>
              )}
              {removable && (
                <button
                  type="button"
                  className="upload-remove"
                  disabled={busy && item.status === "done"}
                  aria-label={t("Remove photograph", "Foto entfernen") + ": " + item.file.name}
                  onClick={() => void remove(item)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
