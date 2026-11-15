import { useEffect, useRef, useState } from "react";
import { CalendarDays, Sparkles, Waves } from "lucide-react";
import { Modal } from "./components";
import { t } from "./I18n";
import { initialDraftMode, type JourneyForm } from "./journeyForm";
import type { DraftMode } from "./storyDraft";

/** "Nach Tagen" is the default when at least half of the photographs carry a date. */
export function defaultDraftMode(total: number, dated: number): DraftMode {
  return total > 0 && dated * 2 >= total ? "days" : "mood";
}

export function StoryDraftDialog({
  total,
  dated,
  form = "journey",
  onCreate,
  onClose,
  welcome = false,
}: {
  total: number;
  dated: number;
  /** Form of the story; it decides which arrangement is preselected. */
  form?: JourneyForm;
  onCreate: (mode: DraftMode) => void;
  onClose: () => void;
  /** Shown right after the first upload: adds a short note and a "later" exit. */
  welcome?: boolean;
}) {
  const [mode, setMode] = useState<DraftMode>(() => initialDraftMode(form, total, dated));
  const group = useRef<HTMLDivElement>(null);
  useEffect(() => {
    group.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, []);
  const choices: {
    id: DraftMode;
    icon: typeof CalendarDays;
    title: string;
    text: string;
  }[] = [
    {
      id: "days",
      icon: CalendarDays,
      title: t("By days", "Nach Tagen"),
      text: t(
        "Chronological, one chapter per day",
        "Chronologisch, ein Kapitel pro Tag",
      ),
    },
    {
      id: "mood",
      icon: Waves,
      title: t("By mood", "Nach Stimmung"),
      text: t("Free image rhythm", "Freier Bildrhythmus"),
    },
  ];
  return (
    <Modal
      title={t("Design story", "Story gestalten")}
      className="story-draft-modal"
      onClose={onClose}
    >
      <h2>{t("Design your story", "Story gestalten")}</h2>
      <p className="story-draft-lead">
        {t(
          `${total} photographs become an editorial draft. How should it be arranged?`,
          `${total} Fotos werden zu einem redaktionellen Entwurf. Wie soll er aufgebaut sein?`,
        )}
      </p>
      <div
        className="story-draft-choices"
        role="radiogroup"
        aria-label={t("Arrangement", "Aufbau")}
        ref={group}
      >
        {choices.map(({ id, icon: Icon, title, text }) => (
          <label
            key={id}
            className={`story-draft-card ${mode === id ? "selected" : ""}`}
          >
            <input
              type="radio"
              name="story-draft-mode"
              value={id}
              checked={mode === id}
              onChange={() => setMode(id)}
            />
            <Icon size={22} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{text}</span>
            {id === "days" && dated < total && (
              <em>
                {dated === 0
                  ? t(
                      "No capture dates found; photographs will not be split into days.",
                      "Keine Aufnahmedaten gefunden; die Fotos werden nicht in Tage geteilt.",
                    )
                  : t(
                      `${total - dated} without date go to "More moments".`,
                      `${total - dated} ohne Datum kommen zu „Weitere Momente“.`,
                    )}
              </em>
            )}
          </label>
        ))}
      </div>
      <p className="story-draft-info">
        {t(
          "Texts are kept. You can undo it.",
          "Texte bleiben erhalten. Du kannst es rückgängig machen.",
        )}
      </p>
      {welcome && (
        <p className="story-draft-info">
          {t(
            "You can change this any time under “Design story” – or adjust modules one by one by hand.",
            "Du kannst das jederzeit unter „Story gestalten“ ändern – oder Module einzeln von Hand anpassen.",
          )}
        </p>
      )}
      <button
        type="button"
        className="button story-draft-create"
        onClick={() => onCreate(mode)}
      >
        <Sparkles size={16} aria-hidden="true" />
        {t("Create draft", "Entwurf erstellen")}
      </button>
      {welcome && (
        <button type="button" className="text-link story-draft-later" onClick={onClose}>
          {t("Design it myself", "Selbst gestalten")}
        </button>
      )}
    </Modal>
  );
}
