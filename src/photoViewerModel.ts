export type ViewerState = {
  target: number;
  visible: number | null;
  image?: HTMLImageElement;
  status: "loading" | "ready" | "error";
};
export type ImageRequest = {
  ready: Promise<void>;
  cancel: () => void;
  image?: HTMLImageElement;
};
type Entry = {
  request: ImageRequest;
  ready: Promise<boolean>;
  status: ViewerState["status"];
};

export function viewerIndex(index: number, length: number) {
  return length ? ((index % length) + length) % length : 0;
}

/** One session owns only its target and direct neighbors, deduplicated by source. */
export class PhotoViewerModel {
  state: ViewerState;
  private cache = new Map<string, Entry>();
  private generation = 0;
  private disposed = false;

  private urls: string[];
  private load: (url: string) => ImageRequest;
  private changed: (state: ViewerState) => void;

  constructor(
    urls: string[],
    initial: number,
    load: (url: string) => ImageRequest,
    changed: (state: ViewerState) => void,
  ) {
    this.urls = urls;
    this.load = load;
    this.changed = changed;
    this.state = {
      target: viewerIndex(initial, urls.length),
      visible: null,
      status: "loading",
    };
  }

  private neighborhood() {
    return [
      ...new Set(
        [-1, 0, 1].map(
          (offset) =>
            this.urls[
              viewerIndex(this.state.target + offset, this.urls.length)
            ],
        ),
      ),
    ];
  }

  private entry(url: string) {
    const existing = this.cache.get(url);
    if (existing) return existing;
    const request = this.load(url);
    const entry: Entry = {
      request,
      status: "loading",
      ready: Promise.resolve(false),
    };
    entry.ready = request.ready.then(
      () => {
        entry.status = "ready";
        return true;
      },
      () => {
        entry.status = "error";
        return false;
      },
    );
    this.cache.set(url, entry);
    return entry;
  }

  select(index: number, retry = false) {
    if (this.disposed || !this.urls.length) return;
    const generation = ++this.generation;
    const target = viewerIndex(index, this.urls.length);
    this.state = { ...this.state, target, status: "loading" };
    const allowed = this.neighborhood();
    for (const [url, entry] of this.cache) {
      if (!allowed.includes(url) || (retry && url === this.urls[target])) {
        entry.request.cancel();
        this.cache.delete(url);
      }
    }
    this.changed(this.state);
    const entry = this.entry(this.urls[target]);
    void entry.ready.then((success) => {
      if (this.disposed || generation !== this.generation) return;
      this.state = {
        target,
        visible: success ? target : this.state.visible,
        status: success ? "ready" : "error",
        ...(success
          ? entry.request.image && { image: entry.request.image }
          : this.state.image && { image: this.state.image }),
      };
      this.changed(this.state);
      // Start neighbors only after the requested photograph is decoded.
      if (success) for (const url of this.neighborhood()) this.entry(url);
    });
  }

  move(direction: number) {
    this.select(this.state.target + direction);
  }

  retry() {
    this.select(this.state.target, true);
  }

  dispose() {
    this.disposed = true;
    ++this.generation;
    for (const entry of this.cache.values()) entry.request.cancel();
    this.cache.clear();
    this.state = { ...this.state, image: undefined };
  }
}

/** Resolve only after decode; cancellation also releases pending event handlers. */
export function decodedImageRequest(url: string): ImageRequest {
  const image = new Image();
  let active = true;
  let decoded = false;
  let rejectReady: (error: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    image.onload = async () => {
      image.onload = image.onerror = null;
      try {
        if (typeof image.decode === "function") await image.decode();
        if (active) {
          decoded = true;
          resolve();
        }
      } catch {
        if (active) reject(new Error("Image decode failed"));
      }
    };
    image.onerror = () => {
      image.onload = image.onerror = null;
      if (active) reject(new Error("Image load failed"));
    };
    image.src = url;
  });
  return {
    ready,
    image,
    cancel: () => {
      active = false;
      image.onload = image.onerror = null;
      // Completed nodes may still be displayed after eviction from the cache.
      if (!decoded) image.removeAttribute("src");
      rejectReady(new Error("Image request cancelled"));
    },
  };
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Transform that lays the resting rectangle `to` exactly over `from` (centres
 * aligned, uniform scale). `clip` is the vertical inset, in `to` units, that
 * hides the part of `to` the smaller, differently cropped `from` never showed.
 */
export function focusFlip(from: Rect, to: Rect) {
  // Cover the origin box with one uniform scale (never distorts); whatever
  // overhangs on one axis is cut away with an inset on that axis.
  const byWidth = to.width > 0 ? from.width / to.width : 1;
  const byHeight = to.height > 0 ? from.height / to.height : 1;
  const scale = Math.max(byWidth, byHeight);
  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  const visibleH = scale > 0 ? from.height / scale : to.height;
  const visibleW = scale > 0 ? from.width / scale : to.width;
  return {
    x,
    y,
    scale,
    clip: Math.max(0, (to.height - visibleH) / 2),
    clipX: Math.max(0, (to.width - visibleW) / 2),
  };
}

/** Keep the outgoing neighbour mounted long enough to glide and fade out, even in a pair. */
export function focusOffsets(count: number) {
  return count <= 1 ? [0] : [-2, -1, 0, 1, 2];
}

export interface ViewerWheel {
  time: number;
  /** Accumulated vertical travel of the current burst. */
  total: number;
}

export const viewerCloseDistance = 60;

/**
 * Vertical wheel travel closes the focus view once it adds up past the
 * threshold. Horizontal gestures never count; a pause starts a new tally.
 */
export function viewerWheel(
  previous: ViewerWheel,
  time: number,
  dx: number,
  dy: number,
  threshold = viewerCloseDistance,
) {
  const fresh = time - previous.time > 220;
  let total = fresh ? 0 : previous.total;
  if (Math.abs(dy) > Math.abs(dx)) total += Math.abs(dy);
  return { state: { time, total }, close: total > threshold };
}

export type ViewerStepGesture = {
  last: number;
  stepAt: number;
  distance: number;
  locked: boolean;
};
export const viewerStepIdle: ViewerStepGesture = { last: -Infinity, stepAt: -Infinity, distance: 0, locked: false };
export const viewerStepQuiet = 180;
export const viewerStepCooldown = 450;
export const viewerStepThreshold = 32;

/**
 * Exactly one photograph per wheel/trackpad gesture. After a step the gesture is
 * locked until the wheel events have been quiet for `viewerStepQuiet` ms, so the
 * momentum tail never steps again; a step is also never taken within
 * `viewerStepCooldown` ms of the previous one (the transition).
 */
export function viewerStepWheel(previous: ViewerStepGesture, time: number, dx: number, dy: number) {
  const fresh = time - previous.last > viewerStepQuiet || time < previous.last;
  const state: ViewerStepGesture = fresh
    ? { last: time, stepAt: previous.stepAt, distance: 0, locked: false }
    : { ...previous, last: time };
  if (state.locked || Math.abs(dx) <= Math.abs(dy) * 1.2 || Math.abs(dx) < 1)
    return { state, direction: 0 };
  state.distance += dx;
  if (Math.abs(state.distance) < viewerStepThreshold || time - state.stepAt < viewerStepCooldown)
    return { state, direction: 0 };
  state.locked = true;
  state.stepAt = time;
  return { state, direction: Math.sign(state.distance) };
}

/** Touch travel: a clear vertical drag closes, a clear horizontal one steps. */
export function viewerTouch(dx: number, dy: number) {
  const close =
    Math.abs(dy) > viewerCloseDistance && Math.abs(dy) > Math.abs(dx) * 1.3;
  const step =
    !close && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3
      ? dx < 0
        ? 1
        : -1
      : 0;
  return { close, step };
}

/**
 * Finger-follow offset for a horizontal swipe. A looping band follows the
 * finger 1:1 up to `limit`, then with growing resistance; without a neighbour
 * (single photograph) it pulls like a rubber band and never leaves ~1/3 of
 * `limit`.
 */
export function viewerDrag(dx: number, limit: number, loops: boolean) {
  const sign = dx < 0 ? -1 : 1;
  const x = Math.abs(dx);
  if (!loops) return sign * limit * 0.35 * (1 - Math.exp(-x / limit));
  if (x <= limit) return dx;
  return sign * (limit + limit * 0.25 * (1 - Math.exp(-(x - limit) / limit)));
}

export const viewerZoomMax = 3;
/** Double tap / double click lands here, leaving room to pinch further. */
export const viewerDoubleTapScale = 2.5;

/** Scale about the centre of the photograph plus a pan in px (applied as translate, then scale). */
export type ViewerZoom = { scale: number; x: number; y: number };
export const viewerZoomIdle: ViewerZoom = { scale: 1, x: 0, y: 0 };
type Size = { width: number; height: number };
type Point = { x: number; y: number };

export const viewerIsZoomed = (zoom: ViewerZoom) => zoom.scale > 1.001;

/**
 * Furthest pan per axis: the enlarged photograph may move until its edge meets
 * the edge of the stage, and stays centred while it is still smaller than it.
 */
export function viewerZoomBounds(scale: number, media: Size, stage: Size): Point {
  return {
    x: Math.max(0, (media.width * scale - stage.width) / 2),
    y: Math.max(0, (media.height * scale - stage.height) / 2),
  };
}

export function viewerClampZoom(zoom: ViewerZoom, media: Size, stage: Size): ViewerZoom {
  const scale = Math.min(viewerZoomMax, Math.max(1, Number.isFinite(zoom.scale) ? zoom.scale : 1));
  if (scale <= 1.001) return viewerZoomIdle;
  const bounds = viewerZoomBounds(scale, media, stage);
  return {
    scale,
    x: Math.min(bounds.x, Math.max(-bounds.x, zoom.x)),
    y: Math.min(bounds.y, Math.max(-bounds.y, zoom.y)),
  };
}

/**
 * Change the scale and keep the content under `focal` (relative to the centre
 * of the photograph's resting box) where it is.
 */
export function viewerZoomAt(
  zoom: ViewerZoom,
  focal: Point,
  scale: number,
  media: Size,
  stage: Size,
): ViewerZoom {
  const next = Math.min(viewerZoomMax, Math.max(1, scale));
  const contentX = (focal.x - zoom.x) / zoom.scale;
  const contentY = (focal.y - zoom.y) / zoom.scale;
  return viewerClampZoom(
    { scale: next, x: focal.x - next * contentX, y: focal.y - next * contentY },
    media,
    stage,
  );
}

/** Two fingers: scale by the change of their distance, follow their midpoint. */
export function viewerPinch(
  start: { zoom: ViewerZoom; distance: number; mid: Point },
  mid: Point,
  distance: number,
  media: Size,
  stage: Size,
): ViewerZoom {
  const ratio = start.distance > 0 ? distance / start.distance : 1;
  const scale = Math.min(viewerZoomMax, Math.max(1, start.zoom.scale * ratio));
  const contentX = (start.mid.x - start.zoom.x) / start.zoom.scale;
  const contentY = (start.mid.y - start.zoom.y) / start.zoom.scale;
  return viewerClampZoom(
    { scale, x: mid.x - scale * contentX, y: mid.y - scale * contentY },
    media,
    stage,
  );
}

/** One finger or the mouse on an enlarged photograph moves it instead of paging. */
export function viewerPan(start: ViewerZoom, dx: number, dy: number, media: Size, stage: Size) {
  return viewerClampZoom({ scale: start.scale, x: start.x + dx, y: start.y + dy }, media, stage);
}

/** Double tap / double click: back to 1×, or in to `viewerDoubleTapScale` at the tapped point. */
export function viewerToggleZoom(zoom: ViewerZoom, focal: Point, media: Size, stage: Size) {
  return viewerIsZoomed(zoom)
    ? viewerZoomIdle
    : viewerZoomAt(zoom, focal, viewerDoubleTapScale, media, stage);
}

/** Ctrl + wheel (trackpad pinch): smooth, exponential in the wheel travel. */
export function viewerWheelZoom(zoom: ViewerZoom, deltaY: number, focal: Point, media: Size, stage: Size) {
  const limited = Math.max(-60, Math.min(60, deltaY));
  return viewerZoomAt(zoom, focal, zoom.scale * Math.exp(-limited * 0.01), media, stage);
}

export const viewerTapDistance = 10;
export const viewerTapDuration = 260;
export const viewerDoubleTapInterval = 320;
export const viewerDoubleTapDistance = 32;

/** A tap is a short touch that hardly moved. */
export function viewerIsTap(dx: number, dy: number, duration: number) {
  return Math.hypot(dx, dy) <= viewerTapDistance && duration <= viewerTapDuration;
}

/** Two taps close in time and place. */
export function viewerIsDoubleTap(previous: { time: number; x: number; y: number } | null, tap: { time: number; x: number; y: number }) {
  return (
    !!previous &&
    tap.time - previous.time <= viewerDoubleTapInterval &&
    tap.time >= previous.time &&
    Math.hypot(tap.x - previous.x, tap.y - previous.y) <= viewerDoubleTapDistance
  );
}

/** Parse rgb()/rgba()/#hex; null for transparent or unknown values. */
export function parseColor(css: string) {
  const text = css.trim().toLowerCase();
  let r = 0,
    g = 0,
    b = 0,
    a = 1;
  const rgb = text.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
    [r, g, b] = parts;
    if (parts.length > 3 && !Number.isNaN(parts[3])) a = parts[3];
  } else {
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (!hex) return null;
    const full =
      hex[1].length === 3
        ? hex[1].replace(/./g, (c) => c + c)
        : hex[1];
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  }
  return a < 0.05 ? null : { r, g, b, a };
}

/** Relative luminance below the midpoint reads as a dark edition surface. */
export function colorIsDark(css: string) {
  const color = parseColor(css);
  if (!color) return null;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(color.r) + 0.7152 * lin(color.g) + 0.0722 * lin(color.b) < 0.18;
}
