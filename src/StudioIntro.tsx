import { useEffect, useRef, useState } from "react";
import { t } from "./I18n";
import { isMotionOff } from "./motionState";
import { markStudioIntroPlayed, studioIntroPlayed } from "./studioIntroState";
import { W_PATH, W_RIDGE, WINDOW } from "./wMark";
import { pageColor, preloadPhoto, startWindowZoom } from "./wWindow";
import "./studio-intro.css";

/* Entering the studio: the mountain W draws itself on a dark screen, "Studio" appears beneath it,
   then the W becomes a window onto the newest cover and the view flies into it; the studio only appears once the photo fills the screen (wWindow.ts, holdPhoto). Plays once after each successful sign-in
   (see studioIntroState.ts), not on every visit to the studio, and never with motion switched off. */

function shouldPlay(): boolean {
  return typeof window !== "undefined" && !isMotionOff() && !studioIntroPlayed();
}

/** Moment (ms) at which the drawn W is complete and becomes a window: the ridge stroke ends at 600 + 3300 ms
 *  (studio-intro.css); a short rest after it, so the finished letter stands still before anything moves. */
const WINDOW_AT_MS = 4050;

/** `photoUrl`: cover of the newest story; undefined while the library is still loading, null if there is none. */
export function StudioIntro({ photoUrl }: { photoUrl?: string | null }) {
  const [show, setShow] = useState(shouldPlay);
  const rootRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef(photoUrl);
  photoRef.current = photoUrl;
  const preloaded = useRef<{ url: string; promise: Promise<string | null> } | null>(null);
  if (show && photoUrl && preloaded.current?.url !== photoUrl) preloaded.current = { url: photoUrl, promise: preloadPhoto(photoUrl) };
  useEffect(() => {
    if (!show) return;
    markStudioIntroPlayed();
    let cancelled = false;
    const launch = async () => {
      // Wait for the cover (the library may still be loading), at most 1.5 s, otherwise the window opens without a photo.
      const t0 = performance.now();
      while (photoRef.current === undefined && performance.now() - t0 < WINDOW.maxPhotoWaitMs) await new Promise((r) => window.setTimeout(r, 50));
      if (photoRef.current) await (preloaded.current?.promise ?? preloadPhoto(photoRef.current));
      // The W opens onto the real studio below: wait until its title image is decoded (at most 1.5 s more).
      const t1 = performance.now();
      const titleImageReady = () => {
        const img = document.querySelector<HTMLImageElement>(".studio-am-lead .am-cover img");
        return !img || (img.complete && img.naturalWidth > 0);
      };
      while (!titleImageReady() && performance.now() - t1 < WINDOW.maxPhotoWaitMs) await new Promise((r) => window.setTimeout(r, 50));
      const root = rootRef.current;
      const mark = root?.querySelector(".studio-intro-mark");
      if (cancelled || !root || !mark) return;
      const bg = getComputedStyle(root).backgroundColor;
      startWindowZoom({
        mark,
        texts: Array.from(root.querySelectorAll<HTMLElement>(".studio-intro-word")),
        bg,
        fg: "#fff",
        // No photo copy inside the letter: through the W you already see the studio's own title image,
        // and the flight only reveals more of it (no grey-to-clear change, no second picture).
        photoUrl: null,
        page: pageColor(bg),
        gentle: true,
        // The drawn letter carries its ridge as an 11-unit stroke; without it the hand-over visibly jumps.
        strokes: [{ d: W_RIDGE, width: 11 }],
      });
      setShow(false);
    };
    const timer = window.setTimeout(() => void launch(), WINDOW_AT_MS);
    // Safety net: never leave the curtain up.
    const safety = window.setTimeout(() => setShow(false), 7500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(safety);
    };
  }, [show]);
  if (!show) return null;
  return (
    <div ref={rootRef} className="studio-intro" aria-hidden="true" onClick={() => setShow(false)}>
      <div className="studio-intro-stage">
        {/* Same construction and timing as the masthead W on the home page (App.tsx, header.css):
            the ridge is drawn in one stroke, then the letter grows upward behind a soft-edged mask. */}
        <svg className="studio-intro-mark" viewBox="-20 -20 1035 555" focusable="false">
          <defs>
            <linearGradient id="studio-intro-rise-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" />
              <stop offset="0.12" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" />
            </linearGradient>
            <mask id="studio-intro-mask" maskUnits="userSpaceOnUse" x="-50" y="-700" width="1100" height="2400">
              <rect className="studio-intro-riser" x="-50" y="0" width="1100" height="1300" fill="url(#studio-intro-rise-edge)" />
            </mask>
          </defs>
          <path d={W_PATH} fill="#fff" mask="url(#studio-intro-mask)" />
          <path
            className="studio-intro-ridge"
            d={W_RIDGE}
            fill="none"
            stroke="#fff"
            strokeWidth="11"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
          />
        </svg>
        <p className="studio-intro-word">
          <span />
          {t("Studio", "Studio")}
          <span />
        </p>
      </div>
    </div>
  );
}
