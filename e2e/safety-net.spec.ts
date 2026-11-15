import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  { slug: "home", path: "/" },
  { slug: "archive", path: "/archive" },
  { slug: "about", path: "/about" },
  { slug: "edition-quiet-atlas", path: "/inspiration/quiet-atlas" },
  { slug: "edition-after-hours", path: "/inspiration/after-hours" },
  { slug: "journey-schweiz", path: "/journeys/schweiz-015c078e" },
  { slug: "journey-teneriffa", path: "/journeys/teneriffa-54b83fe0" },
  // Nur die Login-Seite, es wird nie angemeldet.
  { slug: "studio-login", path: "/studio" },
] as const;

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

/** Langsam bis zum Ende scrollen, bis alle Bilder geladen sind, dann nach oben. */
async function scrollThroughPage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(200, Math.round(window.innerHeight * 0.6));
    let y = 0;
    for (let i = 0; i < 400; i += 1) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (y >= max) break;
      y = Math.min(y + step, max);
      window.scrollTo(0, y);
      await sleep(120);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep(300);
  });
  // Lazy-Bilder in horizontalen Scrollern (z. B. Filmstreifen) werden nur geladen,
  // wenn sie in den Sichtbereich kommen. Kurz hineinscrollen, danach Position zurücksetzen.
  await page.evaluate(async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const saved = new Map<Element, number>();
    const pending = Array.from(document.images).filter((img) => !img.complete);
    for (const img of pending) {
      for (let el = img.parentElement; el; el = el.parentElement) {
        if (el.scrollWidth > el.clientWidth + 1 && !saved.has(el)) saved.set(el, el.scrollLeft);
      }
      img.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
      await sleep(60);
    }
    await sleep(300);
    for (const [el, left] of saved) el.scrollTo({ left, behavior: "instant" });
  });
  // Bilder, die horizontal im Sichtbereich liegen, müssen fertig geladen sein.
  // Ein Bild ohne currentSrc ist noch nicht angefordert und darf deshalb nicht als fertig gelten.
  // Karussellbilder außerhalb des Sichtbereichs dürfen weiter laden.
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll('[data-image-status="loading"]')).some((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right > 0 && rect.left < window.innerWidth;
      }),
    undefined,
    { timeout: 45_000 },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("wander-motion", "off");
    } catch {
      /* ignorieren */
    }
  });
});

for (const { slug, path } of PAGES) {
  for (const viewport of VIEWPORTS) {
    test(`${slug} @ ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(`console: ${msg.text()}`);
      });
      page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

      await page.setViewportSize(viewport);
      await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle").catch(() => undefined);

      // a) scrollen
      await scrollThroughPage(page);

      // b) Screenshot
      await expect.soft(page).toHaveScreenshot(`${slug}-${viewport.width}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      });

      // c) kein horizontaler Overflow
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect
        .soft(overflow.scrollWidth, `Horizontaler Overflow (clientWidth ${overflow.clientWidth})`)
        .toBeLessThanOrEqual(overflow.clientWidth);

      // d) keine Konsolenfehler
      expect.soft(consoleErrors, "Fehler in der Konsole").toEqual([]);

      // e) axe: nur als Anhang melden (Baseline), nicht failen
      const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      // Ergebnis für scripts/axe-summary.mjs: je Verstoß id, Schwere und Knotenzahl.
      const axeDir = nodePath.join(process.cwd(), "test-results", "axe");
      mkdirSync(axeDir, { recursive: true });
      writeFileSync(
        nodePath.join(axeDir, `${slug}-${viewport.width}.json`),
        JSON.stringify(
          axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
          null,
          2,
        ),
      );
      await testInfo.attach("axe-violations", {
        body: JSON.stringify(
          axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          })),
          null,
          2,
        ),
        contentType: "application/json",
      });
    });
  }
}
