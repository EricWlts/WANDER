import { tr } from "./I18n";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, Check, Eye, Link2, Trash2 } from "lucide-react";
import { api, json } from "./api";
import { Modal, Field } from "./components";
import { ImageControls } from "./ImageControls";
import { t } from "./I18n";
import type { Journey, Photo } from "./types";
export function PhotoForm({
  photo,
  journey,
  onClose,
  onSave,
}: {
  photo: Photo;
  journey: Journey;
  onClose: () => void;
  onSave: (j: Journey) => void;
}) {
  const [data, setData] = useState(photo),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onSave(
        await api<Journey>(
          `/photos/${photo.id}`,
          json("PATCH", {
            title: data.title,
            description: data.description,
            alt: data.alt,
            edits: data.edits || {},
            chapter_id: data.chapter_id,
            featured: data.featured,
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
      title={t("Edit photograph", "Foto bearbeiten")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <h2>{t("The way you saw it.", "So, wie du es gesehen hast.")}</h2>
      <form onSubmit={submit}>
        <ImageControls
          photo={data}
          onChange={(patch) => setData((p) => ({ ...p, ...patch }))}
        />
        <Field label={t("Day / module", "Tag / Modul")}>
          <select
            value={data.chapter_id ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                chapter_id: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">{t("Unassigned", "Nicht zugeordnet")}</option>
            {journey.chapters.map((c) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy
            ? t("Saving…", "Speichern…")
            : t("Save photograph", "Foto speichern")}
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
export function OrderButtons({
  index,
  length,
  disabled,
  move,
}: {
  index: number;
  length: number;
  disabled: boolean;
  move: (d: number) => void;
}) {
  return (
    <div className="order-buttons">
      <button
        className="icon-button"
        aria-label={tr("Move earlier")}
        disabled={disabled || index === 0}
        onClick={() => move(-1)}
      >
        <ArrowUp size={16} />
      </button>
      <button
        className="icon-button"
        aria-label={tr("Move later")}
        disabled={disabled || index === length - 1}
        onClick={() => move(1)}
      >
        <ArrowDown size={16} />
      </button>
    </div>
  );
}
export function Confirm({
  title,
  description,
  onClose,
  action,
}: {
  title: string;
  description: string;
  onClose: () => void;
  action: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <span className="eyebrow">{tr("A PERMANENT CHANGE")}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-actions">
        <button
          className="button button-outline"
          onClick={onClose}
          disabled={busy}
        >
          {tr("Keep it")}
        </button>
        <button
          className="button button-danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await action();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? tr("Deleting…") : tr("Delete permanently")}
          <Trash2 size={16} />
        </button>
      </div>
    </Modal>
  );
}

/** Quiet closing moment after a successful publish: small cover, one line, view and copy the link. */
export function PublishedDialog({
  title,
  slug,
  cover,
  newerChanges,
  onClose,
}: {
  title: string;
  slug: string;
  cover: Photo | null;
  newerChanges: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const id = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(id);
  }, [copied]);
  async function copy() {
    const url = `${window.location.origin}/journeys/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
      } finally {
        field.remove();
      }
    }
    setCopied(true);
  }
  return (
    <Modal key="published" title={t("Published", "Veröffentlicht")} className="publish-done" onClose={onClose}>
      {cover && (
        <div className="publish-done-cover">
          <img src={cover.url} srcSet={cover.srcset} sizes="160px" alt="" draggable={false} />
        </div>
      )}
      <h2>{t("Your story is published.", "Deine Geschichte ist veröffentlicht.")}</h2>
      <p className="publish-done-title">{title}</p>
      {newerChanges && (
        <p className="publish-done-note">
          {t(
            "Newer changes remain in your draft and are not published.",
            "Neuere Änderungen bleiben im Entwurf und sind unveröffentlicht.",
          )}
        </p>
      )}
      <div className="confirm-actions">
        <Link className="button" to={`/journeys/${slug}`} target="_blank" rel="noopener">
          {t("View", "Ansehen")}
          <Eye size={17} />
        </Link>
        <button type="button" className="button button-outline" onClick={() => void copy()}>
          {t("Copy link", "Link kopieren")}
          <Link2 size={17} />
        </button>
      </div>
      <p className="publish-done-copied" role="status">
        {copied ? t("Copied", "Kopiert") : ""}
      </p>
      <button type="button" className="text-link publish-done-close" onClick={onClose}>
        {t("Close", "Schließen")}
      </button>
    </Modal>
  );
}
