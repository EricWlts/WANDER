import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Pause, Play } from "lucide-react";
import { t, useLocale } from "./I18n";
const MotionContext = createContext(false);
export function MotionProvider({ children }: { children: ReactNode }) {
  useLocale();
  const [disabled, setDisabled] = useState(() => {
    try {
      return localStorage.getItem("wander-motion") === "off";
    } catch {
      return false;
    }
  });
  const [reduced, setReduced] = useState(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(q.matches);
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion =
      disabled || reduced ? "off" : "on";
    window.dispatchEvent(new Event("wander-motion"));
  }, [disabled, reduced]);
  return (
    <MotionContext.Provider value={disabled || reduced}>
      {children}
      <button
        className="global-motion"
        aria-pressed={disabled || reduced}
        aria-label={
          disabled || reduced
            ? t("Enable movement", "Bewegung einschalten")
            : t("Pause movement", "Bewegung anhalten")
        }
        title={
          reduced
            ? t(
                "Reduced motion follows your system",
                "Reduzierte Bewegung folgt deiner Systemeinstellung",
              )
            : t("Automatic movement", "Automatische Bewegung")
        }
        disabled={reduced}
        onClick={() => {
          const next = !disabled;
          setDisabled(next);
          try {
            localStorage.setItem("wander-motion", next ? "off" : "on");
          } catch {
            /* Session setting. */
          }
        }}
      >
        {disabled || reduced ? <Play size={16} /> : <Pause size={16} />}
        <span>{t("Movement", "Bewegung")}</span>
      </button>
    </MotionContext.Provider>
  );
}
export const useMotionOff = () => useContext(MotionContext);
export function Parallax({
  children,
  enabled = true,
  intensity = 90,
}: {
  children: ReactNode;
  enabled?: boolean;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null),
    off = useMotionOff();
  useEffect(() => {
    const el = ref.current;
    if (!el || off || !enabled) {
      el?.style.setProperty("--parallax-y", "0px");
      return;
    }
    let frame = 0,
      visible = false;
    const draw = () => {
      frame = 0;
      if (!visible) return;
      const r = el.getBoundingClientRect();
      const viewportHeight =
        el.ownerDocument.defaultView?.innerHeight || innerHeight;
      const y = Math.max(
        -1,
        Math.min(
          1,
          (viewportHeight / 2 - r.top - r.height / 2) / viewportHeight,
        ),
      );
      el.style.setProperty("--parallax-y", `${y * intensity * 0.5}px`);
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      scroll();
    });
    observer.observe(el);
    const ownerWindow = el.ownerDocument.defaultView;
    if (ownerWindow && ownerWindow !== window)
      ownerWindow.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    return () => {
      observer.disconnect();
      if (ownerWindow && ownerWindow !== window)
        ownerWindow.removeEventListener("scroll", scroll);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
    };
  }, [enabled, intensity, off]);
  return (
    <div
      ref={ref}
      className={`parallax-frame ${enabled && !off ? "parallax-active" : ""}`}
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
