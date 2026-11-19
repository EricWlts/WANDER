import { W_ANCHOR, W_PATH, W_VIEW, WINDOW, cubicBezier, coverScale, windowScale } from "./wMark";

/* "The W becomes a window" as plain DOM in document.body, so it survives the route change. Shared by the studio
   entrance (StudioIntro) and the story transition (StoryCreating). */

const NS = "http://www.w3.org/2000/svg";
let counter = 0;

/** Loads and decodes a photo; resolves with the url when it is ready, null after `maxMs` or on error. */
export function preloadPhoto(url: string | null | undefined, maxMs: number = WINDOW.maxPhotoWaitMs): Promise<string | null> {
  if (!url || typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), maxMs);
    const ok = () => {
      window.clearTimeout(timer);
      resolve(url);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
    if (typeof img.decode === "function") img.decode().then(ok, () => (img.complete && img.naturalWidth > 0 ? ok() : undefined));
    else img.onload = ok;
  });
}

/** Colour of the page below the overlay. */
export function pageColor(fallback: string): string {
  for (const el of [document.body, document.documentElement]) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return fallback;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Short cross-fade for reduced motion: a copy of the overlay fades away over the page. */
export function startFade(source: HTMLElement, ms = 400) {
  const host = source.cloneNode(true) as HTMLElement;
  host.setAttribute("aria-hidden", "true");
  host.querySelectorAll("[role]").forEach((n) => n.removeAttribute("role"));
  host.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  Object.assign(host.style, { animation: "none", pointerEvents: "none", transition: `opacity ${ms}ms ease`, opacity: "1" });
  document.body.appendChild(host);
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => (host.style.opacity = "0")));
  window.setTimeout(() => host.remove(), ms + 200);
}

export type WindowOptions = {
  /** The svg that shows the W (viewBox -20 -20 1035 555); the window starts exactly on top of it. */
  mark: Element;
  /** Texts to fade out first; they are copied to their current position. */
  texts: HTMLElement[];
  bg: string;
  fg: string;
  /** Extra strokes of the finished letter (same colour as the fill), in viewbox units. */
  strokes?: Array<{ d: string; width: number }>;
  photoUrl: string | null;
  /** Page colour shown inside the letter when there is no photo. */
  page: string;
  /** Studio entrance: the photo stays whole until it fills the screen; only then the page below appears (no
   *  glimpse of the page through the growing letter). */
  holdPhoto?: boolean;
  /** Studio entrance: the letter is a window onto the real page below from the start (no photo copy), with the
   *  calm studio timing – you look through the W at the title image and fly into it. */
  gentle?: boolean;
};

/** Hands the finished W over: photo fades into the letter, the letter grows around its widest point until the
 *  photo fills the screen (the camera seems to fly forward), then the photo dissolves to the page below. */
export function startWindowZoom(o: WindowOptions) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = o.mark.getBoundingClientRect();
  const s = rect.width / W_VIEW.w;
  const ox = rect.left - W_VIEW.x * s;
  const oy = rect.top - W_VIEW.y * s;
  const px = ox + W_ANCHOR.x * s;
  const py = oy + W_ANCHOR.y * s;
  const farthest = Math.max(Math.hypot(px, py), Math.hypot(vw - px, py), Math.hypot(px, vh - py), Math.hypot(vw - px, vh - py));
  const maxScale = coverScale(farthest, W_ANCHOR.r * s);

  const id = `w-window-${++counter}`;
  const host = document.createElement("div");
  host.className = "w-window";
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", inset: "0", zIndex: "10001", background: "transparent", pointerEvents: "none", overflow: "hidden" });

  const root = svg("svg", { width: vw, height: vh, viewBox: `0 0 ${vw} ${vh}` });
  Object.assign(root.style, { position: "absolute", inset: "0", display: "block" });
  const letter = (fill: string) => {
    const g = svg("g");
    g.appendChild(svg("path", { d: W_PATH, fill }));
    for (const st of o.strokes ?? []) {
      g.appendChild(svg("path", { d: st.d, fill: "none", stroke: fill, "stroke-width": st.width, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    }
    return g;
  };
  const place = (g: SVGElement, k: number) =>
    g.setAttribute("transform", `translate(${px} ${py}) scale(${s * k}) translate(${-W_ANCHOR.x} ${-W_ANCHOR.y})`);

  // Blend of both ideas: the letter first opens onto the cover photo, then – while it grows – the photo dissolves,
  // so the real page below shows through the widening W and takes over without a cut.
  const defs = svg("defs");
  const hole = svg("mask", { id, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: vw, height: vh });
  hole.appendChild(svg("rect", { x: 0, y: 0, width: vw, height: vh, fill: "#fff" }));
  const holeLetter = letter("#000");
  holeLetter.setAttribute("opacity", "0");
  place(holeLetter, 1);
  hole.appendChild(holeLetter);
  const pane = svg("mask", { id: `${id}-pane`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: vw, height: vh });
  const paneLetter = letter("#fff");
  place(paneLetter, 1);
  pane.appendChild(paneLetter);
  defs.append(hole, pane);
  root.appendChild(defs);

  root.appendChild(svg("rect", { x: 0, y: 0, width: vw, height: vh, fill: o.bg, mask: `url(#${id})` }));

  const photo = svg("g", { mask: `url(#${id}-pane)`, opacity: 0 });
  const imgGroup = svg("g");
  if (o.holdPhoto) imgGroup.appendChild(svg("rect", { x: 0, y: 0, width: vw, height: vh, fill: o.photoUrl ? o.bg : o.page }));

  if (o.photoUrl) {
    const img = svg("image", { x: 0, y: 0, width: vw, height: vh, preserveAspectRatio: "xMidYMid slice" });
    img.setAttribute("href", o.photoUrl);
    imgGroup.appendChild(img);
  }
  photo.appendChild(imgGroup);
  root.appendChild(photo);

  const solid = letter(o.fg);
  place(solid, 1);
  root.appendChild(solid);
  let rim: SVGGElement | null = null;
  if (o.gentle && GENTLE.rim > 0) {
    rim = svg("g", { opacity: 0 });
    const edge = svg("path", { d: W_PATH, fill: "none", stroke: "#f1ebe1", "stroke-width": 1.2, "stroke-linejoin": "round" });
    edge.setAttribute("vector-effect", "non-scaling-stroke");
    rim.appendChild(edge);
    place(rim, 1);
    root.appendChild(rim);
  }
  host.appendChild(root);

  const clones = o.texts.map((el) => {
    const r = el.getBoundingClientRect();
    // Keep the text's own colour: forcing the letter colour onto it made the word flick at the hand-over.
    const colour = getComputedStyle(el).color || o.fg;
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    c.removeAttribute("role");
    Object.assign(c.style, {
      position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, margin: "0",
      animation: "none", opacity: "1", color: colour, textAlign: "center",
    });
    host.appendChild(c);
    return c;
  });

  document.body.appendChild(host);

  const calm = !!(o.holdPhoto || o.gentle);
  const [x1, y1, x2, y2] = o.gentle ? GENTLE.ease : calm ? HOLD.ease : WINDOW.ease;
  const ease = cubicBezier(x1, y1, x2, y2);
  const t0 = performance.now();
  // Studio entrance (holdPhoto): fewer separate steps – the flight starts while the photo is still filling the
  // letter, and the photo itself barely moves. One continuous motion, then one fade to the page.
  const photoInMs = calm ? HOLD.photoInMs : WINDOW.photoInMs;
  const growStart = calm ? HOLD.growStartMs : WINDOW.photoInMs;
  const photoScaleFrom = calm ? HOLD.photoScaleFrom : WINDOW.photoScaleFrom;
  const growMs = o.gentle ? GENTLE.growMs : calm ? HOLD.growMs : WINDOW.growMs;
  const growEnd = growStart + growMs;
  const totalMs = growEnd + WINDOW.fadeMs;
  let frame = 0;
  const tick = (now: number) => {
    const t = now - t0;
    const fadeIn = Math.min(Math.max(t / photoInMs, 0), 1);
    const open = fadeIn * fadeIn * (3 - 2 * fadeIn);
    holeLetter.setAttribute("opacity", String(open));
    solid.setAttribute("opacity", String(1 - open));
    const textK = Math.min(t / WINDOW.textOutMs, 1);
    clones.forEach((c) => (c.style.opacity = String(1 - textK)));
    const g = Math.min(Math.max((t - growStart) / growMs, 0), 1);
    const e = ease(g);
    const k = windowScale(e, maxScale);
    place(holeLetter, k);
    place(paneLetter, k);
    // Photo: fades in with the opening, holds while the W is still small, dissolves during the second half of the flight.
    const dissolve = Math.min(Math.max((g - 0.35) / 0.5, 0), 1);
    const out = dissolve * dissolve * (3 - 2 * dissolve);
    photo.setAttribute("opacity", o.holdPhoto ? "1" : o.photoUrl ? String(open * (1 - out)) : "0");
    if (rim) {
      // A fine light edge outlines the window while it is small, so the dark surround and the (often dark) photo
      // read as two things; it fades away as the letter fills the screen.
      place(rim, k);
      const fade = Math.min(Math.max(g / 0.55, 0), 1);
      rim.setAttribute("opacity", String(open * (1 - fade) * GENTLE.rim));
    }
    const z = photoScaleFrom - (photoScaleFrom - 1) * e;
    imgGroup.setAttribute("transform", `translate(${vw / 2} ${vh / 2}) scale(${z}) translate(${-vw / 2} ${-vh / 2})`);
    if (t > growEnd) host.style.opacity = String(Math.max(1 - (t - growEnd) / WINDOW.fadeMs, 0));
    if (t >= totalMs) {
      host.remove();
      return;
    }
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);
  window.setTimeout(() => {
    window.cancelAnimationFrame(frame);
    host.remove();
  }, totalMs + 1000);
}
/** Timing of the studio entrance (holdPhoto): photo fills the letter quickly, the flight overlaps it. */
const HOLD = {
  photoInMs: 450,
  growStartMs: 180,
  photoScaleFrom: 1.06,
  // A gentler in-out than WINDOW.ease: no long standstill followed by a sudden rush – one even flight.
  growMs: 1700,
  ease: [0.55, 0, 0.3, 1] as const,
};
/** Studio entrance (gentle): a longer, softer flight; the page shows clearly through the W, the surround stays dark. */
const GENTLE = {
  growMs: 2600,
  // Soft start and a long, quiet landing – no sudden rush in the middle.
  ease: [0.55, 0, 0.35, 1] as const,
  /** Opacity of the fine light edge around the window at its start. */
  rim: 0, // no frame around the W while it zooms (Eric, 19.11.2026)
};
