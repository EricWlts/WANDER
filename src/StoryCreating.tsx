import { useEffect, useRef, useState, type CSSProperties } from "react";
import { t } from "./I18n";
import { creatingFinished, drawProgress, fillEdgeY, fillProgress, lineIndexAt, prefersReducedMotion, storyCreatingPlan, FILL_START } from "./storyCreatingPlan";
import { W_PATH, W_RIDGE } from "./wMark";
import { pageColor, preloadPhoto, startFade, startWindowZoom } from "./wWindow";
import "./story-creating.css";

/** Full-screen transition between the new-story assistant and the editor: the W is drawn from the baseline upward
 *  (nothing is visible at the start), fills from below, then becomes a window onto the cover photo and grows until the
 *  photo fills the screen. `ready` flips once the story exists; `onComplete` fires when time is up and the story is
 *  ready (at the start of the hand-over, the editor takes over underneath). */
export function StoryCreating({ title, edition, ready, photoUrl, onComplete }: { title: string; edition: string; ready: boolean; photoUrl?: string | null; onComplete: () => void }) {
  const [reduced] = useState(prefersReducedMotion);
  const plan = storyCreatingPlan(reduced, edition);
  const [elapsed, setElapsed] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(ready);
  const doneRef = useRef(onComplete);
  const photoRef = useRef(photoUrl);
  readyRef.current = ready;
  doneRef.current = onComplete;
  photoRef.current = photoUrl;

  useEffect(() => {
    const start = performance.now();
    // 19.11.2026: no photograph in the W here – the editor shows the cover differently, so the window opens
    // straight onto the editor below (simpler, as before). photoRef stays for a later change of mind.
    const photo: Promise<string | null> = Promise.resolve(null);
    void preloadPhoto;
    let frame = 0;
    let finished = false;
    const tick = (now: number) => {
      const ms = now - start;
      setElapsed(ms);
      if (!finished && creatingFinished(ms, plan.totalMs, readyRef.current)) {
        finished = true;
        const root = rootRef.current;
        if (plan.zoomMs === 0) {
          if (root) startFade(root);
          doneRef.current();
          return;
        }
        void photo.then((url) => {
          const mark = root?.querySelector(".story-creating-mark");
          if (root && mark) {
            const style = getComputedStyle(root);
            startWindowZoom({
              mark,
              texts: Array.from(root.querySelectorAll<HTMLElement>(".story-creating-title, .story-creating-line, .story-creating-percent")),
              bg: style.backgroundColor,
              fg: style.color,
              strokes: [{ d: W_RIDGE, width: 11 }],
              photoUrl: url,
              page: pageColor(style.backgroundColor),
            });
          }
          doneRef.current();
        });
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [plan.totalMs, plan.zoomMs]);

  const index = lineIndexAt(plan.starts, elapsed);
  const line = plan.lines[index];
  const x = Math.min(elapsed / plan.totalMs, 1);
  const progress = reduced ? 1 : fillProgress(x, ready);
  const draw = reduced ? 0 : drawProgress(x);
  const edgeY = fillEdgeY(progress);
  const percent = Math.round(progress * 100);
  const showPercent = reduced || x >= FILL_START;
  const last = index === plan.lines.length - 1;
  const lineDuration = (plan.starts[index + 1] ?? plan.totalMs) - plan.starts[index];
  return (
    <div
      ref={rootRef}
      className={`story-creating${edition === "after-hours" ? " is-dark" : " is-light"}${reduced ? " is-calm" : ""}`}
      style={{ "--sc-line": `${lineDuration}ms`, "--sc-p": progress } as CSSProperties}
    >
      <div className="story-creating-center">
        {title && <p className="story-creating-title">{title}</p>}
        <svg className="story-creating-mark" viewBox="-20 -20 1035 555" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="story-creating-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" />
              <stop offset="0.1" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" />
            </linearGradient>
            <mask id="story-creating-mask" maskUnits="userSpaceOnUse" x="-60" y="-300" width="1120" height="1700">
              <rect x="-60" y={edgeY} width="1120" height="800" fill="url(#story-creating-edge)" />
            </mask>
          </defs>
          {/* As in the studio entrance: nothing at first, the ridge is drawn in one stroke, and the letter rises from
              the baseline behind a soft edge – both halves together. */}
          <path className="story-creating-w-fill" d={W_PATH} mask="url(#story-creating-mask)" />
          <path
            className="story-creating-stroke"
            d={W_RIDGE}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
            opacity={draw <= 0 ? 0 : 1}
          />
        </svg>
        <p key={index} className={`story-creating-line${last ? " is-last" : ""}`} role="status" aria-live="polite">
          {t(line.en, line.de)}
        </p>
        <p className="story-creating-percent" aria-hidden="true" style={{ visibility: showPercent ? "visible" : "hidden" }}>{percent} %</p>
      </div>
    </div>
  );
}
