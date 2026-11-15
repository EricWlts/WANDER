import { useEffect, useState } from "react";
import { t } from "./I18n";
import { FocusFrame, toTile } from "./HeroCoverEditor";
import { HERO_DEVICES, normalizeFocus, sameFocus, type HeroFocus } from "./heroFocus";
import type { FocusMap, Photo } from "./types";

/** Preview ratios of the archive band (width / height) per screen size. */
const ARCHIVE_RATIOS = { desktop: 3.2, tablet: 2.2, mobile: 0.75 } as const;
const ARCHIVE_LABELS = { desktop: "3.2:1", tablet: "2.2:1", mobile: "3:4" } as const;

/**
 * Crop of the cover in the archive band. Starts from the cover focus until set;
 * `null` saves a reset (the archive follows the cover focus again).
 */
export function ArchiveFocusEditor({
  photo,
  value,
  fallback,
  disabled = false,
  onSave,
}: {
  photo: Photo | null;
  value: FocusMap | null | undefined;
  fallback: FocusMap | null | undefined;
  disabled?: boolean;
  onSave: (focus: FocusMap | null) => void;
}) {
  const saved = normalizeFocus(value ?? fallback);
  const [focus, setFocus] = useState<HeroFocus>(saved);
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    setFocus(normalizeFocus(JSON.parse(savedKey)));
  }, [savedKey, photo?.id]);
  const locked = disabled || !photo;
  const dirty = !sameFocus(focus, saved);
  return (
    <details className="inspector-section cover-fine archive-focus-editor">
      <summary>{t("Crop in the archive", "Ausschnitt im Archiv")}</summary>
      <p className="hero-editor-lead">
        {t(
          "Drag the photograph in each frame. Without a choice here, the archive uses the cover crop.",
          "Ziehe das Foto im jeweiligen Rahmen. Ohne eigene Wahl nutzt das Archiv den Cover-Ausschnitt.",
        )}
      </p>
      <div className="hero-editor-frames">
        {HERO_DEVICES.map((device) => (
          <FocusFrame
            key={device}
            idPrefix="archive"
            device={device}
            photo={photo ? toTile(photo) : null}
            focus={focus[device]}
            disabled={locked}
            ratio={ARCHIVE_RATIOS[device]}
            ratioLabel={ARCHIVE_LABELS[device]}
            onChange={(next) => setFocus((current) => ({ ...current, [device]: next }))}
          />
        ))}
      </div>
      <div className="hero-editor-actions">
        <button type="button" className="button" disabled={locked || !dirty} onClick={() => onSave(focus)}>
          {t("Save", "Speichern")}
        </button>
        {value && (
          <button
            type="button"
            className="button button-outline"
            disabled={locked}
            onClick={() => onSave(null)}
          >
            {t("Reset", "Zurücksetzen")}
          </button>
        )}
      </div>
    </details>
  );
}
