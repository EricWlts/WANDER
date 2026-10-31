import { tr } from "./I18n";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "./api";
import { PageState, useApp } from "./App";
import { Compass, dateRange, Field, Picture } from "./components";
import type { Journey } from "./types";
import { ModularEditor } from "./ModularEditor";
import { NewJournal } from "./NewJournal";
import { StoryStudio } from "./StoryStudio";
import { Confirm } from "./EditorDialogs";

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
      await login(password);
    } catch (e) {
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
          <em>{tr("your stories.")}</em>
        </h1>
        <p>
          {tr("A quiet workspace for the places you have been")}
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
          {tr(
            "Your first-run password appears in the backend terminal. See the README to reset it.",
          )}
        </small>
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
function StudioLibrary() {
  const { logout, notify } = useApp();
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<Journey[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [deleting, setDeleting] = useState<Journey | null>(null);
  const load = () =>
    api<Journey[]>("/journeys")
      .then(setJourneys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  return (
    <main id="main" className="studio-page page-width">
      <div className="studio-heading">
        <div>
          <span className="eyebrow">{tr("YOUR PERSONAL WORKSPACE")}</span>
          <h1>
            {tr("The")} <em>{tr("studio.")}</em>
          </h1>
          <p>{tr("A little care for the stories that matter.")}</p>
        </div>
        <div className="studio-actions">
          <button
            className="text-link"
            onClick={() => logout().catch((e) => setError(e.message))}
          >
            {tr("Sign out")}
            <LogOut size={15} />
          </button>
          <button className="button" onClick={() => navigate("/studio/new")}>
            <Plus size={17} />
            {tr("New journey")}
          </button>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="studio-library-label">
        <span>
          {tr("YOUR JOURNEYS (")}
          {journeys.length})
        </span>
        <span>{tr("DRAFTS ARE ONLY VISIBLE TO YOU")}</span>
      </div>
      {loading ? (
        <p>{tr("Opening your library…")}</p>
      ) : (
        journeys.map((j) => (
          <article className="studio-journey" key={j.id}>
            <Link to={`/studio/${j.slug}`} className="studio-thumb">
              <Picture photo={j.cover} sizes="200px" />
            </Link>
            <div>
              <span className={`status ${j.published ? "is-published" : ""}`}>
                <i />
                {j.published ? tr("Published") : tr("Draft")}
              </span>
              <Link to={`/studio/${j.slug}`}>
                <h2>{j.title}</h2>
              </Link>
              <p>
                {j.location || tr("A place to be added")} ·{" "}
                {dateRange(j.start_date, j.end_date)}
              </p>
              <span className="studio-meta">
                {j.photo_count} {tr("photographs ·")} {j.chapter_count}
                {tr("story modules")}
              </span>
            </div>
            <div className="row-actions">
              <Link to={`/studio/${j.slug}`} className="text-link">
                {tr("Edit story")}
                <Pencil size={15} />
              </Link>
              <button
                className="icon-button danger"
                aria-label={`${tr("Delete")} ${j.title}`}
                onClick={() => setDeleting(j)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </article>
        ))
      )}
      {!loading && !journeys.length && (
        <div className="empty-state">
          <Compass />
          <h2>{tr("The first page is yours.")}</h2>
          <button className="text-link" onClick={() => navigate("/studio/new")}>
            {tr("Create your first journey")}
            <Plus size={18} />
          </button>
        </div>
      )}
      {deleting && (
        <Confirm
          title={`${tr("Delete")} ${deleting.title}?`}
          description={tr(
            "This permanently removes the journey, its chapters and uploaded photographs. This cannot be undone.",
          )}
          onClose={() => setDeleting(null)}
          action={async () => {
            await api(`/journeys/${deleting.id}`, { method: "DELETE" });
            setJourneys((js) => js.filter((j) => j.id !== deleting.id));
            notify(tr("Journey deleted."));
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

export function GuidedEditor() {
  return (
    <Guard>
      <StoryStudio />
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
