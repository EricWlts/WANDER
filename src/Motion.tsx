import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Pause, Play } from "lucide-react";
import { t, useLocale } from "./I18n";
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
  const off = disabled || reduced;
  function toggle() {
    const next = !disabled;
    setDisabled(next);
    try {
      localStorage.setItem("wander-motion", next ? "off" : "on");
    } catch {
      /* Session setting. */
    }
  }
  return (
    <MotionContext.Provider value={{ off, reduced, toggle }}>
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
  intensity = 90,
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
    const media = ownerWindow.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      visible = false;
    const draw = () => {
      frame = 0;
      if (!visible || media.matches) return;
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
      if (!frame) frame = ownerWindow.requestAnimationFrame(draw);
    };
    const observer = new ownerWindow.IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      scroll();
    });
    observer.observe(visibilityTarget?.current ?? el);
    const reduced = () => {
      el.classList.toggle("parallax-active", !media.matches);
      if (media.matches) el.style.setProperty("--parallax-y", "0px");
      else scroll();
    };
    media.addEventListener("change", reduced);
    reduced();
    if (ownerWindow && ownerWindow !== window)
      ownerWindow.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    ownerWindow.addEventListener("resize", scroll);
    return () => {
      observer.disconnect();
      if (ownerWindow && ownerWindow !== window)
        ownerWindow.removeEventListener("scroll", scroll);
      media.removeEventListener("change", reduced);
      ownerWindow.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      ownerWindow.removeEventListener("resize", scroll);
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
