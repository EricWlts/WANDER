import { tr } from "./I18n";
import {
  cloneElement,
  isValidElement,
  memo,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type CSSProperties,
} from "react";
import { X } from "lucide-react";
import type { Photo, RevealConfig } from "./types";
import { t, getLocale } from "./I18n";
import { imageMotion, useReveal } from "./Reveal";
import { observePicture, type PictureStatus } from "./pictureLoading";
import { Parallax } from "./Motion";
import { canPanImage } from "./imageParallax";
import { mergeIdRefs } from "./ariaIdRefs";
export function Compass({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`compass ${className}`}
      viewBox="0 0 60 60"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M30 0v60M0 30h60M9 9l42 42M9 51L51 9"
        stroke="currentColor"
        strokeWidth=".8"
      />
      <path
        d="M30 11l4 15 15 4-15 4-4 15-4-15-15-4 15-4z"
        fill="currentColor"
      />
    </svg>
  );
}
function PictureImpl({
  photo,
  className = "",
  eager = false,
  priority,
  sizes = "100vw",
  onClick,
  actionLabel,
  animate = false,
  motion = imageMotion,
  parallax = false,
  parallaxVisibility,
}: {
  photo: Photo | null;
  className?: string;
  eager?: boolean;
  /** Explicit fetch priority. Only the home hero and the story cover use "high"; "low" is for off-screen copies. */
  priority?: "high" | "low";
  sizes?: string;
  onClick?: () => void;
  actionLabel?: string;
  animate?: boolean;
  motion?: RevealConfig;
  parallax?: boolean;
  parallaxVisibility?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement & HTMLButtonElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // Cheap identity of what the browser would load; no JSON.stringify per render.
  const source = `${photo?.url ?? ""}\n${photo?.srcset ?? ""}\n${sizes}`;
  const [load, setLoad] = useState<{ source: string; status: PictureStatus }>({
    source,
    status: "loading",
  });
  const status = load.source === source ? load.status : "loading";
  const clickable = !!onClick;
  const pan = parallax && canPanImage(photo);
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    return observePicture(image, (status) => setLoad({ source, status }));
  }, [source, clickable, pan]);
  const reveal = useReveal(
    ref,
    motion,
    animate && (!photo || status === "ready"),
  );
  const photoName = photo?.alt || photo?.description || photo?.title || "";
  const action =
    actionLabel ||
    t("View photograph full size", "Foto in voller Größe ansehen");
  const img = photo ? (
    <img
      key={source}
      ref={imageRef}
      src={photo.url}
      srcSet={photo.srcset}
      sizes={sizes}
      alt={photoName}
      style={
        {
          objectFit: photo.edits?.fit || "cover",
          objectPosition: `${photo.edits?.x ?? 50}% ${photo.edits?.y ?? 50}%`,
          transform:
            "scale(calc(var(--image-crop-zoom, 1) * var(--active-hover, 1)))",
          "--image-crop-zoom":
            photo.edits?.fit === "contain" ? 1 : photo.edits?.zoom || 1,
          transformOrigin: `${photo.edits?.x ?? 50}% ${photo.edits?.y ?? 50}%`,
        } as CSSProperties
      }
      width={photo.width}
      height={photo.height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={priority ?? "auto"}
      decoding="async"
    />
  ) : (
    <div className="photo-placeholder">
      <Compass />
      <span>{tr("A story waiting for its first photograph.")}</span>
    </div>
  );
  const indicator =
    photo && status !== "ready" ? (
      <span
        className="picture-status"
        role={status === "error" ? "status" : undefined}
        aria-hidden={status === "error" ? undefined : true}
      >
        {status === "error"
          ? t("Could not load photograph", "Foto konnte nicht geladen werden")
          : t("Loading photograph", "Foto wird geladen")}
      </span>
    ) : null;
  const ratio = photo ? photo.edits?.ratio || "original" : undefined;
  const frameStyle = ratio
    ? ({
        aspectRatio:
          ratio === "original"
            ? `${photo!.width} / ${photo!.height}`
            : ratio === "free"
              ? photo?.edits?.free_ratio || 1.5
              : ratio.replace(":", " / "),
        // Hover-Zoom ist fest (fixedMotion.ts); ein vollständig gezeigtes Motiv bleibt unangetastet.
        "--image-hover-scale": photo?.edits?.fit === "contain" ? 1 : undefined,
      } as CSSProperties)
    : undefined;
  return onClick ? (
    <button
      ref={ref}
      {...reveal}
      data-image-status={photo ? status : undefined}
      aria-busy={!!photo && status === "loading"}
      className={`picture picture-button ${className}`}
      style={{ ...reveal.style, ...frameStyle }}
      onClick={onClick}
      aria-label={
        photoName
          ? `${photoName}: ${action}`
          : action
      }
    >
      {pan ? (
        <Parallax image intensity={140} visibilityTarget={parallaxVisibility}>{img}</Parallax>
      ) : img}
      {indicator}
    </button>
  ) : (
    <div
      ref={ref}
      {...reveal}
      data-image-status={photo ? status : undefined}
      aria-busy={!!photo && status === "loading"}
      style={{ ...reveal.style, ...frameStyle }}
      className={`picture ${className}`}
    >
      {pan ? (
        <Parallax image intensity={140} visibilityTarget={parallaxVisibility}>{img}</Parallax>
      ) : img}
      {indicator}
    </div>
  );
}
export const Picture = memo(PictureImpl);
let modalLocks = 0;
let previousOverflow = "";
export function Modal({
  children,
  onClose,
  title,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const active = document.activeElement;
    const focused = (
      active instanceof HTMLIFrameElement
        ? active.contentDocument?.activeElement
        : active
    ) as HTMLElement | null;
    const x = window.scrollX,
      y = window.scrollY;
    dialog.showModal();
    if (modalLocks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      dialog.close();
      if (--modalLocks === 0) {
        document.body.style.overflow = previousOverflow;
        window.scrollTo({ left: x, top: y, behavior: "instant" });
      }
      focused?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <button
          className="icon-button modal-close"
          aria-label={tr("Close dialog")}
          onClick={onClose}
        >
          <X />
        </button>
        {children}
      </div>
    </dialog>
  );
}
export function dateLabel(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    year: "numeric",
  },
) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(
    getLocale() === "de" ? "de-DE" : "en-GB",
    options,
  );
}
export function dateRange(start: string, end: string) {
  return start === end
    ? dateLabel(start)
    : `${dateLabel(start, { day: "2-digit", month: "short" })} — ${dateLabel(end)}`;
}
export function dayCount(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement<{
    id?: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
  }>(children)
    ? cloneElement(children, {
        id: children.props.id || id,
        "aria-labelledby": mergeIdRefs(
          children.props["aria-labelledby"],
          `${id}-label`,
        ),
        "aria-describedby":
          mergeIdRefs(
            children.props["aria-describedby"],
            hint ? `${id}-hint` : undefined,
          ) || undefined,
      })
    : children;
  return (
    <label className="field">
      <span id={`${id}-label`}>{label}</span>
      {control}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
