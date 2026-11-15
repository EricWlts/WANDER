import { useEffect, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { t } from "./I18n";
import { FocusFrame, toTile } from "./HeroCoverEditor";
import {
  CENTER,
  defaultFocus,
  HERO_DEVICES,
  normalizeFocus,
  nudgeFocus,
  sameFocus,
  sharedFocus,
  sharedPoint,
  tapToPoint,
  type HeroFocus,
} from "./heroFocus";
import type { FocusMap, Photo } from "./types";

/**
 * Cover crop of a journey. One tap on the picture sets the focus point for desktop,
 * tablet and phone together; the three single crops live in "Fine-tuning".
 */
export function CoverFocusEditor({
  photo,
  value,
  disabled = false,
  onSave,
  fineTune,
}: {
  photo: Photo | null;
  value: FocusMap | null | undefined;
  disabled?: boolean;
  /** `null` = reset to the automatic centred crop. */
  onSave: (focus: FocusMap | null) => void;
  /** Extra settings shown inside "Fine-tuning" (heading size, title position). */
  fineTune?: ReactNode;
}) {
  const saved = normalizeFocus(value);
  const [focus, setFocus] = useState<HeroFocus>(saved);
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    setFocus(normalizeFocus(JSON.parse(savedKey)));
  }, [savedKey, photo?.id]);
  const dirty = !sameFocus(focus, saved);
  const locked = disabled || !photo;
  const point = value ? sharedPoint(value) : null;
  const ratio = photo && photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;

  function choose(next: { x: number; y: number }) {
    const shared = sharedFocus(next);
    setFocus(shared);
    onSave(shared);
  }
  function tap(event: MouseEvent<HTMLDivElement>) {
    if (locked || event.detail === 0) return;
    const next = tapToPoint(event.currentTarget.getBoundingClientRect(), {
      x: event.clientX,
      y: event.clientY,
    });
    if (next) choose(next);
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (locked || !/^(Arrow(Left|Right|Up|Down)|Home)$/.test(event.key)) return;
    event.preventDefault();
    choose(nudgeFocus(point ?? CENTER, event.key, event.shiftKey));
  }
  return (
    <div className="cover-focus-editor">
      <p className="hero-editor-lead" id="cover-tap-hint">
        {t("Tap the most important spot in the picture.", "Tippe auf die wichtigste Stelle im Bild.")}
      </p>
      <div
        className={`cover-tap${locked ? " is-locked" : ""}`}
        style={{ "--cover-tap-ratio": String(ratio) } as CSSProperties}
        tabIndex={locked ? -1 : 0}
        role="group"
        aria-roledescription={t("focus point", "Fokuspunkt")}
        aria-label={
          point
            ? `${t("Focus point", "Fokuspunkt")}: ${Math.round(point.x)} % / ${Math.round(point.y)} %`
            : t("Focus point: centred", "Fokuspunkt: Mitte")
        }
        aria-describedby="cover-tap-hint"
        aria-disabled={locked || undefined}
        onClick={tap}
        onKeyDown={key}
      >
        {photo && (
          <img
            src={photo.url}
            srcSet={photo.srcset}
            sizes="(max-width: 760px) 90vw, 360px"
            alt=""
            draggable={false}
          />
        )}
        {point && !locked && (
          <span
            className="cover-tap-dot"
            aria-hidden="true"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        )}
      </div>
      {value && (
        <div className="hero-editor-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={locked}
            onClick={() => {
              setFocus(defaultFocus());
              onSave(null);
            }}
          >
            {t("Reset", "Zurücksetzen")}
          </button>
        </div>
      )}
      <details className="inspector-section cover-fine">
        <summary>{t("Fine-tuning", "Feinschliff")}</summary>
        {fineTune}
        <p className="inspector-note">
          {t(
            "Changed a crop here? It stays until you tap the picture above again – that sets all three crops anew.",
            "Hier geänderte Ausschnitte bleiben erhalten, bis du oben wieder ins Bild tippst – das setzt dann alle drei neu.",
          )}
        </p>
        <p className="hero-editor-lead">
          {t(
            "Drag the photograph in each frame to set the crop for that screen size.",
            "Ziehe das Foto im jeweiligen Rahmen, um den Ausschnitt für diese Bildschirmgröße festzulegen.",
          )}
        </p>
        <div className="hero-editor-frames">
          {HERO_DEVICES.map((device) => (
            <FocusFrame
              key={device}
              idPrefix="cover"
              device={device}
              photo={photo ? toTile(photo) : null}
              focus={focus[device]}
              disabled={locked}
              onChange={(next) => setFocus((current) => ({ ...current, [device]: next }))}
            />
          ))}
        </div>
        <div className="hero-editor-actions">
          <button
            type="button"
            className="button"
            disabled={locked || !dirty}
            onClick={() => onSave(focus)}
          >
            {t("Save", "Speichern")}
          </button>
        </div>
      </details>
    </div>
  );
}
