import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "./I18n";
import { useMotionOff } from "./Motion";
import { activeChapterIndex, updateReadingDirection } from "./chapterCompass";
import type { Chapter } from "./types";

export function QuietAtlasChapterCompass({
  chapters,
}: {
  chapters: Chapter[];
}) {
  const ref = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const motionOff = useMotionOff();
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const jumpingUntil = useRef(0);
  const historyUrl = useRef("");
  const chapterKey = chapters.map((chapter) => chapter.id).join(",");

  useEffect(() => {
    const navigation = ref.current;
    const doc = navigation?.ownerDocument;
    const view = doc?.defaultView;
    if (!navigation || !doc || !view) return;
    historyUrl.current = view.location.href;
    const canvas = navigation.closest(".journal-canvas");
    const sections = chapterKey
      .split(",")
      .map((id) => doc.getElementById(`canvas-module-${id}`));
    let direction = { anchor: view.scrollY, visible: false };
    let frame = 0;
    let historyFrame = 0;
    const update = () => {
      frame = 0;
      const height = view.innerHeight;
      setActive(
        activeChapterIndex(
          sections.map(
            (section) => section?.getBoundingClientRect().top ?? Infinity,
          ),
          height * 0.3,
        ),
      );
      direction =
        view.performance.now() < jumpingUntil.current
          ? { anchor: view.scrollY, visible: false }
          : updateReadingDirection(direction, Math.max(0, view.scrollY));
      const cover = canvas
        ?.querySelector(".journal-cover")
        ?.getBoundingClientRect();
      const headingVisible = sections.some((section) => {
        const heading = section
          ?.querySelector(".module-day-heading > h2")
          ?.getBoundingClientRect();
        return heading && heading.bottom > 0 && heading.top < height * 0.8;
      });
      const canvasBounds = canvas?.getBoundingClientRect();
      setVisible(
        direction.visible &&
          !headingVisible &&
          !(cover && cover.bottom > 0) &&
          !!canvasBounds &&
          canvasBounds.bottom > 80 &&
          canvasBounds.top < 0,
      );
    };
    const schedule = () => {
      if (!frame) frame = view.requestAnimationFrame(update);
    };
    const restoreChapter = () => {
      // The photograph dialog uses same-URL history entries of its own.
      if (historyUrl.current === view.location.href) {
        schedule();
        return;
      }
      historyUrl.current = view.location.href;
      // Cancel an unfinished smooth jump before restoring a history target.
      view.scrollTo({ top: view.scrollY, behavior: "instant" });
      view.cancelAnimationFrame(historyFrame);
      historyFrame = view.requestAnimationFrame(() => {
        historyFrame = 0;
        const saved = view.history.state?.wanderChapterCompass;
        const target = doc.getElementById(view.location.hash.slice(1));
        if (saved?.url === view.location.href && Number.isFinite(saved.y)) {
          view.scrollTo({ top: saved.y, behavior: "instant" });
          const index = activeChapterIndex(
            sections.map(
              (section) => section?.getBoundingClientRect().top ?? Infinity,
            ),
            view.innerHeight * 0.3,
          );
          sections[index]?.focus({ preventScroll: true });
        } else if (target && sections.includes(target)) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "start", behavior: "instant" });
        }
        jumpingUntil.current = 0;
        direction = { anchor: view.scrollY, visible: false };
        schedule();
      });
    };
    const resumeReading = () => {
      if (jumpingUntil.current > 0) {
        jumpingUntil.current = 0;
        direction = { anchor: view.scrollY, visible: false };
      }
    };
    const resumeKeyboardReading = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        resumeReading();
    };
    update();
    view.addEventListener("scroll", schedule, { passive: true });
    view.addEventListener("resize", schedule);
    view.addEventListener("hashchange", restoreChapter);
    view.addEventListener("popstate", restoreChapter);
    view.addEventListener("wheel", resumeReading, { passive: true });
    view.addEventListener("touchstart", resumeReading, { passive: true });
    view.addEventListener("keydown", resumeKeyboardReading);
    return () => {
      view.cancelAnimationFrame(frame);
      view.cancelAnimationFrame(historyFrame);
      view.removeEventListener("scroll", schedule);
      view.removeEventListener("resize", schedule);
      view.removeEventListener("hashchange", restoreChapter);
      view.removeEventListener("popstate", restoreChapter);
      view.removeEventListener("wheel", resumeReading);
      view.removeEventListener("touchstart", resumeReading);
      view.removeEventListener("keydown", resumeKeyboardReading);
    };
  }, [chapterKey]);

  useEffect(() => {
    if (!open) return;
    const nav = ref.current;
    const doc = nav?.ownerDocument;
    nav?.querySelector<HTMLAnchorElement>(`a[data-index="${active}"]`)?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target && !nav?.contains(event.target as Node)) setOpen(false);
    };
    doc?.addEventListener("pointerdown", dismiss);
    return () => doc?.removeEventListener("pointerdown", dismiss);
    // Focus the current chapter only on opening; scrolling must not move focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function follow(event: MouseEvent<HTMLAnchorElement>, index: number) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.currentTarget;
    const doc = link.ownerDocument;
    const view = doc.defaultView;
    const target = doc.getElementById(link.hash.slice(1));
    if (!target || !view) return;
    event.preventDefault();
    // A srcdoc preview inherits its parent's base URL, but cannot rewrite its
    // about:srcdoc history to that HTTP URL. Keep preview navigation local.
    if (
      /^https?:$/.test(view.location.protocol) &&
      view.location.hash !== link.hash
    ) {
      const state = { ...view.history.state };
      // Keep the outgoing reading position, including entries without a hash.
      view.history.replaceState(
        {
          ...state,
          wanderChapterCompass: { url: view.location.href, y: view.scrollY },
        },
        "",
      );
      delete state.wanderChapterCompass;
      view.history.pushState(state, "", link.hash);
      historyUrl.current = view.location.href;
    }
    setOpen(false);
    setActive(index);
    setVisible(false);
    jumpingUntil.current = view.performance.now() + 1200;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      block: "start",
      behavior:
        motionOff || view.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
    });
  }

  const current = chapters[active] || chapters[0];
  return (
    <nav
      ref={ref}
      className={`chapter-compass${motionOff ? " is-motion-off" : ""}`}
      aria-label={t("Chapters", "Kapitel")}
      hidden={!visible && !open && !focused}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <button
        ref={toggleRef}
        className="chapter-compass-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t("Chapters", "Kapitel")}: ${active + 1} / ${chapters.length}, ${current?.title}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="chapter-compass-count">
          {String(active + 1).padStart(2, "0")}{" "}
          <span>/ {String(chapters.length).padStart(2, "0")}</span>
        </span>
        <span className="chapter-compass-title">
          {current?.title || t("Untitled chapter", "Kapitel ohne Titel")}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <div className="chapter-compass-position" aria-hidden="true">
        {chapters.map((chapter, index) => (
          <span
            key={chapter.id}
            className={index === active ? "is-current" : undefined}
          />
        ))}
      </div>
      <ol id={listId} className="chapter-compass-list" hidden={!open}>
        {chapters.map((chapter, index) => (
          <li key={chapter.id}>
            <a
              href={`#canvas-module-${chapter.id}`}
              data-index={index}
              onClick={(event) => follow(event, index)}
              aria-current={index === active ? "location" : undefined}
            >
              <span className="chapter-compass-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                {chapter.title || t("Untitled chapter", "Kapitel ohne Titel")}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
