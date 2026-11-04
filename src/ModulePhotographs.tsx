import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Picture } from "./components";
import { modulePhotos, placementsFor } from "./journalModel";
import { t } from "./I18n";
import type { Chapter, ImagePlacement, Journey, Layout, Photo } from "./types";
export function ModulePhotographs({
  module,
  journey,
  onChange,
  onPhoto,
  onDelete,
  deleteDisabled = false,
}: {
  module: Chapter;
  journey: Journey;
  onChange: (p: Partial<Layout>) => void;
  onPhoto: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  deleteDisabled?: boolean;
}) {
  const frames = placementsFor(module, journey),
    photos = modulePhotos(module, journey),
    single = ["hero", "image"].includes(module.kind);
  const [libraryOpen, setLibraryOpen] = useState(!photos.length);
  function commit(next: ImagePlacement[]) {
    onChange({ placements: next });
  }
  return (
    <section
      className="inspector-images"
      aria-label={t("Image content", "Bildinhalt")}
    >
      <h4 className="inspector-images-title">
        {t("In this module", "In diesem Modul")} · {photos.length}
      </h4>
      {!photos.length && (
        <p className="inspector-note">
          {t(
            "Choose a photograph below or upload an image.",
            "Wähle unten ein Foto oder lade ein Bild hoch.",
          )}
        </p>
      )}
      <ol className="placement-list">
        {photos.map((p, i) => (
          <li key={p.placement_id}>
            <button
              type="button"
              className="placement-image"
              data-placement-id={p.placement_id}
              aria-label={`${t("Edit image placement", "Bildverwendung bearbeiten")} ${i + 1}`}
              onClick={() => onPhoto(p)}
            >
              <Picture photo={p} sizes="100px" />
              <span>{i + 1}</span>
            </button>
            <div className="placement-actions">
              <button
                type="button"
                aria-label={
                  t("Move image earlier", "Bild nach vorne") + ` ${i + 1}`
                }
                disabled={!i}
                onClick={() => {
                  const next = [...frames];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  commit(next);
                }}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                aria-label={
                  t("Move image later", "Bild nach hinten") + ` ${i + 1}`
                }
                disabled={i === frames.length - 1}
                onClick={() => {
                  const next = [...frames];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  commit(next);
                }}
              >
                <ArrowDown size={14} />
              </button>
              {!single && (
                <button
                  type="button"
                  aria-label={
                    t("Reuse this photograph", "Dieses Foto erneut verwenden") +
                    ` ${i + 1}`
                  }
                  onClick={() => {
                    const next = [...frames];
                    next.splice(i + 1, 0, {
                      ...frames[i],
                      id: crypto.randomUUID(),
                    });
                    commit(next);
                  }}
                >
                  <Copy size={14} />
                </button>
              )}
              <button
                type="button"
                aria-label={
                  t(
                    "Remove placement; keep source image",
                    "Verwendung entfernen; Ausgangsfoto behalten",
                  ) + ` ${i + 1}`
                }
                onClick={() =>
                  commit(frames.filter((f) => f.id !== p.placement_id))
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <details
        className="inspector-library"
        open={libraryOpen}
        onToggle={(event) => setLibraryOpen(event.currentTarget.open)}
      >
        <summary>
          {t("Choose from collection", "Aus Fotosammlung wählen")} ·{" "}
          {journey.photos.length}
        </summary>
        <div className="inspector-photo-picker">
          {journey.photos.map((p, i) => {
            const count = frames.filter((f) => f.photo_id === p.id).length;
            return (
              <div className="inspector-source" key={p.id}>
                <button
                  type="button"
                  aria-label={`${t("Add photograph", "Foto hinzufügen")} ${i + 1}`}
                  onClick={() =>
                    commit([
                      ...(single ? [] : frames),
                      { id: crypto.randomUUID(), photo_id: p.id },
                    ])
                  }
                  className={count ? "selected" : ""}
                >
                  <Picture photo={p} sizes="120px" />
                  <span>{count || <Plus size={12} />}</span>
                </button>
                <button
                  className="source-delete danger-action"
                  type="button"
                  disabled={deleteDisabled}
                  aria-label={`${t("Delete photograph", "Foto löschen")} ${i + 1}`}
                  title={t(
                    "Delete from collection",
                    "Aus Fotosammlung löschen",
                  )}
                  onClick={() => onDelete(p)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="inspector-note">
          {t(
            "Images can be reused. Each placement has its own crop.",
            "Bilder dürfen mehrfach vorkommen. Jede Verwendung hat einen eigenen Zuschnitt.",
          )}
        </p>
      </details>
    </section>
  );
}
