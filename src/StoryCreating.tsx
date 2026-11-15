import { useEffect, useState, type CSSProperties } from "react";
import { t } from "./I18n";
import { prefersReducedMotion, storyCreatingPlan } from "./storyCreatingPlan";
import "./story-creating.css";

/** Full-screen transition between the new-story assistant and the editor. */
export function StoryCreating({ title, edition, photos }: { title: string; edition: string; photos: string[] }) {
  const [reduced] = useState(prefersReducedMotion);
  const plan = storyCreatingPlan(reduced, edition);
  const [index, setIndex] = useState(0);
  const shots = photos.slice(0, 4);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setIndex((i) => Math.min(i + 1, plan.lines.length - 1)), plan.lineMs);
    return () => window.clearInterval(id);
  }, [reduced, plan.lines.length, plan.lineMs]);

  const line = plan.lines[index];
  return (
    <div
      className="story-creating"
      style={{ "--sc-total": `${plan.totalMs}ms`, "--sc-line": `${plan.lineMs}ms`, "--sc-shots": Math.max(shots.length, 1) } as CSSProperties}
    >
      {shots.length > 0 && (
        <div className="story-creating-shots" aria-hidden="true">
          {shots.map((src, i) => (
            <img key={src + i} src={src} alt="" style={{ "--sc-i": i } as CSSProperties} />
          ))}
        </div>
      )}
      <div className="story-creating-veil" aria-hidden="true" />
      <div className="story-creating-center">
        {title && <p className="story-creating-title">{title}</p>}
        <p key={index} className={`story-creating-line${index === plan.lines.length - 1 ? " is-last" : ""}`} role="status" aria-live="polite">
          {t(line.en, line.de)}
        </p>
      </div>
      <span className="story-creating-progress" aria-hidden="true" />
    </div>
  );
}
