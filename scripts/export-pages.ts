/**
 * Exports the published WANDER site as static files for GitHub Pages.
 *
 *   npm run pages        (WANDER must be running: npm start)
 *
 * Reads only the PUBLIC API of the running backend (no login), so drafts and private
 * stories can never end up in the export. Writes JSON next to the built site in
 * docs/static/ and downloads every image size the pages use (640–3840 px WebP, the same
 * files WANDER serves locally; originals stay on the Mac).
 */
import { mkdir, writeFile, copyFile, rm, stat, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { rewriteForStatic, staticDataPath, staticMediaName } from "../src/staticSite.ts";

const SOURCE = (process.env.WANDER_URL || "http://127.0.0.1:5001").replace(/\/+$/, "");
const BASE = process.env.PAGES_BASE || "/WANDER/";
const OUT = process.env.PAGES_OUT || "docs";
const STATIC = join(OUT, "static");
const LANGS = ["de", "en"] as const;

type Json = Record<string, unknown>;
const media = new Set<string>();
const written: string[] = [];

async function get(path: string): Promise<unknown> {
  const response = await fetch(`${SOURCE}/api${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function save(apiPath: string, data: unknown) {
  const rewritten = rewriteForStatic(data, BASE, (id, size) => media.add(`${id}/${size}`));
  const file = join(STATIC, staticDataPath(apiPath));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(rewritten));
  written.push(file);
}

async function exportPath(apiPath: string, optional = false) {
  try {
    await save(apiPath, await get(apiPath));
  } catch (error) {
    if (!optional) throw error;
    console.warn(`  übersprungen: ${apiPath} (${(error as Error).message})`);
  }
}

async function main() {
  try {
    await stat(join(OUT, "index.html"));
  } catch {
    throw new Error(`${OUT}/index.html fehlt – erst bauen (npm run pages erledigt das).`);
  }
  await rm(STATIC, { recursive: true, force: true });
  console.log(`Exportiere aus ${SOURCE} nach ${STATIC} (Basis ${BASE}) …`);

  // Visitors are never signed in on the static site.
  await mkdir(STATIC, { recursive: true });
  await writeFile(join(STATIC, "auth.json"), JSON.stringify({ authenticated: false, csrf_token: "" }));

  const journeys = (await get("/journeys?public=1")) as Json[];
  await save("/journeys?public=1", journeys);
  for (const journey of journeys) {
    const slug = String(journey.slug);
    await exportPath(`/journeys/${encodeURIComponent(slug)}?public=1`);
  }
  await exportPath("/site/hero", true);
  for (const lang of LANGS) {
    for (const edition of ["quiet-atlas", "after-hours"]) {
      await exportPath(`/showcase/${edition}?lang=${lang}`, true);
      await exportPath(`/templates/${edition}/example?lang=${lang}`, true);
    }
  }
  await exportPath("/templates", true);

  // Every image size the pages reference, exactly as WANDER serves it.
  const mediaDir = join(STATIC, "media");
  await mkdir(mediaDir, { recursive: true });
  let done = 0;
  for (const key of media) {
    const [id, size] = key.split("/");
    const response = await fetch(`${SOURCE}/media/${id}/${size}`);
    if (!response.ok) {
      console.warn(`  Bild fehlt: /media/${id}/${size} (HTTP ${response.status})`);
      continue;
    }
    await writeFile(join(mediaDir, staticMediaName(id, size)), Buffer.from(await response.arrayBuffer()));
    done += 1;
  }

  // GitHub Pages: deep links (/WANDER/journeys/…) fall back to the app; no Jekyll processing.
  await copyFile(join(OUT, "index.html"), join(OUT, "404.html"));
  await writeFile(join(OUT, ".nojekyll"), "");
  // The app manifest uses root paths; point them at the Pages base.
  try {
    const manifestPath = join(OUT, "site.webmanifest");
    const manifest = await readFile(manifestPath, "utf8");
    await writeFile(manifestPath, manifest.replace(/"(\/[^"]*)"/g, (_m, p: string) => `"${BASE.replace(/\/+$/, "")}${p}"`));
  } catch {
    /* no manifest: nothing to adjust */
  }

  console.log(`Fertig: ${journeys.length} veröffentlichte Reisen, ${written.length} Datendateien, ${done} Bilder.`);
}

main().catch((error) => {
  console.error(`Export abgebrochen: ${(error as Error).message}`);
  console.error("Läuft WANDER? Erst `npm start`, dann `npm run pages`.");
  process.exit(1);
});
