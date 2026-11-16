import test from "node:test";
import assert from "node:assert/strict";
import { rewriteForStatic, staticDataPath, staticMediaName, withBase } from "../src/staticSite.ts";

test("API paths map to stable file names; only lang matters", () => {
  assert.equal(staticDataPath("/journeys?public=1"), "journeys.json");
  assert.equal(staticDataPath("/journeys/schweiz-winter?public=1"), "journeys/schweiz-winter.json");
  assert.equal(staticDataPath("/journeys/schweiz-winter"), "journeys/schweiz-winter.json");
  assert.equal(staticDataPath("/showcase/quiet-atlas?lang=de"), "showcase/quiet-atlas.de.json");
  assert.equal(staticDataPath("/templates/after-hours/example?lang=en"), "templates/after-hours/example.en.json");
  assert.equal(staticDataPath("/site/hero"), "site/hero.json");
  assert.equal(staticDataPath("/auth"), "auth.json");
});

test("odd slugs stay inside their folder", () => {
  assert.equal(staticDataPath("/journeys/..%2Fsecret"), "journeys/.._secret.json");
});

test("media URLs become static WebP files at full sharpness; originals are not exported", () => {
  const seen: string[] = [];
  const out = rewriteForStatic(
    {
      url: "/media/7/1280",
      large_url: "/media/7/3840",
      original_url: "/media/7/master",
      srcset: "/media/7/640 640w, /media/7/1280 1280w, /media/7/2200 2200w, /media/7/3840 3840w",
      nested: [{ url: "/images/ch-see-1280.webp", note: "keep /media in prose? /mediathek" }],
    },
    "/WANDER/",
    (id, size) => seen.push(`${id}/${size}`),
  );
  assert.equal(out.url, "/WANDER/static/media/7-1280.webp");
  assert.equal(out.large_url, "/WANDER/static/media/7-3840.webp");
  assert.equal(out.original_url, "/WANDER/static/media/7-3840.webp");
  assert.equal(
    out.srcset,
    "/WANDER/static/media/7-640.webp 640w, /WANDER/static/media/7-1280.webp 1280w, /WANDER/static/media/7-2200.webp 2200w, /WANDER/static/media/7-3840.webp 3840w",
  );
  assert.equal(out.nested[0].url, "/WANDER/images/ch-see-1280.webp");
  assert.equal(out.nested[0].note, "keep /media in prose? /mediathek");
  assert.deepEqual([...new Set(seen)].sort(), ["7/1280", "7/2200", "7/3840", "7/640"]);
  assert.ok(!seen.includes("7/master"));
});

test("demo srcsets with /images get the base too", () => {
  const out = rewriteForStatic({ srcset: "/images/a-640.webp 640w, /images/a-1280.webp 1280w" }, "/WANDER/", () => {});
  assert.equal(out.srcset, "/WANDER/images/a-640.webp 640w, /WANDER/images/a-1280.webp 1280w");
});

test("withBase prefixes root paths only", () => {
  assert.equal(withBase("/images/x.webp", "/WANDER/"), "/WANDER/images/x.webp");
  assert.equal(withBase("/images/x.webp", "/"), "/images/x.webp");
  assert.equal(withBase("https://example.org/x", "/WANDER/"), "https://example.org/x");
  assert.equal(staticMediaName("3", "2200"), "3-2200.webp");
});
