import { tr } from "./I18n";
import {
  Component,
  Suspense,
  lazy,
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LanguageSwitch, useLocale } from "./I18n";
import { api, json } from "./api";
import { Compass } from "./components";
import { Home, Archive, About } from "./Public";
import { Inspiration, ExampleStory, JourneyStory } from "./StoryExperience";
import { closeNavigationOnEscape } from "./mobileNavigation";
import { initialHeaderScroll, updateHeaderScroll } from "./adaptiveHeader";
import { BrandMonogram, SignatureWordmark } from "./SignatureBrand";

type StudioPageName =
  "Studio" | "NewJourney" | "JourneyEditor" | "GuidedEditor";
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
  useLocale();
  const [authenticated, setAuthenticated] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const location = useLocation();
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
  useEffect(() => {
    if (location.hash)
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.hash]);
  const value: AppContextType = {
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
  };
  return (
    <AppContext.Provider value={value}>
      <a className="skip-link" href="#main">
        {tr("Skip to content")}
      </a>
      <Header />
      {error && (
        <div className="connection-error" role="alert">
          {error}{" "}
          <button onClick={() => window.location.reload()}>
            {tr("Try again")}
          </button>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/about" element={<About />} />
        <Route path="/journeys/:slug" element={<JourneyStory />} />
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
        <Route
          path="/studio/:slug/setup"
          element={<StudioRoute page="GuidedEditor" />}
        />
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
      <Footer />
      {toast && (
        <div className="toast" role="status">
          {location.pathname.startsWith("/studio") ? <Compass /> : <BrandMonogram light />}
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
function StudioRoute({ page }: { page: StudioPageName }) {
  const { pathname } = useLocation();
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
function Header() {
  const [menu, setMenu] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const scrollState = useRef(initialHeaderScroll);
  const [compact, setCompact] = useState(false);
  const [focused, setFocused] = useState(false);
  const location = useLocation();
  const publicHeader = !location.pathname.startsWith("/studio");
  const visualCompact = !publicHeader || compact;
  useEffect(() => {
    scrollState.current = { ...initialHeaderScroll, lastY: window.scrollY };
    setCompact(false);
  }, [location.pathname]);
  useEffect(() => {
    // Both edges of a menu interaction start a fresh scroll gesture.
    scrollState.current = { ...scrollState.current, lastY: window.scrollY, travel: 0 };
  }, [menu]);
  useEffect(() => {
    if (!publicHeader) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      scrollState.current = updateHeaderScroll(
        scrollState.current,
        window.scrollY,
        focused,
        publicHeader,
        menu,
      );
      setCompact(scrollState.current.compact);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [menu, focused, publicHeader]);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent) =>
      closeNavigationOnEscape(event, () => setMenu(false), toggleRef.current);
    const onPointerDown = (event: PointerEvent) => {
      if (
        // Language and other header controls stay usable without dismissing
        // the menu lock before their focus event.
        navigationRef.current?.parentElement?.contains(event.target as Node)
      ) return;
      if (navigationRef.current?.contains(document.activeElement))
        (document.activeElement as HTMLElement)?.blur();
      setMenu(false);
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
        className={publicHeader ? "public-header-slot" : "studio-header-slot"}
        aria-hidden="true"
      />
      <header
        className={`site-header ${publicHeader ? "public-header" : "studio-header"}${visualCompact ? " is-compact" : ""}${menu ? " has-open-menu" : ""}`}
        onFocusCapture={(event) => {
          // The toggle receives focus before its click; it must never unfold the
          // masthead. Focus inside the open panel also keeps the existing state.
          setFocused(!menu && !toggleRef.current?.contains(event.target as Node));
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocused(false);
            setMenu(false);
          }
        }}
      >
        <Link
          to="/"
          className="editorial-brand"
          aria-label={tr("WANDER home")}
        >
          {publicHeader && (
            <OriginalBrand part="monogram" className="header-monogram" />
          )}
          <OriginalBrand part="wordmark" className="header-wordmark" />
        </Link>
        <nav
          ref={navigationRef}
          id="main-navigation"
          aria-label={tr("Main navigation")}
          className={menu ? "nav-open" : ""}
          inert={visualCompact && !menu}
          onClick={(event) => {
            if (menu && (event.target as Element).closest("a")) {
              setMenu(false);
              toggleRef.current?.focus({ preventScroll: true });
            }
          }}
        >
          <NavLink to="/" end>
            <span className="nav-label">{tr("Journal")}</span>
          </NavLink>
          <NavLink to="/archive"><span className="nav-label">{tr("The archive")}</span></NavLink>
          <NavLink to="/inspiration"><span className="nav-label">{tr("The editions")}</span></NavLink>
          <NavLink to="/about"><span className="nav-label">{tr("About")}</span></NavLink>
          <Link to="/studio" className="studio-link">
            {tr("My studio")}
            <ArrowUpRight size={14} />
          </Link>
        </nav>
        <LanguageSwitch />
        <button
          ref={toggleRef}
          className="menu-toggle icon-button"
          aria-label={menu ? tr("Close navigation") : tr("Open navigation")}
          aria-expanded={menu}
          aria-controls="main-navigation"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X strokeWidth={1.25} /> : <Menu strokeWidth={1.25} />}
        </button>
      </header>
    </>
  );
}
// Crop the original approved artboard; the source paths and contours stay intact.
function OriginalBrand({
  part,
  className,
}: {
  part: "wordmark" | "monogram";
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={part === "wordmark" ? "432 195 696 83" : "65 74 279 145"}
      aria-hidden="true"
      focusable="false"
    >
      <image
        href="/assets/brand/logos/wander-logo-horizontal-white.svg"
        width="1280"
        height="345"
      />
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
        <span>
          {tr("EVERY JOURNEY DESERVES")}
          <br />
          {tr("TO BE REMEMBERED.")}
        </span>
        <Link to="/archive" className="text-link">
          {tr("Keep exploring")}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()}
          {tr("WANDER. A personal travel journal.")}
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
      {pathname.startsWith("/studio") ? <Compass /> : <BrandMonogram />}
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
