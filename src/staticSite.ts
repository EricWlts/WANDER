/**
 * Static showcase build (GitHub Pages): the public pages read pre-exported JSON files
 * instead of the Flask API. Pure helpers shared by the app (src/api.ts) and the
 * exporter (scripts/export-pages.ts).
 */

/** Read-only static build? Set at build time with VITE_STATIC=1. */
export const STATIC_SITE: boolean =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_STATIC ?? "") === "1";

/** The site's base path, always ending in "/" ("/" locally, "/WANDER/" on GitHub Pages). */
export const BASE_URL: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.BASE_URL ?? "/";

/** Prefix a root-relative public path ("/images/x.webp") with the site's base path. */
export function withBase(path: string, base: string = BASE_URL): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return base.replace(/\/+$/, "") + path;
}

/**
 * File for an API GET path, relative to the exported "static/" folder.
 * Only `lang` changes a response for the public pages; `public=1` and others are dropped.
 *   /journeys?public=1           → journeys.json
 *   /journeys/schweiz?public=1   → journeys/schweiz.json
 *   /showcase/quiet-atlas?lang=de → showcase/quiet-atlas.de.json
 */
export function staticDataPath(apiPath: string): string {
  const url = new URL(apiPath, "http://wander.local");
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((s) => decodeURIComponent(s).replace(/[^A-Za-z0-9._-]/g, "_"));
  const name = segments.join("/") || "index";
  const lang = url.searchParams.get("lang");
  return `${name}${lang === "de" || lang === "en" ? `.${lang}` : ""}.json`;
}

/** Media file name for a backend media URL ("/media/12/3840" → "12-3840.webp"). */
export function staticMediaName(id: string, size: string): string {
  return `${id}-${size}.webp`;
}

const MEDIA = /\/media\/(\d+)\/(640|1280|2200|3840|master)\b/g;

/**
 * Rewrite every URL in an API response for the static site:
 * - "/media/<id>/<size>" → "<base>static/media/<id>-<size>.webp" (originals are never exported:
 *   "master" becomes the sharpest variant, 3840)
 * - "/images/…", "/assets/…" → "<base>images/…" etc.
 * Calls `onMedia(id, size)` for every media file the response needs.
 */
export function rewriteForStatic<T>(value: T, base: string, onMedia: (id: string, size: string) => void): T {
  const rewrite = (text: string): string => {
    let out = text.replace(MEDIA, (_m, id: string, size: string) => {
      const real = size === "master" ? "3840" : size;
      onMedia(id, real);
      return `${base}static/media/${staticMediaName(id, real)}`;
    });
    out = out.replace(/(^|[\s,])\/(images|assets)\//g, (_m, lead: string, dir: string) => `${lead}${base}${dir}/`);
    return out;
  };
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return rewrite(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, walk(v)]));
    }
    return node;
  };
  return walk(value) as T;
}
