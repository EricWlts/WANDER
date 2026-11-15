import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronDown } from "lucide-react";
import "./chapter-rail.css";
import { t } from "./I18n";
import { dateLabel } from "./components";
import { useMotionOff } from "./Motion";
import { isMotionOff } from "./motionState";
import { activeChapterIndex } from "./chapterCompass";
import { chapterBlend, resolveActiveChapter } from "./titleDock";
import type { Chapter } from "./types";

export function QuietAtlasChapterCompass({
  chapters,
}: {
  chapters: Chapter[];
}) {
  const ref = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const listId = useId();
  const motionOff = useMotionOff();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const jumpingUntil = useRef(0);
  const activeRef = useRef(0);
  const blendRef = useRef(0);
  const landedRef = useRef<number | null>(null);
  const historyUrl = useRef("");
  const chapterKey = chapters.map((chapter) => chapter.id).join(",");

  // The left rail is retired (user preference): the top bar with dropdown is used at every width.
  useEffect(() => {
    const navigation = ref.current;
    const doc = navigation?.ownerDocument;
    const view = doc?.defaultView;
    if (!navigation || !doc || !view) return;
    historyUrl.current = view.location.href;
    const sections = chapterKey
      .split(",")
      .map((id) => doc.getElementById(`canvas-module-${id}`));
    let frame = 0;
    let dockedState = false;
    let historyFrame = 0;
    // First visible line of each chapter and its h2, picked once and on resize.
    let firsts: (HTMLElement | null)[] = [];
    let heads: (HTMLElement | null)[] = [];
    const lastQ: number[] = [];
    const measure = () => {
      firsts = sections.map(
        (section) =>
          [...(section?.querySelectorAll<HTMLElement>("time, p, h1, h2, h3, figure, img") ?? [])].find(
            (el) => el.getBoundingClientRect().height > 0,
          ) ?? section,
      );
      heads = sections.map((section) => section?.querySelector<HTMLElement>("h2") ?? null);
      heads.forEach((head) => head?.classList.add("dock-heading"));
    };
    const update = () => {
      frame = 0;
      // Docked = the sticky bar has reached its place beneath the masthead.
      const stickyTop = parseFloat(view.getComputedStyle(navigation).top) || 0;
      // Hysteresis: dock at the sticky edge, release only once clearly away from it.
      const barTop = navigation.getBoundingClientRect().top;
      if (barTop <= stickyTop + 1) dockedState = true;
      else if (barTop > stickyTop + 10) dockedState = false;
      setDocked(dockedState);
      if (!firsts.length || firsts.some((el) => el && !el.isConnected)) measure();
      const reduce = isMotionOff(view);
      // Reads first: bar edge and chapter tops.
      const edge = stickyTop + navigation.offsetHeight + 8;
      const tops = firsts.map((el) => el?.getBoundingClientRect().top ?? Infinity);
      const jumping = view.performance.now() < jumpingUntil.current;
      const landed = landedRef.current;
      if (landed !== null && !jumping && (tops[landed] > edge + 150 || tops[landed] < edge - 1))
        landedRef.current = null;
      // Reading line: a chapter becomes active as soon as its opening is clearly in view
      // (upper ~60 % of the screen), not only when it reaches the bar.
      const readLine = Math.max(edge, view.innerHeight * 0.45);
      let index = jumping
        ? activeRef.current
        : resolveActiveChapter(tops, readLine, landedRef.current);
      // Scrolling back up: keep the current chapter until its opening has moved
      // further down (~75 %), so the bar doesn't flicker between two chapters.
      const held = activeRef.current;
      if (!jumping && held > index && held < tops.length && tops[held] < view.innerHeight * 0.7)
        index = held;
      activeRef.current = index;
      const next = index + 1 < tops.length ? tops[index + 1] : Infinity;
      blendRef.current = reduce || jumping ? 0 : chapterBlend(next, edge, 80);
      // Writes: headings lift away, bar item glows, hairline glides.
      heads.forEach((head, i) => {
        if (!head) return;
        // Headings no longer fade at the bar (magazine style): --dock-q stays 0.
        const q = 0;
        if (lastQ[i] === q) return;
        lastQ[i] = q;
        head.style.setProperty("--dock-q", String(q));
      });
      // Reading progress through all chapters (0..1), smoothed by the blend toward the next one.
      const count = Math.max(1, tops.length - 1);
      const progress = Math.min(1, Math.max(0, (index + (index < count ? blendRef.current : 0)) / count));
      navigation.style.setProperty("--rail-p", progress.toFixed(4));
      if (!jumping) setActive(index);
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
        schedule();
      });
    };
    const remeasure = () => {
      measure();
      schedule();
    };
    measure();
    update();
    view.addEventListener("scroll", schedule, { passive: true });
    view.addEventListener("resize", remeasure);
    view.addEventListener("hashchange", restoreChapter);
    view.addEventListener("popstate", restoreChapter);
    return () => {
      view.cancelAnimationFrame(frame);
      view.cancelAnimationFrame(historyFrame);
      view.removeEventListener("scroll", schedule);
      view.removeEventListener("resize", remeasure);
      navigation.style.removeProperty("--rail-p");
      heads.forEach((head) => head?.style.removeProperty("--dock-q"));
      view.removeEventListener("hashchange", restoreChapter);
      view.removeEventListener("popstate", restoreChapter);
    };
  }, [chapterKey]);

  useEffect(() => {
    if (!open) return;
    const nav = ref.current;
    const doc = nav?.ownerDocument;
    // On the desktop rail the toggle is hidden and the list is always visible.
    if (!nav?.querySelector(".chapter-bar-toggle")?.checkVisibility?.()) return;
    nav?.querySelector<HTMLAnchorElement>(`a[data-index="${active}"]`)?.focus({ preventScroll: true });
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
    // The current chapter: just close the list, no jump.
    if (index === activeRef.current) {
      event.preventDefault();
      setOpen(false);
      return;
    }
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
    jumpingUntil.current = view.performance.now() + 1200;
    // Re-measure once the jump has settled; scroll events were ignored meanwhile.
    view.setTimeout(() => view.dispatchEvent(new Event("scroll")), 1250);
    target.focus({ preventScroll: true });
    // 08.11.: Land exactly below the folded header, the running title line and the
    // docked chapter bar (scroll-padding assumes the open masthead and overshoots).
    const reduceJump = motionOff || isMotionOff(view);
    const targetTop = () => {
      const doc = view.document;
      const line = doc.querySelector<HTMLElement>(".story-running-line");
      const lineH = line && view.getComputedStyle(line).display !== "none" ? line.offsetHeight : 0;
      const offset = 64 + lineH + 48 + 52;
      // Align the chapter's first visible line (date/kicker or title), not the module's padding box.
      const first = [...target.querySelectorAll<HTMLElement>("time, p, h1, h2, h3, figure, img")]
        .find((el) => el.getBoundingClientRect().height > 0) ?? target;
      return Math.max(0, first.getBoundingClientRect().top + view.scrollY - offset);
    };
    // Destination: measure the real (docked) bar edge when available, else the estimate.
    const destination = () => {
      // The visible bar is the inner row (the nav itself takes no height in the flow).
      const bar = (ref.current?.querySelector<HTMLElement>(".chapter-bar-inner") ?? ref.current)?.getBoundingClientRect();
      const gap = 52;
      const first = [...target.querySelectorAll<HTMLElement>("time, p, h1, h2, h3, figure, img")]
        .find((el) => el.getBoundingClientRect().height > 0) ?? target;
      return bar && bar.bottom > 0 && bar.bottom < view.innerHeight / 2
        ? Math.max(0, first.getBoundingClientRect().top + view.scrollY - bar.bottom - gap)
        : targetTop();
    };
    if (reduceJump) {
      view.scrollTo({ top: destination(), behavior: "instant" });
      view.requestAnimationFrame(() => {
        view.scrollTo({ top: destination(), behavior: "instant" });
        landedRef.current = index;
      });
      return;
    }
    // One continuous glide that re-aims every frame, so layout shifts (docking bar,
    // lazy images) bend the path instead of causing a second correction jump.
    const startY = view.scrollY;
    const distance = Math.abs(destination() - startY);
    const duration = Math.min(1100, Math.max(550, 420 + distance * 0.18));
    const t0 = view.performance.now();
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    jumpingUntil.current = t0 + duration + 150;
    activeRef.current = index;
    blendRef.current = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const y = startY + (destination() - startY) * ease(t);
      view.scrollTo({ top: y, behavior: "instant" });
      if (t < 1) view.requestAnimationFrame(step);
      else landedRef.current = index;
    };
    view.requestAnimationFrame(step);
  }

  // One date column: the bar's date and the dropdown's dates share the same x position,
  // placed just after the longest chapter title.
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const place = () => {
      const toggleTitle = nav.querySelector<HTMLElement>(".chapter-bar-current");
      const toggle = nav.querySelector<HTMLElement>(".chapter-bar-toggle");
      const list = listRef.current;
      if (!toggleTitle || !toggle || !list) return;
      nav.style.removeProperty("--chapter-title-col");
      if (window.innerWidth <= 480) {
        nav.style.removeProperty("--chapter-title-shift");
        return;
      }
      const titles = [...list.querySelectorAll<HTMLElement>(".chapter-bar-title")];
      const textWidth = (el: HTMLElement) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().width;
      };
      const widest = Math.max(textWidth(toggleTitle), ...titles.map(textWidth));
      const start = toggleTitle.getBoundingClientRect().left;
      // A little room for longer titles: at least 280px, and 60px past the longest title.
      const col = Math.max(280, widest + 60);
      const x = start + col;
      const toggleBox = toggle.getBoundingClientRect();
      const listBox = list.getBoundingClientRect();
      void toggleBox;
      if (x > window.innerWidth - 200) return;
      void listBox;
      nav.style.setProperty("--chapter-title-col", `${Math.ceil(col)}px`);
      // Titles in the list start where the bar's title starts.
      const listTitle = titles[0];
      if (listTitle) {
        const applied = parseFloat(nav.style.getPropertyValue("--chapter-title-shift")) || 0;
        const shift = Math.round(applied + start - listTitle.getBoundingClientRect().left);
        nav.style.setProperty("--chapter-title-shift", `${shift}px`);
      }
    };
    place();
    const fonts = document.fonts?.ready;
    fonts?.then(place).catch(() => undefined);
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, open, chapterKey]);

  const current = chapters[active] || chapters[0];
  const untitled = t("Untitled chapter", "Kapitel ohne Titel");
  return (
    <nav
      ref={ref}
      className={`chapter-bar${open ? " is-open" : ""}${docked ? " is-docked" : ""}${motionOff ? " is-motion-off" : ""}`}
      aria-label={t("Chapters", "Kapitel")}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          toggleRef.current?.focus({ preventScroll: true });
        }
      }}
    >
      <div className="chapter-bar-inner">
        <button
          ref={toggleRef}
          className="chapter-bar-toggle"
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${t("Chapters", "Kapitel")}: ${active + 1} / ${chapters.length}, ${current?.title || untitled}`}
          // Mouse clicks must not move focus (a focus scroll made the page jump).
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="chapter-bar-lead">
            <span className="chapter-bar-count" aria-hidden="true">
              {String(active + 1).padStart(2, "0")}
              <span> / {String(chapters.length).padStart(2, "0")}</span>
            </span>
            <span className="chapter-bar-current" aria-hidden="true">
              {current?.title || untitled}
            </span>
          </span>
          {current?.date && (
            <span className="chapter-bar-current-date" aria-hidden="true">
              {dateLabel(current.date, { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          )}
          <ChevronDown size={15} strokeWidth={1.25} aria-hidden="true" />
        </button>
        <ol id={listId} ref={listRef} className="chapter-bar-list">
          <li className="chapter-rail-line" aria-hidden="true" />
          {chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <a
                href={`#canvas-module-${chapter.id}`}
                data-index={index}
                onClick={(event) => follow(event, index)}
                aria-current={index === active ? "location" : undefined}
              >
                <span className="chapter-bar-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="chapter-rail-tick" aria-hidden="true" />
                <span className="chapter-bar-name">
                  <span className="chapter-bar-title">
                    {chapter.title || untitled}
                  </span>
                  {chapter.date && (
                    <span className="chapter-bar-date">
                      {dateLabel(chapter.date, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
