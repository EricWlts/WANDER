import { useEffect, useState } from "react";
import { t } from "./I18n";
import { isMotionOff } from "./motionState";
import { markStudioIntroPlayed, studioIntroPlayed } from "./studioIntroState";
import "./studio-intro.css";

/* Entering the studio: the mountain W draws itself on a dark screen, "Studio" appears beneath it,
   then the view travels through the W into the studio. Plays once after each successful sign-in
   (see studioIntroState.ts), not on every visit to the studio, and never with motion switched off. */

const W_PATH =
  "M 995.10,4.90 L 818.63,4.90 L 882.35,39.22 L 887.25,78.43 L 754.90,372.55 L 534.31,0.00 L 348.04,357.84 L 205.88,68.63 L 210.78,29.41 L 259.80,4.90 L 0.00,4.90 L 68.63,49.02 L 289.22,514.71 L 421.57,269.61 L 441.18,279.41 L 490.20,176.47 L 553.92,303.92 L 578.43,269.61 L 720.59,514.71 L 916.67,73.53 L 955.88,24.51 Z";
const W_RIDGE =
  "M 289.22,514.71 L 421.57,269.61 L 441.18,279.41 L 490.20,176.47 L 553.92,303.92 L 578.43,269.61 L 720.59,514.71";

function shouldPlay(): boolean {
  return typeof window !== "undefined" && !isMotionOff() && !studioIntroPlayed();
}

export function StudioIntro() {
  const [show, setShow] = useState(shouldPlay);
  useEffect(() => {
    if (!show) return;
    markStudioIntroPlayed();
    // Safety net: never leave the curtain up if an animation event is missed.
    const timer = window.setTimeout(() => setShow(false), 5600);
    return () => window.clearTimeout(timer);
  }, [show]);
  if (!show) return null;
  return (
    <div
      className="studio-intro"
      aria-hidden="true"
      onClick={() => setShow(false)}
      onAnimationEnd={(event) => {
        if (event.animationName === "studio-intro-curtain") setShow(false);
      }}
    >
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
