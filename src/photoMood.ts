/**
 * "Nach Stimmung": the light arc of a story.
 *
 * Pure part (no DOM, no I/O, no randomness): lightFromPixels(), moodArc(),
 * splitMovements(). The same input always yields the same output.
 * Browser part (bottom of the file): reads brightness, warmth and saturation
 * from the smallest image variant via a 16 × 16 canvas, cached per URL.
 */

export interface PhotoLight {
  /** Perceived brightness, 0 (black) … 1 (white). */
  brightness: number;
  /** Colour temperature, -1 (cool, blue) … 1 (warm, red/orange). */
  warmth: number;
  /** Mean saturation, 0 (grey) … 1 (vivid). */
  saturation: number;
  /** Mean colour as CSS rgb(), used as placeholder while the photograph loads. */
  color: string;
}

export interface ArcItem {
  id: number;
  position: number;
  light?: PhotoLight | null;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function usable(light: PhotoLight | null | undefined): light is PhotoLight {
  return (
    !!light &&
    Number.isFinite(light.brightness) &&
    Number.isFinite(light.warmth) &&
    Number.isFinite(light.saturation)
  );
}

/** Mean light of RGBA pixel data (e.g. a 16 × 16 canvas). Null when nothing is visible. */
export function lightFromPixels(data: ArrayLike<number>): PhotoLight | null {
  let r = 0, g = 0, b = 0, s = 0, n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 8) continue; // transparent
    const R = data[i], G = data[i + 1], B = data[i + 2];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    r += R; g += G; b += B; s += max === 0 ? 0 : (max - min) / max; n++;
  }
  if (!n) return null;
  r /= n; g /= n; b /= n;
  return {
    brightness: clamp((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, 0, 1),
    warmth: clamp((r - b) / 255, -1, 1),
    saturation: clamp(s / n, 0, 1),
    color: `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`,
  };
}

/** Place on the arc: 0 = bright and cool (first light) … 1 = dark and warm (last light). */
export function arcKey(light: PhotoLight): number {
  return 0.6 * (1 - clamp(light.brightness, 0, 1)) + 0.4 * ((clamp(light.warmth, -1, 1) + 1) / 2);
}

/** Visual distance of two photographs (brightness and warmth weigh most). */
export function lightDistance(a: PhotoLight, b: PhotoLight): number {
  const db = a.brightness - b.brightness,
    dw = (a.warmth - b.warmth) / 2,
    ds = (a.saturation - b.saturation) * 0.5;
  return Math.sqrt(db * db + dw * dw + ds * ds);
}

const byUpload = (a: ArcItem, b: ArcItem) => a.position - b.position || a.id - b.id;

/** How many candidates ahead on the arc may be pulled forward to avoid a hard jump. */
const LOOKAHEAD = 3;

/**
 * Orders photographs as a light arc: from bright and cool to dark and warm.
 * Walks the arc and, among the next few candidates, always takes the one closest
 * to the current photograph, so similar pictures stand together. Photographs
 * without values keep their place next to the photograph they followed in the
 * upload order. Without any values the upload order is returned unchanged.
 */
export function moodArc<T extends ArcItem>(items: readonly T[]): T[] {
  const seen = new Set<number>();
  const upload = items
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort(byUpload);
  const measured = upload.filter((p) => usable(p.light));
  if (!measured.length) return upload;

  const key = new Map(measured.map((p) => [p.id, arcKey(p.light!)]));
  const queue = measured
    .slice()
    .sort((a, b) => key.get(a.id)! - key.get(b.id)! || byUpload(a, b));
  const arc: T[] = [queue.shift()!];
  while (queue.length) {
    const current = arc[arc.length - 1].light!;
    let best = 0,
      bestDistance = Infinity;
    for (let i = 0; i < Math.min(LOOKAHEAD, queue.length); i++) {
      const d = lightDistance(current, queue[i].light!);
      if (d < bestDistance - 1e-9) {
        best = i;
        bestDistance = d;
      }
    }
    arc.push(queue.splice(best, 1)[0]);
  }

  // Unmeasured photographs follow the measured one they followed when uploaded.
  const lead: T[] = [];
  const after = new Map<number, T[]>();
  let anchor: number | null = null;
  for (const p of upload) {
    if (usable(p.light)) anchor = p.id;
    else if (anchor === null) lead.push(p);
    else after.set(anchor, [...(after.get(anchor) || []), p]);
  }
  return [...lead, ...arc.flatMap((p) => [p, ...(after.get(p.id) || [])])];
}

/** Number of movements ("Sätze") for a number of photographs: one for very few, then two to four. */
export function movementCount(n: number): number {
  if (n < 6) return 1;
  if (n < 12) return 2;
  if (n < 24) return 3;
  return 4;
}

const MIN_MOVEMENT = 3;

/**
 * Splits an ordered arc into movements. Each cut sits near an even split, at the
 * biggest change of light nearby; every movement keeps at least three photographs.
 */
export function splitMovements<T extends ArcItem>(ordered: readonly T[]): T[][] {
  const n = ordered.length,
    k = movementCount(n);
  if (k <= 1) return n ? [ordered.slice()] : [];
  // jump[i]: change of light between photograph i-1 and i (0 when a value is missing).
  const jump = ordered.map((p, i) => {
    const prev = ordered[i - 1];
    return i > 0 && usable(p.light) && usable(prev?.light) ? lightDistance(prev.light, p.light) : 0;
  });
  const reach = Math.max(1, Math.floor(n / (2 * k)) - 1);
  const cuts: number[] = [];
  let lower = MIN_MOVEMENT;
  for (let j = 1; j < k; j++) {
    const ideal = Math.round((j * n) / k);
    const upper = n - MIN_MOVEMENT * (k - j);
    let best = -1;
    for (let i = Math.max(lower, ideal - reach); i <= Math.min(upper, ideal + reach); i++) {
      if (
        best < 0 ||
        jump[i] > jump[best] + 1e-9 ||
        (Math.abs(jump[i] - jump[best]) <= 1e-9 && Math.abs(i - ideal) < Math.abs(best - ideal))
      )
        best = i;
    }
    if (best < 0) best = clamp(ideal, lower, upper);
    cuts.push(best);
    lower = best + MIN_MOVEMENT;
  }
  const out: T[][] = [];
  let start = 0;
  for (const cut of [...cuts, n]) {
    out.push(ordered.slice(start, cut));
    start = cut;
  }
  return out.filter((m) => m.length);
}

/* ------------------------------------------------------------------ */
/* Browser: reading the light of a photograph (not used by the tests). */

interface LightSource {
  url: string;
  srcset?: string | null;
}

/** URL of the smallest variant in a srcset ("… 640w, … 1280w"), else the plain URL. */
export function smallestVariant(photo: LightSource): string {
  let best = photo.url,
    width = Infinity;
  for (const part of (photo.srcset || "").split(",")) {
    const m = /^\s*(\S+)\s+(\d+)w\s*$/.exec(part);
    if (m && Number(m[2]) < width) {
      width = Number(m[2]);
      best = m[1];
    }
  }
  return best;
}

const pending = new Map<string, Promise<PhotoLight | null>>();
const settled = new Map<string, PhotoLight | null>();
const READ_TIMEOUT = 6000;
const SIDE = 16;

function readLight(src: string): Promise<PhotoLight | null> {
  const known = pending.get(src);
  if (known) return known;
  const job = new Promise<PhotoLight | null>((resolve) => {
    if (typeof document === "undefined" || typeof Image === "undefined") return resolve(null);
    const img = new Image();
    let done = false;
    const finish = (value: PhotoLight | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), READ_TIMEOUT);
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onerror = () => finish(null);
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SIDE;
        canvas.height = SIDE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return finish(null);
        ctx.drawImage(img, 0, 0, SIDE, SIDE);
        finish(lightFromPixels(ctx.getImageData(0, 0, SIDE, SIDE).data));
      } catch {
        finish(null); // e.g. a tainted canvas
      }
    };
    img.src = src;
  }).then((value) => {
    settled.set(src, value);
    return value;
  });
  pending.set(src, job);
  return job;
}

/** Light of a photograph if it was read already (null = reading failed, undefined = not yet). */
export function cachedLight(photo: LightSource): PhotoLight | null | undefined {
  return settled.get(smallestVariant(photo));
}

/** Lights of all photographs when every one was read already, else undefined. */
export function cachedLights(photos: readonly (LightSource & { id: number })[]): Record<number, PhotoLight | null> | undefined {
  const out: Record<number, PhotoLight | null> = {};
  for (const p of photos) {
    const src = smallestVariant(p);
    if (!settled.has(src)) return undefined;
    out[p.id] = settled.get(src)!;
  }
  return out;
}

/** Reads the light of every photograph (cached per URL). Failures become null. */
export async function readLights(photos: readonly (LightSource & { id: number })[]): Promise<Record<number, PhotoLight | null>> {
  const values = await Promise.all(photos.map((p) => readLight(smallestVariant(p)).catch(() => null)));
  return Object.fromEntries(photos.map((p, i) => [p.id, values[i]]));
}
