import { useEffect, useLayoutEffect } from "react";
import type { CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { isMotionOff } from "./motionState";
import { prefetch } from "./api";
import {
  PAGE_READY_MAX_MS,
  createScrollMemory,
  expectsCoverImage,
  navTargetFor,
  pageIsReady,
  pageTransitionAllowed,
  popTransitionWanted,
  TRANSITION_CLASS_MAX_MS,
  prefetchPathsFor,
} from "./adaptiveHeader";

/**
 * Trial feature: fluid page transitions via the native View Transitions API.
 * Set to `false` to switch everything off; the app then behaves exactly as before.
 *
 * React Router's own `viewTransition` option only works with data routers
 * (RouterProvider); main.tsx uses BrowserRouter, so navigation is wrapped here.
 */
export const VIEW_TRANSITIONS_ENABLED = true;


type StartViewTransition = (update: () => Promise<void> | void) => {
  skipTransition: () => void;
  finished: Promise<unknown>;
  ready: Promise<unknown>;
  updateCallbackDone: Promise<unknown>;
};

let pendingName: string | null = null;
let active: { skipTransition: () => void } | null = null;

function supported() {
  return (
    VIEW_TRANSITIONS_ENABLED &&
    typeof document !== "undefined" &&
    typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === "function" &&
    !isMotionOff()
  );
}

/** Spread onto a link that leads to a story: lets the cover image morph into the story cover. */
export function coverLinkProps(
  slug: string,
  cover: { id: number; url: string; srcset?: string; alt?: string; width?: number; height?: number } | null | undefined,
  source?: string,
): Record<string, string> {
  if (!VIEW_TRANSITIONS_ENABLED || !cover) return {};
  const props: Record<string, string> = {
    "data-vt-cover": JSON.stringify({
      slug,
      cover: {
        id: cover.id, url: cover.url, srcset: cover.srcset, alt: cover.alt,
        width: cover.width, height: cover.height,
      },
    }),
  };
  if (source) props["data-vt-source"] = source;
  return props;
}

/** Inline style for the destination cover; only non-empty while a morph is running. */
export function coverTransitionStyle(): CSSProperties | undefined {
  return pendingName ? { viewTransitionName: pendingName } : undefined;
}
export const coverTransitionAttr = () => (pendingName ? { "data-vt-dest": "" } : {});

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

// ---------- Readiness: the new page is shown only once it has something to show ----------

/** Path the router has actually rendered (updated in a layout effect of the hook below). */
let renderedPath = typeof location === "undefined" ? "/" : location.pathname;
let renderedSearch = typeof location === "undefined" ? "" : location.search;

function heroImage(scope: ParentNode): HTMLImageElement | null {
  for (const img of Array.from(scope.querySelectorAll("img"))) {
    const r = img.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0) return img;
  }
  return null;
}

/** Whether the destination is ready, and the image that still has to be decoded. */
function destinationState(path: string, morph: boolean): { ready: boolean; image: HTMLImageElement | null } {
  if (morph) {
    const dest = document.querySelector<HTMLElement>("[data-vt-dest]");
    return dest ? { ready: true, image: dest.querySelector("img") } : { ready: false, image: null };
  }
  const main = document.getElementById("main");
  const ready = pageIsReady({
    rendered: renderedPath === path,
    present: !!main,
    flag: main?.getAttribute("data-page-ready") ?? null,
    busy: !!main && (main.getAttribute("aria-busy") === "true" || main.classList.contains("page-state")),
    expectsImage: expectsCoverImage(path),
    hasImage: !!main?.querySelector("img"),
  });
  return { ready, image: ready && main ? heroImage(main) : null };
}

/**
 * Resolves when the page at `path` has its data (data-page-ready, or no loading placeholder)
 * and its first visible photograph is decoded – at the latest after PAGE_READY_MAX_MS.
 */
export function waitForPageReady(path: string, morph = false): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let decoding = false;
    const finish = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (done || decoding) return;
      const state = destinationState(path, morph);
      if (!state.ready) return;
      decoding = true;
      observer.disconnect();
      if (!state.image) return finish();
      // Rendering is held during the update, so a lazy image in view would never start loading.
      if (state.image.loading === "lazy") state.image.loading = "eager";
      state.image.decode().catch(() => {}).then(finish);
    };
    const observer = new MutationObserver(check);
    const timer = setTimeout(finish, PAGE_READY_MAX_MS);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-page-ready", "aria-busy", "class", "data-vt-dest", "src"],
    });
    // Effects of the new route (and prefetched responses) get one task to land first.
    setTimeout(check, 0);
  });
}

/** Cover morph: waits for the story's cover frame, through the same readiness signal. */
function waitForDestination(path: string): Promise<void> {
  return waitForPageReady(path, true);
}

// ---------- Scroll positions for Back/Forward ----------

const scrollMemory = createScrollMemory();
let pendingRestore: { key: string; y: number } | null = null;

function historyKey(): string {
  const state = (typeof history === "undefined" ? null : history.state) as { key?: string } | null;
  return state?.key ?? "default";
}
function rememberScroll() {
  // Positions during a page change (or a running restore) belong to neither page.
  if (!pendingRestore && !updating) scrollMemory.save(historyKey(), window.scrollY);
}
/**
 * Called by the app's scroll effect: a Back/Forward visit returns to its own place
 * instead of the top. Returns true when it handled the scroll position.
 */
export function restoreScrollFor(key: string): boolean {
  if (!pendingRestore || pendingRestore.key !== key) return false;
  window.scrollTo({ top: pendingRestore.y, behavior: "instant" });
  return true;
}
function finishRestore(key: string) {
  const entry = pendingRestore;
  if (!entry || entry.key !== key) return;
  window.scrollTo({ top: entry.y, behavior: "instant" });
  // Keep the target a moment longer: the app's scroll effect may still run for this entry.
  setTimeout(() => {
    if (pendingRestore === entry) pendingRestore = null;
  }, 160);
}

// ---------- Active navigation item: changes on click, not after loading ----------

function markPendingNav(path: string) {
  const nav = document.querySelector(".site-header nav");
  if (!nav) return;
  const target = navTargetFor(path);
  document.documentElement.setAttribute("data-vt-nav", target ?? "none");
  nav.querySelectorAll<HTMLAnchorElement>(":scope > a[href]").forEach((link) => {
    const own = navTargetFor(new URL(link.href, location.href).pathname);
    link.toggleAttribute("data-vt-current", !!target && own === target);
  });
}
function clearPendingNav() {
  document.documentElement.removeAttribute("data-vt-nav");
  document.querySelectorAll("[data-vt-current]").forEach((el) => el.removeAttribute("data-vt-current"));
}

// ---------- Preloading on hover/focus ----------

const preloaders: Array<[RegExp, () => unknown]> = [];
/** Lets the app warm a lazily loaded route (the studio chunk) together with its data. */
export function registerPreload(test: RegExp, load: () => unknown) {
  preloaders.push([test, load]);
}
function warm(path: string) {
  prefetchPathsFor(path, document.documentElement.lang).forEach(prefetch);
  for (const [test, load] of preloaders) {
    if (test.test(path)) {
      try { void Promise.resolve(load()).catch(() => {}); } catch { /* preloading is optional */ }
    }
  }
}

// ---------- The transition itself ----------

interface PageChange {
  /** Destination pathname. */
  to: string;
  /** Performs the router update (inside flushSync). */
  apply: () => void;
  /** Places the new page: top, anchor or a restored position. */
  place: () => void;
  /** History entry whose scroll position is restored (Back/Forward). */
  restoreKey?: string;
}

/** True from the start of a transition until its destination is ready. */
let updating = false;
/** A later click or Back/Forward that arrived during that wait; it replaces the destination. */
let queued: PageChange | null = null;

function perform(change: PageChange) {
  flushSync(change.apply);
  clearPendingNav();
  change.place();
}

function runTransition(first: PageChange, source: HTMLElement | null = null, slug: string | null = null) {
  if (updating) {
    // The old picture is still on screen: switch the destination instead of starting a
    // second transition over a half-built page.
    queued = first;
    markPendingNav(first.to);
    return;
  }
  const root = document.documentElement;
  const name = source && slug ? `journey-cover-${slug.replace(/[^\w-]/g, "_")}` : null;
  let applied = false;
  const update = async () => {
    try {
      let change = first;
      let morph = !!name;
      for (;;) {
        perform(change);
        applied = true;
        await (morph ? waitForDestination(change.to) : waitForPageReady(change.to));
        if (!queued) break;
        change = queued;
        queued = null;
        morph = false;
      }
      // Content has arrived: place it again (anchors and restored positions need the height).
      if (change.restoreKey) finishRestore(change.restoreKey);
      else change.place();
    } finally {
      updating = false;
    }
  };
  let mine: { skipTransition: () => void } | null = null;
  const cleanup = () => {
    if (source) source.style.viewTransitionName = "";
    // A skipped earlier transition must not clean up after its successor.
    if (mine && active !== mine) return;
    root.classList.remove("vt-active", "vt-morph");
    clearPendingNav();
    document.querySelectorAll<HTMLElement>("[data-vt-dest]").forEach((el) => {
      el.style.viewTransitionName = "";
      el.removeAttribute("data-vt-dest");
    });
    if (pendingName === name) pendingName = null;
    active = null;
    // Reveal and paused entrance animations continue from here.
    window.dispatchEvent(new Event("wander-page-transition-end"));
  };
  const fallback = () => {
    if (applied) return;
    applied = true;
    try { perform(queued ?? first); } catch { /* router handles its own errors */ }
    queued = null;
    if (first.restoreKey) void waitForPageReady(first.to).then(() => finishRestore(first.restoreKey!));
  };
  try {
    active?.skipTransition();
    // From here until the destination is ready, further requests are queued.
    updating = true;
    pendingName = name;
    markPendingNav(first.to);
    root.classList.add("vt-active");
    if (name && source) {
      root.classList.add("vt-morph");
      source.style.viewTransitionName = name;
    }
    const transition = (document as unknown as { startViewTransition: StartViewTransition })
      .startViewTransition(update);
    active = mine = transition;
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(fallback);
    transition.finished.catch(() => {}).finally(cleanup);
    // Safety net: never leave reveals and entrances paused if "finished" never settles.
    window.setTimeout(() => {
      if (active !== transition) return;
      root.classList.remove("vt-active", "vt-morph");
      window.dispatchEvent(new Event("wander-page-transition-end"));
    }, TRANSITION_CLASS_MAX_MS);
  } catch {
    updating = false;
    cleanup();
    fallback();
  }
}

// ---------- Back/Forward ----------

let replaying = false;
function onPop(event: PopStateEvent) {
  if (replaying) return;
  const key = historyKey();
  pendingRestore = { key, y: scrollMemory.get(key) ?? 0 };
  const to = location.pathname;
  const wanted = popTransitionWanted({
    fromPath: renderedPath,
    fromSearch: renderedSearch,
    toPath: to,
    toSearch: location.search,
    // The viewer is still open while its own entry is being left.
    fromLightbox: !!document.querySelector("dialog.focus-view[open]"),
    toLightbox: !!(event.state as { wanderLightbox?: unknown } | null)?.wanderLightbox,
  });
  if (!supported() || !wanted) {
    // Same page (e.g. the photo viewer closing): let the event through untouched.
    if (to === renderedPath) { pendingRestore = null; return; }
    void waitForPageReady(to).then(() => finishRestore(key));
    return;
  }
  // Hold the router back and replay this event inside the transition.
  event.stopImmediatePropagation();
  const state = event.state;
  runTransition({
    to,
    restoreKey: key,
    apply: () => {
      replaying = true;
      try { window.dispatchEvent(new PopStateEvent("popstate", { state })); } finally { replaying = false; }
    },
    place: () => restoreScrollFor(key),
  });
}
// Listeners on window run in the order they were added (capture does not help here),
// so this one is added when the module loads, before React Router creates its history.
// One stable listener forwards to the current handler (hot reload replaces it).
if (typeof window !== "undefined") {
  const slot = window as unknown as { __wanderPop?: { handle: (event: PopStateEvent) => void } };
  if (!slot.__wanderPop) {
    const holder = { handle: onPop };
    slot.__wanderPop = holder;
    window.addEventListener("popstate", (event) => holder.handle(event));
  } else slot.__wanderPop.handle = onPop;
}

/**
 * Runs in-app link clicks and Back/Forward inside a view transition ("Abblende"),
 * preloads destinations on hover/focus and keeps scroll positions per history entry.
 */
export function useViewTransitionLinks() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    renderedPath = pathname;
    renderedSearch = location.search;
  }, [pathname]);
  // Scroll memory and Back/Forward work with or without transitions.
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; rememberScroll(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    const onIntent = (event: Event) => {
      const anchor = (event.target as Element | null)?.closest?.(".site-header a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin === location.origin && url.pathname !== location.pathname) warm(url.pathname);
    };
    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("focusin", onIntent);
    return () => {
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
    };
  }, []);
  useEffect(() => {
    if (!VIEW_TRANSITIONS_ENABLED) return;
    const onClick = (event: MouseEvent) => {
      try {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (!supported()) return;
        const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin) return;
        if (!pageTransitionAllowed(location.pathname, url.pathname)) return;
        if (url.pathname === location.pathname && url.search === location.search) return;
        let slug: string | null = null;
        let state: unknown;
        let source: HTMLElement | null = null;
        const raw = anchor.getAttribute("data-vt-cover");
        if (raw) {
          const link = JSON.parse(raw) as { slug: string };
          slug = link.slug;
          state = { storyCover: link };
          const selector = anchor.getAttribute("data-vt-source");
          const candidate = selector ? document.querySelector(selector) : anchor.querySelector("img");
          source = visible(candidate) ? candidate : null;
        }
        event.preventDefault();
        rememberScroll();
        const to = url.pathname + url.search + url.hash;
        const hash = url.hash;
        runTransition({
          to: url.pathname,
          apply: () => navigate(to, { state }),
          place: () => {
            if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "instant" });
            else window.scrollTo({ top: 0, behavior: "instant" });
          },
        }, source, slug);
      } catch {
        /* Never block navigation: fall through to the router's own handling. */
      }
    };
    // On body (capture): after document-level guards such as the editor's
    // "unsaved changes" check, but before React Router's link handler.
    const body = document.body;
    body.addEventListener("click", onClick, true);
    return () => body.removeEventListener("click", onClick, true);
  }, [navigate]);
}
