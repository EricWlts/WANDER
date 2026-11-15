/**
 * Eine Stelle für die Frage „soll sich hier etwas bewegen?“.
 * Bewegung ist aus bei prefers-reduced-motion: reduce UND bei html[data-motion="off"].
 *
 * Die MediaQueryList wird pro Fenster einmal angelegt und wiederverwendet: so ist
 * `.matches` billig (kein matchMedia pro Frame und Element), und ein Listener lässt
 * sich auf genau derselben Instanz an- und wieder abmelden.
 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Das Wenige, was gebraucht wird; Vorschau-Iframes und Tests liefern dasselbe. */
export type MotionWindow = Pick<Window, "matchMedia"> & {
  document: { documentElement: { dataset: DOMStringMap } };
};

const queries = new WeakMap<object, Map<string, MediaQueryList>>();

function currentWindow(win?: MotionWindow): MotionWindow | undefined {
  if (win) return win;
  return typeof window === "undefined" ? undefined : window;
}

/**
 * Gecachte MediaQueryList pro Fenster und Abfrage. Listener immer auf dieser Instanz
 * an- UND abmelden: ein neues matchMedia() liefert ein anderes Objekt.
 */
export function cachedQuery(query: string, win?: Pick<Window, "matchMedia">): MediaQueryList | undefined {
  const target = win ?? (typeof window === "undefined" ? undefined : window);
  if (!target || typeof target.matchMedia !== "function") return undefined;
  let byQuery = queries.get(target);
  if (!byQuery) {
    byQuery = new Map();
    queries.set(target, byQuery);
  }
  let list = byQuery.get(query);
  if (!list) {
    list = target.matchMedia(query);
    byQuery.set(query, list);
  }
  return list;
}

export function reducedMotionQuery(win?: MotionWindow): MediaQueryList | undefined {
  return cachedQuery(REDUCED_MOTION_QUERY, win);
}

/** Nur die Systemeinstellung. */
export function prefersReducedMotion(win?: MotionWindow): boolean {
  return reducedMotionQuery(win)?.matches ?? false;
}

/** Systemeinstellung ODER der Schalter der Seite (html[data-motion="off"]). */
export function isMotionOff(win?: MotionWindow): boolean {
  const target = currentWindow(win);
  if (!target) return false;
  return target.document.documentElement.dataset.motion === "off" || prefersReducedMotion(target);
}

/**
 * Gemeinsamer Scroll-Takt: ein Scroll-/Resize-Listener und ein requestAnimationFrame pro Fenster,
 * egal wie viele Elemente mitlaufen. Ein Eintrag ist nur angemeldet, solange er sichtbar ist.
 * Lesen und Schreiben sind getrennt: erst alle read(), dann alle zurückgegebenen Schreiber.
 */
export type ScrollFrameWindow = Pick<
  Window,
  "addEventListener" | "removeEventListener" | "requestAnimationFrame" | "cancelAnimationFrame"
>;
export type ScrollFrameEntry = { read: () => (() => void) | void };

type ScrollFrameState = {
  win: ScrollFrameWindow;
  also?: ScrollFrameWindow;
  entries: Set<ScrollFrameEntry>;
  frame: number;
  request: () => void;
};
const frames = new WeakMap<object, ScrollFrameState>();

function runFrame(state: ScrollFrameState) {
  state.frame = 0;
  const writes: (() => void)[] = [];
  state.entries.forEach((entry) => {
    const write = entry.read();
    if (write) writes.push(write);
  });
  writes.forEach((write) => write());
}

/** Meldet einen Eintrag an. Gibt die Abmeldung zurück. `also` = zweites Fenster, dessen Scroll mitzählt (Vorschau-Iframe). */
export function joinScrollFrames(
  win: ScrollFrameWindow,
  entry: ScrollFrameEntry,
  also?: ScrollFrameWindow,
): () => void {
  let state = frames.get(win);
  if (!state) {
    const created: ScrollFrameState = {
      win,
      also: also && also !== win ? also : undefined,
      entries: new Set(),
      frame: 0,
      request: () => {
        if (!created.frame) created.frame = win.requestAnimationFrame(() => runFrame(created));
      },
    };
    frames.set(win, created);
    state = created;
  }
  const current = state;
  if (!current.entries.size) {
    current.win.addEventListener("scroll", current.request, { passive: true });
    current.win.addEventListener("resize", current.request);
    current.also?.addEventListener("scroll", current.request, { passive: true });
  }
  current.entries.add(entry);
  current.request();
  return () => {
    if (!current.entries.delete(entry) || current.entries.size) return;
    current.win.removeEventListener("scroll", current.request);
    current.win.removeEventListener("resize", current.request);
    current.also?.removeEventListener("scroll", current.request);
    current.win.cancelAnimationFrame(current.frame);
    current.frame = 0;
  };
}

/** Stößt einen Frame für alle angemeldeten Einträge dieses Fensters an (z. B. nach einer Moduswechsel). */
export function requestScrollFrame(win: ScrollFrameWindow) {
  frames.get(win)?.request();
}
