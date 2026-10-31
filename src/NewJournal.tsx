import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { api, json } from "./api";
import { Upload } from "./Upload";
import { t, useLocale } from "./I18n";
import type { Journey } from "./types";
export function NewJournal() {
  useLocale();
  const [journey, setJourney] = useState<Journey | null>(null),
    [edition, setEdition] = useState<Journey["story_template"]>(
      new URLSearchParams(location.search).get("template") === "after-hours"
        ? "after-hours"
        : "quiet-atlas",
    ),
    [busy, setBusy] = useState(false);
  const creation = useRef<Promise<Journey> | null>(null);
  async function ensureJourney() {
    if (journey) return journey;
    if (!creation.current) {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      creation.current = api<Journey>(
        "/journeys",
        json("POST", {
          title: t("Untitled journey", "Unbenannte Reise"),
          start_date: date,
          end_date: date,
          story_template: edition,
          preset: edition === "after-hours" ? "cinematic" : "quiet",
        }),
      );
    }
    try {
      const j = await creation.current;
      setJourney(j);
      return j;
    } catch (e) {
      creation.current = null;
      throw e;
    }
  }
  return (
    <main id="main" className="new-journal page-width">
      <Link className="text-link" to="/studio">
        <ArrowLeft size={16} />
        {t("Studio", "Studio")}
      </Link>
      <div className="new-journal-heading">
        <span className="eyebrow">WANDER STUDIO</span>
        <h1>{t("Begin with a photograph.", "Am Anfang steht ein Foto.")}</h1>
        <p>
          {t(
            "Bring your memories. Give them a rhythm of your own.",
            "Bring deine Erinnerungen mit. Gib ihnen deinen eigenen Rhythmus.",
          )}
        </p>
      </div>
      <div className="new-journal-body">
        <div>
          <div className="new-edition-picker">
            {(["quiet-atlas", "after-hours"] as const).map((id) => (
              <button
                key={id}
                disabled={!!journey || busy}
                className={`new-edition ${id} ${edition === id ? "active" : ""}`}
                aria-pressed={edition === id}
                onClick={() => setEdition(id)}
              >
                <div>
                  <img src="/images/forest-640.webp" alt="" />
                  <span>{t("A little closer.", "Ein Stück näher.")}</span>
                </div>
                <strong>
                  {id === "quiet-atlas" ? "Quiet Atlas" : "After Hours"}
                  {edition === id && <Check size={16} />}
                </strong>
                <p>
                  {id === "quiet-atlas"
                    ? t(
                        "Pale grey. Intimate, open compositions.",
                        "Helles Grau. Bildnahe, offene Kompositionen.",
                      )
                    : t(
                        "Deep tones. Generous, cinematic frames.",
                        "Tiefe Farben. Großzügige, filmische Bilder.",
                      )}
                </p>
              </button>
            ))}
          </div>
          <p className="inspector-note">
            {t(
              "Both worlds can be combined later, within every day.",
              "Beide Welten lassen sich später in jedem Tag kombinieren.",
            )}
          </p>
        </div>
        <div>
          <Upload
            journeyId={journey?.id}
            ensureJourney={ensureJourney}
            onSave={setJourney}
            onBusy={setBusy}
          />
          {journey && journey.photos.length > 0 && !busy && (
            <Link className="button" to={`/studio/${journey.slug}`}>
              {t("Compose your journey", "Deine Reise gestalten")}
              <ArrowRight size={18} />
            </Link>
          )}
          <p className="inspector-note">
            {t(
              "Uploads are saved in your private collection. Publish when you are ready.",
              "Uploads werden in deiner privaten Sammlung gespeichert. Veröffentliche, wenn du bereit bist.",
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
