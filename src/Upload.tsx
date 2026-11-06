import { useRef, useState } from "react";
import { UploadCloud, RotateCcw, CheckCircle2 } from "lucide-react";
import { ApiError, uploadPhoto } from "./api";
import { t } from "./I18n";
import type { Journey } from "./types";
type Item = {
  file: File;
  status: "waiting" | "uploading" | "processing" | "done" | "error";
  percent: number;
  error?: string;
};
export function Upload({
  journeyId,
  chapterId = null,
  onSave,
  onBusy,
  ensureJourney,
  multiple = true,
  disabled = false,
  composition,
  onConflict,
}: {
  journeyId?: number;
  composition?: { slug: string; version: number };
  onConflict?: () => void;
  multiple?: boolean;
  disabled?: boolean;
  ensureJourney?: () => Promise<Journey>;
  chapterId?: number | null;
  onSave: (j: Journey) => void;
  onBusy?: (v: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false);
  const running = useRef(false),
    input = useRef<HTMLInputElement>(null);
  async function run(next: Item[]) {
    if (running.current || disabled) return;
    running.current = true;
    setBusy(true);
    onBusy?.(true);
    setItems([...next]);
    try {
      const id = journeyId || (await ensureJourney?.())?.id;
      if (!id)
        throw new Error(
          t("Create a journey first.", "Bitte zuerst eine Reise anlegen."),
        );
      let basis = composition;
      for (let i = 0; i < next.length; i++) {
        const item = next[i];
        if (item.status === "done" || item.status === "error") continue;
        item.error = undefined;
        item.status = "uploading";
        item.percent = 0;
        setItems([...next]);
        try {
          const saved = await uploadPhoto<Journey>(
            `/journeys/${id}/photos`,
            item.file,
            chapterId,
            (p) => {
              item.percent = p;
              item.status = p === 100 ? "processing" : "uploading";
              setItems([...next]);
            },
            basis,
          );
          if (basis) basis = { ...basis, version: saved.composition_version ?? 0 };
          onSave(saved);
          item.status = "done";
        } catch (e) {
          if (e instanceof ApiError && e.code === "composition_conflict") {
            onConflict?.();
            throw e;
          }
          item.status = "error";
          item.error = (e as Error).message;
        }
        setItems([...next]);
      }
    } catch (e) {
      next.forEach((item) => {
        if (item.status !== "done") {
          item.status = "error";
          item.error = (e as Error).message;
        }
      });
      setItems([...next]);
    } finally {
      running.current = false;
      setBusy(false);
      onBusy?.(false);
      if (input.current) input.current.value = "";
    }
  }
  const current = items.findIndex(
    (i) => i.status === "uploading" || i.status === "processing",
  );
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
              .map((file) => ({
                file,
                status: "waiting",
                percent: 0,
              })),
          );
      }}
    >
      <input
        ref={input}
        className="sr-only"
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          if (e.target.files)
            void run(
              Array.from(e.target.files)
                .slice(0, multiple ? undefined : 1)
                .map((file) => ({
                  file,
                  status: "waiting",
                  percent: 0,
                })),
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
          JPEG, PNG, WebP · {t("up to 128 MB each", "bis 128 MB pro Bild")}
        </small>
      </button>
      {current >= 0 && (
        <div className="upload-current" role="status" aria-live="polite">
          <strong>
            {t(
              `Image ${current + 1} of ${items.length}`,
              `Bild ${current + 1} von ${items.length}`,
            )}
          </strong>
          <span>{items[current].file.name}</span>
          <p>
            {items[current].status === "processing"
              ? t("Preparing image sizes…", "Bildgrößen werden vorbereitet…")
              : t("Uploading", "Wird hochgeladen")}
          </p>
          <progress
            max={100}
            value={
              items[current].status === "processing"
                ? undefined
                : items[current].percent
            }
            aria-label={t("Upload progress", "Uploadfortschritt")}
          />
        </div>
      )}
      <ul className="upload-results">
        {items
          .filter((i) => i.status === "error" || i.status === "done")
          .map((item, i) => (
            <li key={i} className={item.status}>
              {item.status === "done" ? <CheckCircle2 size={16} /> : null}
              <span>
                {item.file.name}
                {item.error && <small role="alert">{item.error}</small>}
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
            </li>
          ))}
      </ul>
    </div>
  );
}
