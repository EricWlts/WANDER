import { tr } from "./I18n";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  EyeOff,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api, json } from "./api";
import { PageState, useApp } from "./App";
import { shouldShowEmptyLibrary } from "./studioLibraryModel";
import { Compass, Field, Picture } from "./components";
import type { Journey } from "./types";
import { ModularEditor } from "./ModularEditor";
import { NewJournal } from "./NewJournal";
import { Confirm } from "./EditorDialogs";
import { HeroCoverEditor } from "./HeroCoverEditor";
import { EditionEditor } from "./EditionEditor";
import { t } from "./I18n";
import { archiveFocusVars } from "./editionOverrides";
import { StudioIntro } from "./StudioIntro";
import { armStudioIntro, markStudioIntroPlayed } from "./studioIntroState";
import { issueKicker, issueNumbers, seasonOf, travelDate } from "./issueLabel";
import "./builder.css";
import "./studio-polish.css";
import "./editor-simplify.css";
import "./studio-library.css";

function Guard({ children }: { children: ReactNode }) {
  const { ready, authenticated } = useApp();
  return !ready ? (
    <PageState title={tr("Opening the studio…")} />
  ) : !authenticated ? (
    <Login />
  ) : (
    children
  );
}
function Login() {
  const { login } = useApp();
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Arm before the session flips: the library mounts as soon as login() resolves.
      armStudioIntro();
      await login(password);
    } catch (e) {
      markStudioIntroPlayed();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="login-page page-width">
      <div className="login-copy">
        <span className="eyebrow">{tr("THE WANDER STUDIO")}</span>
        <h1>
          {tr("Make room")}
          <br />
          {tr("for")}
          {" "}
          <em>{tr("your stories.")}</em>
        </h1>
        <p>
          {tr("A quiet workspace for the stories you tell")}
          <br />
          {tr("and the moments you want to keep.")}
        </p>
        <Compass />
      </div>
      <form onSubmit={submit} className="login-form">
        <LockKeyhole size={23} strokeWidth={1} />
        <h2>{tr("Welcome back.")}</h2>
        <p>{tr("Sign in to curate your journal.")}</p>
        <Field label={tr("Studio password")}>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={256}
            autoFocus
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? tr("Opening…") : tr("Enter the studio")}
          <ArrowUpRight size={18} />
        </button>
        <small>
          {t("Forgot your password? You can reset it on your Mac.", "Passwort vergessen? Du kannst es auf deinem Mac neu setzen.")}
        </small>
      </form>
    </main>
  );
}
const STUDIO_SEASONS: Record<string, [string, string]> = {
  winter: ["Winter", "Winter"],
  spring: ["Spring", "Frühling"],
  summer: ["Summer", "Sommer"],
  autumn: ["Autumn", "Herbst"],
};
function studioSeasonYear(date: string | null | undefined, de: boolean): string {
  const k = seasonOf(date);
  const y = /^(\d{4})/.exec(date ?? "")?.[1] ?? "";
  return [k ? STUDIO_SEASONS[k][de ? 1 : 0] : "", y].filter(Boolean).join(" ");
}
export function Studio() {
  return (
    <Guard>
      <StudioLibrary />
    </Guard>
  );
}
function StudioLibrary() {
  const { logout, notify } = useApp();
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<Journey[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [deleting, setDeleting] = useState<Journey | null>(null);
  const issues = useMemo(() => issueNumbers(journeys), [journeys]);
  const load = () => {
    setError("");
    setLoading(true);
    return api<Journey[]>("/journeys")
      .then(setJourneys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void load();
  }, []);
  // A published story can go back to private without deleting it; publishing again happens in the editor.
  const makePrivate = async (journey: Journey) => {
    setError("");
    try {
      await api(`/journeys/${journey.id}`, json("PATCH", { published: false }));
      setJourneys((js) => js.map((j) => (j.id === journey.id ? { ...j, published: false } : j)));
      notify(t("This story is private now. Only you can see it.", "Die Geschichte ist jetzt privat. Nur du siehst sie."));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main id="main" className="studio-page studio-lib page-width">
      <StudioIntro />
      <header className="studio-masthead">
        <div className="studio-masthead-top">
          <span className="eyebrow">{t("WANDER Studio", "WANDER Studio")}</span>
          <button
            type="button"
            className="studio-signout"
            onClick={() => logout().catch((e) => setError(e.message))}
          >
            {tr("Sign out")}
            <LogOut size={14} />
          </button>
        </div>
        <h1>
          {t("Your studio.", "Dein Studio.")} <em>{t("Your stories.", "Deine Geschichten.")}</em>
        </h1>
      </header>
      {error && (
        <div role="alert">
          <p className="form-error">{error}</p>
          <button className="text-link" onClick={() => void load()}>
            {tr("Try again")}
          </button>
        </div>
      )}
      <section className="studio-section studio-journeys" aria-labelledby="studio-journeys-title">
        <h2 id="studio-journeys-title" className="sr-only">
          {tr("Your stories")}
        </h2>
        <ol className="am-grid studio-am" aria-label={t("All stories", "Alle Geschichten")}>
          <li className="am-item studio-am-new">
            <button type="button" className="studio-new-row" onClick={() => navigate("/studio/new")}>
              <span className="studio-new-circle" aria-hidden="true">
                <Plus size={20} />
              </span>
              <span className="studio-new-title">{tr("New story")}</span>
              <span className="studio-new-note">
                {t("Upload photos and shape a story", "Fotos hochladen und Geschichte gestalten")}
              </span>
              <ArrowRight className="studio-new-arrow" size={20} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </li>
          {loading
            ? [0, 1].map((n) => (
                <li className="am-item" key={n} aria-hidden="true" aria-busy="true">
                  <div className="am-card is-bare studio-am-skeleton" />
                </li>
              ))
            : journeys.map((j, index) => {
                const issue = issues.get(j.id) ?? index + 1;
                const when0 = travelDate(j);
                const kicker = t(issueKicker(issue, when0, "en"), issueKicker(issue, when0, "de"));
                const when = t(studioSeasonYear(when0, false), studioSeasonYear(when0, true));
                const place = [j.location, j.country].filter(Boolean).join(", ");
                const blurb = j.subtitle || j.description || place;
                const hasCover = Boolean(j.cover?.url);
                return (
                  <li id={`issue-${issue}`} className="am-item studio-am-item" key={j.id}>
                    <Link
                      to={`/studio/${j.slug}`}
                      className={`am-card${hasCover ? "" : " is-bare"}`}
                      aria-label={`${t("Edit story", "Geschichte bearbeiten")}: ${j.title}, ${kicker}`}
                    >
                      {hasCover && (
                        <div
                          className={`am-cover${j.layout?.archive_focus || j.cover_focus ? " has-cover-focus" : ""}`}
                          style={archiveFocusVars(j) as CSSProperties | undefined}
                        >
                          <Picture animate photo={j.cover} sizes="100vw" />
                        </div>
                      )}
                      <div className="am-shade" aria-hidden="true" />
                      <p className="am-no" aria-hidden="true">{String(issue).padStart(2, "0")}</p>
                      <div className="am-copy">
                        {when && <p className="am-when" aria-hidden="true">{when}</p>}
                        <h2 className="am-title">{j.title}</h2>
                        {blurb && <p className="am-sub">{blurb}</p>}
                      </div>
                      {place && (
                        <p className="am-kicker" aria-hidden="true">
                          <span>{place}</span>
                        </p>
                      )}
                    </Link>
                    <div className="studio-am-bar">
                      <span
                        className={`status ${j.published ? "is-published" : ""}`}
                        title={j.published ? undefined : tr("Drafts are only visible to you")}
                      >
                        <i />
                        {j.published ? tr("Published") : tr("Draft")}
                      </span>
                      <dl className="studio-am-stats">
                        <div>
                          <dt>{t("Photos", "Fotos")}</dt>
                          <dd>{j.photo_count}</dd>
                        </div>
                        <div>
                          <dt>{t("Modules", "Module")}</dt>
                          <dd>{j.chapter_count}</dd>
                        </div>
                      </dl>
                      <div className="studio-am-actions">
                        <Link to={`/studio/${j.slug}`} className="studio-quiet-btn studio-row-edit">
                          <Pencil size={15} />
                          {t("Edit story", "Geschichte bearbeiten")}
                        </Link>
                        {j.published && (
                          <Link to={`/journeys/${j.slug}`} className="studio-row-view">
                            {t("View", "Ansehen")}
                            <ArrowUpRight size={14} />
                          </Link>
                        )}
                        {j.published && (
                          <button
                            type="button"
                            className="studio-row-view studio-row-private"
                            title={t("Visible only to you; nothing is deleted", "Nur noch für dich sichtbar; nichts wird gelöscht")}
                            onClick={() => void makePrivate(j)}
                          >
                            <EyeOff size={14} />
                            {t("Make private", "Auf privat stellen")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="studio-delete"
                          aria-label={`${tr("Delete")} ${j.title}`}
                          onClick={() => setDeleting(j)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
        </ol>
      </section>
      <section className="studio-design" aria-labelledby="studio-design-title">
        <div className="studio-section-head">
          <h2 id="studio-design-title" className="studio-section-label">
            {t("Website design", "Gestaltung der Website")}
          </h2>
          <span className="studio-section-note">
            {t("Homepage cover and the two editions", "Titelbild der Startseite und die zwei Editionen")}
          </span>
        </div>
        <div className="studio-design-grid">
          <HeroCoverEditor journeys={journeys} />
          <EditionEditor journeys={journeys} />
        </div>
      </section>
      {shouldShowEmptyLibrary(loading, error, journeys.length) && (
        <div className="empty-state">
          <Compass />
          <h2>{tr("The first page is yours.")}</h2>
          <button className="text-link" onClick={() => navigate("/studio/new")}>
            {tr("Create your first story")}
            <Plus size={18} />
          </button>
        </div>
      )}
      {deleting && (
        <Confirm
          title={`${tr("Delete")} ${deleting.title}?`}
          description={tr(
            "This permanently removes the story, its chapters and uploaded photographs. This cannot be undone.",
          )}
          onClose={() => setDeleting(null)}
          action={async () => {
            await api(`/journeys/${deleting.id}`, { method: "DELETE" });
            setJourneys((js) => js.filter((j) => j.id !== deleting.id));
            notify(tr("Story deleted."));
            setDeleting(null);
          }}
        />
      )}
    </main>
  );
}
export function JourneyEditor() {
  return (
    <Guard>
      <ModularEditor />
    </Guard>
  );
}

export function NewJourney() {
  return (
    <Guard>
      <NewJournal />
    </Guard>
  );
}
