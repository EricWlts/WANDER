import { tr } from "./I18n";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  ArrowUpRight,
  EyeOff,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api, json } from "./api";
import { PageState, useApp } from "./App";
import { shouldShowEmptyLibrary, studioStatusLine, studioStoriesLine } from "./studioLibraryModel";
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
import { issueKicker, issueNumbers, travelDate } from "./issueLabel";
import { STUDIO_ORDER_KEY, parseStudioOrder, sortStudioJourneys, type StudioOrder } from "./studioSort";
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
      </form>
    </main>
  );
}
export function Studio() {
  return (
    <Guard>
      <StudioLibrary />
    </Guard>
  );
}
/** Cover of the newest story, shown inside the W at the end of the studio entrance (undefined while loading, null if none). */
function coverUrl(journey: Journey): string | null {
  const photo = journey.cover ?? journey.photos?.[0] ?? null;
  return photo ? photo.large_url || photo.url || null : null;
}
function introPhoto(journeys: Journey[]): string | null {
  const newest = journeys.filter((j) => j.cover || j.photos?.length).sort((a, b) => b.id - a.id)[0];
  const photo = newest ? (newest.cover ?? newest.photos[0]) : null;
  return photo ? photo.large_url || photo.url || null : null;
}
function StudioLibrary() {
  const { notify } = useApp();
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<Journey[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [deleting, setDeleting] = useState<Journey | null>(null);
  const [order, setOrder] = useState<StudioOrder>(() => {
    try {
      return parseStudioOrder(localStorage.getItem(STUDIO_ORDER_KEY));
    } catch {
      return "created";
    }
  });
  const changeOrder = (next: StudioOrder) => {
    setOrder(next);
    try {
      localStorage.setItem(STUDIO_ORDER_KEY, next);
    } catch {
      /* storage unavailable: the choice just isn't remembered */
    }
  };
  const issues = useMemo(() => issueNumbers(journeys), [journeys]);
  const sorted = useMemo(() => sortStudioJourneys(journeys, order), [journeys, order]);
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
  // The latest published story is the studio's title band: its cover runs up to the top edge behind the header,
  // "Your studio" lies on it as in the archive. Without a published story the studio starts with the masthead.
  const lead = !loading && sorted[0]?.published ? sorted[0] : null;
  const rest = lead ? sorted.slice(1) : sorted;
  const storiesLine = studioStoriesLine(journeys.length);
  const publishedCount = journeys.filter((j) => j.published).length;
  const statusLine = studioStatusLine(publishedCount, journeys.length - publishedCount);
  /** `wide`: the last story of an odd count takes the whole row instead of leaving an empty box beside it. */
  const renderItem = (j: (typeof sorted)[number], index: number, wide = false) => {
                const issue = issues.get(j.id) ?? index + 1;
                const when0 = travelDate(j);
                const kicker = t(issueKicker(issue, when0, "en"), issueKicker(issue, when0, "de"));
                const place = [j.location, j.country].filter(Boolean).join(", ");
                const hasCover = Boolean(j.cover?.url);
                return (
                  <li
                    id={`issue-${issue}`}
                    // The latest published story leads the studio as its title band (like the archive).
                    className={`am-item studio-am-item${lead && j.id === lead.id ? " studio-am-lead" : ""}${wide ? " studio-am-wide" : ""}`}
                    key={j.id}
                  >
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
                          <Picture
                            // The title image is what the studio entrance flies into: it must already stand there, fully visible.
                            animate={!(lead && j.id === lead.id)}
                            eager={!!lead && j.id === lead.id}
                            photo={j.cover}
                            sizes="100vw"
                          />
                        </div>
                      )}
                      <div className="am-shade" aria-hidden="true" />
                      {/* Studio: only title and place – always in the same spot, bottom left above the bar. */}
                      <div className="am-copy">
                        <h2 className="am-title">{j.title}</h2>
                        {place && <p className="am-place">{place}</p>}
                      </div>
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
  };
  return (
    <main id="main" className={`studio-page studio-lib page-width${lead ? " has-lead" : ""}`}>
      {/* The flight through the W ends on the studio's own title image (the latest published story), so only
          one photograph appears; without a published story the newest cover is used. */}
      <StudioIntro photoUrl={loading ? undefined : lead ? coverUrl(lead) : introPhoto(journeys)} />
      {lead && (
        <ol className="am-grid studio-am studio-am-top" aria-label={t("Latest published story", "Zuletzt veröffentlichte Geschichte")}>
          {renderItem(lead, 0)}
        </ol>
      )}
      <header className="studio-masthead">
        <h1>
          {t("Your studio.", "Dein Studio.")}{" "}
          <em>{loading ? t("Your stories.", "Deine Geschichten.") : t(storiesLine.en, storiesLine.de)}</em>
        </h1>
        {!loading && statusLine.de && <p className="studio-masthead-meta">{t(statusLine.en, statusLine.de)}</p>}
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
            <button
              type="button"
              className="studio-new-row"
              onClick={() => navigate("/studio/new")}
            >
              <span className="studio-new-light" aria-hidden="true" />
              <span className="studio-new-motes" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <i key={n} style={{ "--n": n } as CSSProperties} />
                ))}
              </span>
              <span className="studio-new-circle" aria-hidden="true">
                <Plus size={20} />
              </span>
              <span className="studio-new-title">{tr("New story")}</span>
              <span className="studio-new-note">
                {t("Your photos become a story.", "Aus deinen Fotos wird eine Geschichte.")}
              </span>
            </button>
            {/* Sorting sits in the same row, at its right end (the count lives in the title now). */}
            {!loading && journeys.length > 1 && (
              <div className="studio-sort">
          <button
            type="button"
            className="studio-sort-toggle"
            onClick={() => changeOrder(order === "created" ? "travel" : "created")}
            aria-label={
              order === "created"
                ? t(
                    "Sorted: recently created. Switch to by travel date",
                    "Sortiert: zuletzt erstellt. Umschalten auf Nach Reisedatum",
                  )
                : t(
                    "Sorted: by travel date. Switch to recently created",
                    "Sortiert: nach Reisedatum. Umschalten auf Zuletzt erstellt",
                  )
            }
          >
            <span className="studio-sort-label">{t("Sorted:", "Sortiert:")}</span>
            <ArrowDownUp size={14} aria-hidden="true" className={order === "travel" ? "is-flipped" : ""} />
            {order === "created" ? t("Recently created", "Zuletzt erstellt") : t("By travel date", "Nach Reisedatum")}
          </button>
              </div>
            )}
          </li>
          {loading
            ? [0, 1].map((n) => (
                <li className="am-item" key={n} aria-hidden="true" aria-busy="true">
                  <div className="am-card is-bare studio-am-skeleton" />
                </li>
              ))
            : rest.map((j, i) => renderItem(j, lead ? i + 1 : i, rest.length % 2 === 1 && i === rest.length - 1))}
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
