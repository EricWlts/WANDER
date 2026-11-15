import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
  type RefObject,
} from "react";
import { Pause, Play } from "lucide-react";
import { t, useLocale } from "./I18n";
import { parallaxShift, coverParallaxIntensity } from "./imageParallax";
import {
  cachedQuery,
  joinScrollFrames,
  prefersReducedMotion,
  reducedMotionQuery,
  requestScrollFrame,
  type ScrollFrameEntry,
} from "./motionState";
const MotionContext = createContext({
  off: false,
  reduced: false,
  toggle: () => {},
});
export function MotionProvider({ children }: { children: ReactNode }) {
  useLocale();
  const [disabled, setDisabled] = useState(() => {
    try {
      return localStorage.getItem("wander-motion") === "off";
    } catch {
      return false;
    }
  });
  const [reduced, setReduced] = useState(() => prefersReducedMotion());
  useEffect(() => {
    const q = reducedMotionQuery();
    if (!q) return;
    const update = () => setReduced(q.matches);
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion =
      disabled || reduced ? "off" : "on";
    window.dispatchEvent(new Event("wander-motion"));
  }, [disabled, reduced]);
  const off = disabled || reduced;
  const toggle = useCallback(() => {
    const next = !disabled;
    setDisabled(next);
    try {
      localStorage.setItem("wander-motion", next ? "off" : "on");
    } catch {
      /* Session setting. */
    }
  }, [disabled]);
  const value = useMemo(() => ({ off, reduced, toggle }), [off, reduced, toggle]);
  return (
    <MotionContext.Provider value={value}>
      {children}
      <MotionToggle className="global-motion" />
    </MotionContext.Provider>
  );
}

export const useMotionOff = () => useContext(MotionContext).off;

export function MotionToggle({ className }: { className: string }) {
  useLocale();
  const { off, reduced, toggle } = useContext(MotionContext);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={off}
      aria-label={off
        ? t("Enable movement", "Bewegung einschalten")
        : t("Pause movement", "Bewegung anhalten")}
      title={reduced
        ? t("Reduced motion follows your system", "Reduzierte Bewegung folgt deiner Systemeinstellung")
        : t("Automatic movement", "Automatische Bewegung")}
      disabled={reduced}
      onClick={toggle}
    >
      {off ? <Play size={16} /> : <Pause size={16} />}
      <span>{t("Movement", "Bewegung")}</span>
    </button>
  );
}

export function Parallax({
  children,
  enabled = true,
  // Default = the story cover (the only caller without an explicit strength): twice the old shift.
  intensity = coverParallaxIntensity,
  image = false,
  visibilityTarget,
}: {
  children: ReactNode;
  enabled?: boolean;
  intensity?: number;
  image?: boolean;
  visibilityTarget?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null),
    off = useMotionOff();
  useEffect(() => {
    const el = ref.current;
    if (!el || off || !enabled) {
      el?.style.setProperty("--parallax-y", "0px");
      return;
    }
    const ownerWindow = el.ownerDocument.defaultView || window;
    const media = reducedMotionQuery(ownerWindow);
    const compactQuery = cachedQuery(
      "(max-width: 760px) and (pointer: coarse)",
      ownerWindow,
    );
    if (!media || !compactQuery) return;
    // Read the rect now, hand back one write: the shared scheduler runs all reads
    // before all writes, so many images never thrash layout.
    const entry: ScrollFrameEntry = {
      read: () => {
        if (media.matches) return;
        const r = el.getBoundingClientRect();
        const viewportHeight =
          el.ownerDocument.defaultView?.innerHeight || innerHeight;
        const y = (viewportHeight / 2 - r.top - r.height / 2) / viewportHeight;
        const value = `${parallaxShift(y, intensity, compactQuery.matches).toFixed(2)}px`;
        return () => el.style.setProperty("--parallax-y", value);
      },
    };
    // Listening only while the element is (nearly) in view: off-screen images cost nothing.
    let leave: (() => void) | undefined;
    const observer = new ownerWindow.IntersectionObserver(([e]) => {
      if (e.isIntersecting) leave ??= joinScrollFrames(ownerWindow, entry, window);
      else {
        leave?.();
        leave = undefined;
      }
    }, { rootMargin: "12% 0px" });
    observer.observe(visibilityTarget?.current ?? el);
    const reduced = () => {
      el.classList.toggle("parallax-active", !media.matches);
      if (media.matches) el.style.setProperty("--parallax-y", "0px");
      else requestScrollFrame(ownerWindow);
    };
    media.addEventListener("change", reduced);
    reduced();
    return () => {
      observer.disconnect();
      leave?.();
      media.removeEventListener("change", reduced);
    };
  }, [enabled, intensity, off, visibilityTarget]);
  return (
    <div
      ref={ref}
      className={`parallax-frame ${image ? "image-parallax" : ""} ${enabled && !off ? "parallax-active" : ""}`}
      style={
        {
          "--parallax-overscan": `${intensity * 0.5 + 8}px`,
        } as import("react").CSSProperties
      }
    >
      <div className="parallax-layer">{children}</div>
    </div>
  );
}
