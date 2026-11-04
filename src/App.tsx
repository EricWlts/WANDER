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
          <Compass />
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
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent) =>
      closeNavigationOnEscape(event, () => setMenu(false), toggleRef.current);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menu]);
  return (
    <header className="site-header">
      <div className="brand-lockup">
        <Link to="/" className="wordmark" aria-label={tr("WANDER home")}>
          WANDER<span className="wordmark-star">✳</span>
        </Link>
        <span className="header-caption">{tr("Places that stay.")}</span>
      </div>
      <nav
        aria-label={tr("Main navigation")}
        className={menu ? "nav-open" : ""}
      >
        <NavLink to="/" end>
          {tr("Journal")}
        </NavLink>
        <NavLink to="/archive">{tr("The archive")}</NavLink>
        <NavLink to="/inspiration">{tr("The editions")}</NavLink>
        <NavLink to="/about">{tr("About")}</NavLink>
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
        onClick={() => setMenu(!menu)}
      >
        {menu ? <X /> : <Menu />}
      </button>
    </header>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <span>
          {tr("EVERY JOURNEY DESERVES")}
          <br />
          {tr("TO BE REMEMBERED.")}
        </span>
        <Compass />
        <Link to="/archive" className="text-link">
          {tr("Keep exploring")}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <Link to="/" className="footer-wordmark" aria-label={tr("WANDER home")}>
        WANDER
      </Link>
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
  return (
    <main id="main" className="page-state">
      <Compass />
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
