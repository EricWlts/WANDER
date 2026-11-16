import { tr } from "./I18n";
import {
  Component,
  Suspense,
  lazy,
  createContext,
  useContext,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LanguageSwitch, t, useLocale } from "./I18n";
import { api, json } from "./api";
import { Compass } from "./components";
import { Home, Archive, About } from "./Public";
import { Inspiration, ExampleStory, JourneyStory, ShowcaseStory } from "./StoryExperience";
import { closeNavigationOnEscape } from "./mobileNavigation";
import { isStoryPath, initialHeaderScroll, updateHeaderScroll, resetHeaderGesture, headerIsCompact } from "./adaptiveHeader";
import { SignatureWordmark } from "./SignatureBrand";
import { registerPreload, restoreScrollFor, useViewTransitionLinks } from "./viewTransitions";
import { isMotionOff } from "./motionState";
import { STATIC_SITE, withBase } from "./staticSite";

/** Setzt den Seitentitel pro Route. Stories setzen ihren Titel selbst. */
export function usePageTitle(de: string, en: string) {
  useLocale();
  useEffect(() => {
    document.title = t(en, de);
  });
}

type StudioPageName = "Studio" | "NewJourney" | "JourneyEditor";
// Share one cached lazy import across studio routes to avoid another loading
// fallback when moving between exports of the already loaded module.
const StudioPage = lazy(() =>
  import("./Studio").then((module) => ({
    default: ({ page }: { page: StudioPageName }) => {
      const Page = module[page];
      return <Page />;
    },
  })),
);
// Hovering or focusing "My studio" warms the studio chunk, like data for public pages.
registerPreload(/^\/studio(?:\/|$)/, () => import("./Studio"));
interface AppContextType {
  authenticated: boolean;
  ready: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  notify: (message: string) => void;
}
const AppContext = createContext<AppContextType>(null!);
export const useApp = () => useContext(AppContext);
export default function App() {
  const { locale } = useLocale();
  const [authenticated, setAuthenticated] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const location = useLocation();
  // Editor routes /studio/<slug> and /studio/<slug>/setup (not /studio, /studio/new).
  const studioEditorRoute = /^\/studio\/(?!new\/?$)[^/]+(?:\/(?:setup|edit))?\/?$/.test(location.pathname);
  useViewTransitionLinks();
  useEffect(() => {
    api<{ authenticated: boolean }>("/auth")
      .then((data) => setAuthenticated(data.authenticated))
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const editionsScrollKey = location.hash === "#editionen" ? location.key : null;
  useEffect(() => {
    // Back/Forward returns to the remembered place of that history entry.
    if (restoreScrollFor(location.key)) return;
    if (location.hash) {
      const frame = requestAnimationFrame(() => {
        const target = document.getElementById(location.hash.slice(1));
        if (editionsScrollKey) target?.focus({ preventScroll: true });
        target?.scrollIntoView(editionsScrollKey ? { behavior: "instant" } : undefined);
      });
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.hash, editionsScrollKey]);
  const value = useMemo<AppContextType>(() => ({
    authenticated,
    ready,
    login: async (password) => {
      const data = await api<{ authenticated: boolean }>(
        "/auth/login",
        json("POST", { password }),
      );
      setAuthenticated(data.authenticated);
    },
    logout: async () => {
      await api("/auth/logout", json("POST", {}));
      setAuthenticated(false);
    },
    notify: setToast,
  }), [authenticated, ready]);
  // Toast und Verbindungsfehler ändern nur diese Oberfläche: Kopf, Routen und Fuß behalten ihre
  // Element-Identität (Neuaufbau nur bei Sprachwechsel) und rendern nicht bei jedem Toast mit.
  // Router und Kontexte lösen ihre eigenen Updates weiterhin aus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const header = useMemo(() => <Header />, [locale]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const footer = useMemo(() => <Footer />, [locale]);
  const routes = useMemo(
    () => (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/about" element={<About />} />
        <Route path="/journeys/:slug" element={<JourneyStory />} />
        <Route path="/showcase/:edition" element={<ShowcaseStory />} />
        <Route path="/studio" element={<StudioRoute page="Studio" />} />
        <Route path="/inspiration" element={<Inspiration />} />
        <Route path="/inspiration/:templateId" element={<ExampleStory />} />
        <Route path="/studio/new" element={<StudioRoute page="NewJourney" />} />
        <Route
          path="/studio/:slug/edit"
          element={<StudioRoute page="JourneyEditor" />}
        />
        <Route
          path="/studio/:slug"
          element={<StudioRoute page="JourneyEditor" />}
        />
        <Route path="/studio/:slug/setup" element={<SetupRedirect />} />
        <Route
          path="*"
          element={
            <PageState
              title={tr("A little off the beaten path.")}
              text={tr(
                "This page doesn't exist. There's still a whole journey to explore.",
              )}
            />
          }
        />
      </Routes>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );
  return (
    <AppContext.Provider value={value}>
      <a className="skip-link" href="#main">
        {tr("Skip to content")}
      </a>
      {header}
      {error && (
        <div className="connection-error" role="alert">
          {error}{" "}
          <button onClick={() => window.location.reload()}>
            {tr("Try again")}
          </button>
        </div>
      )}
      {routes}
      {!studioEditorRoute && footer}
      {toast && (
        <div className="toast" role="status">
          {location.pathname.startsWith("/studio") ? <Compass /> : <SignatureWordmark />}
          {toast}
          <button
            aria-label={tr("Dismiss notification")}
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
// Only studio failures replace the route content; header, footer and public routes
// stay outside this boundary. A full reload retries a rejected lazy import.
class StudioErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <PageState
          title={tr(
            "The studio could not be opened.",
            "Das Studio konnte nicht geöffnet werden.",
          )}
          text={tr(
            "Reload to try again. Local recovery drafts remain in this browser; changes not yet saved may be lost.",
            "Lade die Seite neu, um es erneut zu versuchen. Lokale Wiederherstellungsentwürfe bleiben in diesem Browser; noch nicht gesicherte Änderungen können verloren gehen.",
          )}
        >
          <button className="button" onClick={() => window.location.reload()}>
            {tr("Reload the studio", "Studio neu laden")}
          </button>
        </PageState>
      );
    }
    return this.props.children;
  }
}
/** Der alte Einrichtungs-Editor ist entfernt; alte Links landen im Editor. */
function SetupRedirect() {
  const { slug = "" } = useParams();
  return <Navigate to={`/studio/${encodeURIComponent(slug)}/edit`} replace />;
}
function StudioRoute({ page }: { page: StudioPageName }) {
  const { pathname } = useLocation();
  if (STATIC_SITE)
    return (
      <PageState
        title={t("The studio runs on the author's computer.", "Das Studio läuft auf dem Rechner des Autors.")}
        text={t(
          "This is the published version of WANDER: every story here can be read, but not edited.",
          "Das hier ist die veröffentlichte Version von WANDER: Alle Geschichten lassen sich lesen, aber nicht bearbeiten.",
        )}
      />
    );
  // Moving to another studio URL clears a previous route failure.
  return (
    <div className="studio-route">
      <StudioErrorBoundary key={pathname}>
        <Suspense fallback={<PageState title={tr("Opening the studio…")} />}>
          <StudioPage page={page} />
        </Suspense>
      </StudioErrorBoundary>
    </div>
  );
}
// The mountain-W build-up plays once per page load, and never while the header
// is (or becomes) compact, so the W can never be missing from the wordmark.
let brandIntroPlayed = false;
function Header() {
  const [intro, setIntro] = useState(() => !brandIntroPlayed);
  const [introRun, setIntroRun] = useState(0);
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const scrollState = useRef(initialHeaderScroll);
  // Story routes begin compact, so the first paint never shows the large masthead.
  const startPath = useLocation().pathname;
  const [compact, setCompact] = useState(() => isStoryPath(startPath));
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuCompact, setMenuCompact] = useState<boolean | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const cancelHoverClose = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };
  const closeHover = () => {
    cancelHoverClose();
    hoverTimer.current = setTimeout(() => setHovered(false), 160);
  };
  const closeMenu = () => { setMenu(false); setMenuCompact(null); };
  // Portalled story actions (share) bypass React's nav onClick; close the menu natively.
  useEffect(() => {
    const nav = navigationRef.current;
    if (!nav) return;
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest(".nav-action")) closeMenu();
    };
    nav.addEventListener("click", onClick);
    return () => nav.removeEventListener("click", onClick);
  });
  const location = useLocation();
  const onEditionsPage = /^\/inspiration(?:\/|$)/.test(location.pathname);
  // The editions overview opens on two halves; at the top the masthead sits on their seam (header.css).
  // Brand click: always home, always at the top, and the W intro plays again.
  const onBrandClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // A view-transition handler may already have navigated and scrolled.
    if (!event.defaultPrevented) {
      event.preventDefault();
      if (location.pathname !== "/" || location.search || location.hash) navigate("/");
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    scrollState.current = resetHeaderGesture(scrollState.current, 0, performance.now());
    setCompact(false);
    if (isMotionOff()) return;
    setIntro(true);
    setIntroRun((n) => n + 1);
  };
  const publicHeader = !location.pathname.startsWith("/studio");
  // True whenever the page is not at its very top. Only styling depends on it: at the top the masthead
  // lies transparently on the cover image, further down it is dark frosted glass (hero-overlay.css).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 12);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [location.pathname]);
  const visualCompact = headerIsCompact(compact, publicHeader, hovered, focused, menu ? menuCompact : null);
  useEffect(() => {
    if (!intro) return;
    const end = () => { brandIntroPlayed = true; setIntro(false); };
    if (visualCompact) { end(); return; }
    const timer = window.setTimeout(end, 3450);
    return () => window.clearTimeout(timer);
  }, [intro, introRun, visualCompact]);
  // Layout effect: the compact state is set before the browser paints the new route.
  useLayoutEffect(() => {
    const story = isStoryPath(location.pathname);
    scrollState.current = { ...resetHeaderGesture(initialHeaderScroll, window.scrollY, performance.now()), compact: story };
    setCompact(story);
    setHovered(false);
    setFocused(false);
    closeMenu();
    cancelHoverClose();
  }, [location.pathname]);
  useEffect(() => () => cancelHoverClose(), []);
  useEffect(() => {
    scrollState.current = resetHeaderGesture(scrollState.current, window.scrollY, performance.now());
  }, [menu, hovered, focused]);
  useEffect(() => {
    if (!publicHeader) return;
    let frame = 0;
    // The full masthead returns near the very top (or via hover/focus). Scrolling up no longer
    // unfolds it (08.11.), so no wheel or touch listeners are needed.
    const resetLayout = () => {
      scrollState.current = resetHeaderGesture(scrollState.current, window.scrollY, performance.now());
    };
    const update = () => {
      frame = 0;
      scrollState.current = updateHeaderScroll(scrollState.current, window.scrollY, {
        now: performance.now(),
        // 08.11.: Hochscrollen klappt den Header nicht mehr aus – nur Hover, Klick/Fokus oder ganz oben.
        upwardIntent: false,
        protectedInteraction: focused || hovered, menuOpen: menu,
        storyRoute: isStoryPath(location.pathname),
      });
      // updateHeaderScroll already expands at y <= thresholds.top; the slot
      // shares the header background, so no light gap opens in between.
      setCompact(scrollState.current.compact);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    // Observe content geometry, not the animated fixed header itself.
    const observer = new ResizeObserver(resetLayout);
    const content = document.getElementById("main");
    if (content) observer.observe(content);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resetLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resetLayout);
      cancelAnimationFrame(frame);
    };
  }, [menu, focused, hovered, publicHeader, location.pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent) =>
      closeNavigationOnEscape(event, closeMenu, toggleRef.current);
    const onPointerDown = (event: PointerEvent) => {
      if (
        // Language and other header controls stay usable without dismissing
        // the menu lock before their focus event.
        navigationRef.current?.parentElement?.contains(event.target as Node)
      ) return;
      if (navigationRef.current?.contains(document.activeElement))
        (document.activeElement as HTMLElement)?.blur();
      closeMenu();
    };
    // Only an explicit open moves focus; scroll expansion never changes it.
    navigationRef.current
      ?.querySelector<HTMLAnchorElement>("a")
      ?.focus({ preventScroll: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menu, publicHeader]);
  return (
    <>
      <div
        className={`${publicHeader ? "public-header-slot" : "studio-header-slot"}${isStoryPath(location.pathname) ? " is-story" : ""}`}
        aria-hidden="true"
      />
      <header
        className={`site-header ${publicHeader ? "public-header" : "studio-header"}${visualCompact ? " is-compact" : ""}${scrolled ? " is-scrolled" : ""}${isStoryPath(location.pathname) ? " is-story" : ""}${intro ? " brand-intro" : ""}${menu ? " has-open-menu" : ""}`}
        onPointerEnter={cancelHoverClose}
        onPointerLeave={closeHover}
        onPointerCancel={() => { cancelHoverClose(); setHovered(false); }}
        onFocusCapture={(event) => {
          // Only the brand consciously opens navigation. Retain it while tabbing
          // within the header; language and burger alone never trigger expansion.
          if (!menu && ((brandRef.current === event.target && event.target.matches(":focus-visible")) || navigationRef.current?.contains(event.target as Node))) setFocused(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocused(false);
            closeMenu();
          }
        }}
      >
        <Link
          to="/"
          ref={brandRef}
          className="editorial-brand"
          onClick={onBrandClick}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
              cancelHoverClose();
              setHovered(true);
            }
          }}
          aria-label={tr("WANDER home")}
        >
          <span className="brand-tone is-linen">
            <OriginalBrand key={introRun} part="monogram" className="header-monogram" />
            <OriginalBrand part="initial" className="header-initial" />
            <OriginalBrand part="remainder" className="header-remainder" />
          </span>
        </Link>
        {!publicHeader && <span className="studio-header-label" aria-hidden="true">Studio</span>}
        <nav
          ref={navigationRef}
          id="main-navigation"
          aria-label={tr("Main navigation")}
          className={menu ? "nav-open" : ""}
          inert={visualCompact && !menu}
          onClick={(event) => {
            if (menu && (event.target as Element).closest("a, .nav-action")) {
              closeMenu();
              toggleRef.current?.focus({ preventScroll: true });
            }
          }}
        >
          <Link to="/" onClick={onBrandClick} aria-current={location.pathname === "/" ? "page" : undefined}>
            <span className="nav-label">{tr("Home", "Startseite")}</span>
          </Link>
          <NavLink to="/archive"><span className="nav-label">{tr("The archive")}</span></NavLink>
          <Link
            to="/inspiration"
            className={onEditionsPage ? "active" : undefined}
            aria-current={onEditionsPage ? "page" : undefined}
          >
            <span className="nav-label">{tr("The editions")}</span>
          </Link>
          <NavLink to="/about"><span className="nav-label">{tr("About")}</span></NavLink>
          {/* Journey pages offer edit/share here on mobile (hidden on desktop via CSS). */}
          <div className="nav-story-actions" id="nav-actions" />
          <Link to="/studio" className="studio-link">
            {tr("My studio")}
            <ArrowUpRight size={14} />
          </Link>
        </nav>
        {/* Running head: pages may name themselves here for the slim bar. */}
        <div className="header-running" id="header-running" aria-hidden="true" />
        {/* Pages place their own quiet actions here (e.g. share/edit on a journey). */}
        <div className="header-actions" id="header-actions" />
        <LanguageSwitch />
        <button
          ref={toggleRef}
          className="menu-toggle icon-button"
          aria-label={menu ? tr("Close navigation") : tr("Open navigation")}
          aria-expanded={menu}
          aria-controls="main-navigation"
          onClick={() => {
            if (menu) closeMenu();
            else { setMenuCompact(visualCompact); setMenu(true); }
          }}
        >
          {menu ? <X strokeWidth={1.25} /> : <Menu strokeWidth={1.25} />}
        </button>
      </header>
    </>
  );
}
// Crop the original approved artboard; the source paths and contours stay intact.
// The mountain W is drawn inline (same approved path and placement as in the
// logo artboard) so it can trace, fill and catch light when the site opens.
const MONOGRAM_PATH =
  "M 995.10,4.90 L 818.63,4.90 L 882.35,39.22 L 887.25,78.43 L 754.90,372.55 L 534.31,0.00 L 348.04,357.84 L 205.88,68.63 L 210.78,29.41 L 259.80,4.90 L 0.00,4.90 L 68.63,49.02 L 289.22,514.71 L 421.57,269.61 L 441.18,279.41 L 490.20,176.47 L 553.92,303.92 L 578.43,269.61 L 720.59,514.71 L 916.67,73.53 L 955.88,24.51 Z";
const MONOGRAM_RIDGE =
  "M 289.22,514.71 L 421.57,269.61 L 441.18,279.41 L 490.20,176.47 L 553.92,303.92 L 578.43,269.61 L 720.59,514.71";
function OriginalBrand({
  part,
  className,
  tone,
}: {
  part: "initial" | "remainder" | "monogram";
  className?: string;
  /** "ink": coloured by CSS (currentColor) instead of white; ids get their own suffix. */
  tone?: "ink";
}) {
  const id = tone ? `-${tone}` : "";
  const paint = tone ? "currentColor" : "#fff";
  if (part === "monogram") {
    return (
      <svg className={className} viewBox="65 74 279 145" aria-hidden="true" focusable="false">
        <defs>
          {/* Soft-edged rising mask: the letter grows from its base upward. */}
          <linearGradient id={`wander-mono-rise-edge${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" />
            <stop offset="0.12" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id={`wander-mono-mask${id}`} maskUnits="userSpaceOnUse" x="-50" y="-700" width="1100" height="2400">
            <rect className="mono-riser" x="-50" y="0" width="1100" height="1300" fill={`url(#wander-mono-rise-edge${id})`} />
          </mask>
        </defs>
        <g transform="translate(65 74) scale(0.28)">
          <path className="mono-fill" d={MONOGRAM_PATH} fill={paint} mask={`url(#wander-mono-mask${id})`} />
          {/* The mountain ridge inside the W, drawn before the letter grows. */}
          <path className="mono-ridge" d={MONOGRAM_RIDGE} fill="none" stroke={paint}
            strokeWidth="11" strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
        </g>
      </svg>
    );
  }
  return (
    <svg
      className={className}
      viewBox={part === "initial" ? "432 195 144 83" : "576 195 556 83"}
      aria-hidden="true"
      focusable="false"
    >
      {tone ? (
        <>
          {/* The white wordmark as a luminance mask, filled with the exact palette colour. */}
          <mask id={`wander-word-mask-${part}${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="345">
            <image href={withBase("/assets/brand/logos/wander-logo-horizontal-white.svg")} width="1280" height="345" />
          </mask>
          <rect width="1280" height="345" fill={paint} mask={`url(#wander-word-mask-${part}${id})`} />
        </>
      ) : (
        <image
          href={withBase("/assets/brand/logos/wander-logo-horizontal-white.svg")}
          width="1280"
          height="345"
        />
      )}
    </svg>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <Link to="/" className="footer-wordmark" aria-label={tr("WANDER home")}>
        <SignatureWordmark />
      </Link>
      <div className="footer-top">
        <span>{tr("All photographs: Eric Wilts & Dustin Brandt")}</span>
        <Link to="/archive" className="text-link">
          {tr("To the archive")}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()}
          {" "}
          {tr("WANDER. A photo journal for journeys, moments and collections.")}
        </span>
        <span>{tr("Made for the moments that stay.")}</span>
        <Link to="/about#credits">{tr("Photography & credits ↗")}</Link>
      </div>
    </footer>
  );
}
export function PageState({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <main id="main" className="page-state">
      {pathname.startsWith("/studio") ? <Compass /> : <SignatureWordmark tone="dark" className="brand-signature page-state-mark" />}
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      {children || (
        <Link className="text-link" to="/">
          {tr("Back to the journal")}
          <ArrowUpRight size={18} />
        </Link>
      )}
    </main>
  );
}
