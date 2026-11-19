import { BASE_URL } from "./staticSite";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { t, useLocale } from "./I18n";
import { api } from "./api";
import { pickShots, type StoryPhoto } from "./homeStoryModel";
import type { Chapter, Journey, Photo } from "./types";
import { JournalCanvas } from "./JournalCanvas";
import { useMotionOff } from "./Motion";
import { isMotionOff } from "./motionState";
import { contactSheet, countWord, flightOf, sheetGrid, type Box } from "./homeLightTable";
import "./home-editions.css";

/* G4: two home blocks that turn the promise into something to see.
   A – "Verwandlung": eight prints of the real example journey lie loose on a dark light table; the reader's click
   sends them towards the journey, which then fades in as the real page (First light, the components of
   /inspiration/quiet-atlas) in a small, quietly scrolling window.
   B – MoodSwitch: one motif, set in both editions, switched by the reader. */

type Shot = { src: string; alt: () => string };
const img = (name: string, size = 640) => `${BASE_URL}images/${name}-${size}.webp`;
const shot = (name: string, en: string, de: string): Shot => ({ src: name, alt: () => t(en, de) });

const SHOTS = {
  steg: shot("ch-steg", "Wooden jetty in a calm lake", "Holzsteg in einem ruhigen See"),
  kanal: shot("ch-kanal", "Road along a canal, mountains on the horizon", "Straße am Kanal, Berge am Horizont"),
  abendrot: shot("ch-abendrot", "Afterglow over snowy mountains", "Abendrot über verschneiten Bergen"),
  steinmann: shot("ch-steinmann", "Stone cairn by a mountain stream", "Steinmann am Gebirgsbach"),
  chalet: shot("ch-chalet", "Wooden chalet in the snow, backlit", "Holzchalet im Schnee, im Gegenlicht"),
  see: shot("ch-see", "Still lake below hazy mountains", "Stiller See vor Bergen im Dunst"),
  panorama: shot("ch-panorama", "Wide panorama of snowy peaks", "Weites Panorama verschneiter Gipfel"),
  bruecke: shot("ch-bruecke", "Suspension bridge between snowy ridges", "Hängebrücke zwischen verschneiten Graten"),
  klippe: shot("tf-klippe", "A man on a cliff above the sea", "Ein Mann auf einer Klippe über dem Meer"),
};

// The story is the real example journey in First light (/templates/quiet-atlas/example, in the static build the
// exported JSON file) – the same data as /inspiration/quiet-atlas. The built-in copy below only stands in while it
// loads or when it cannot be reached.
const STORY_PATH = (lang: string) => `/templates/quiet-atlas/example?lang=${lang}`;

function fallbackJourney(): Journey {
  const placed = (item: Shot, id: number, chapter: number | null, position: number): Photo => ({
    id,
    chapter_id: chapter,
    position,
    title: item.alt(),
    alt: item.alt(),
    description: "",
    width: 1280,
    height: 853,
    featured: position === 0,
    demo: true,
    credit: "",
    source_url: "",
    original_url: null,
    url: img(item.src, 1280),
    large_url: img(item.src, 1280),
    srcset: `${img(item.src)} 640w, ${img(item.src, 1280)} 1280w`,
  });
  const chapter = (id: number, position: number, date: string, title: string, story: string): Chapter => ({
    id,
    kind: "chapter",
    position,
    date,
    title,
    story,
    quote: "",
    gallery_mode: "editorial",
    reveal: { effect: "up", duration: 2000 },
  });
  const photos = [
    placed(SHOTS.panorama, 1, null, 0),
    placed(SHOTS.chalet, 2, 11, 0),
    placed(SHOTS.steinmann, 3, 11, 1),
    placed(SHOTS.abendrot, 4, 11, 2),
    placed(SHOTS.steg, 5, 12, 0),
    placed(SHOTS.see, 6, 12, 1),
    placed(SHOTS.kanal, 7, 12, 2),
    placed(SHOTS.bruecke, 8, 13, 0),
  ];
  return {
    id: -1,
    slug: "quiet-atlas",
    is_example: true,
    story_template: "quiet-atlas",
    studio_step: 4,
    filmstrip_ids: [],
    reveal_settings: { default: { effect: "up", duration: 2000 }, images: { effect: "fade", duration: 2400 } },
    title: t("Between snow and stillness", "Zwischen Schnee und Stille"),
    subtitle: t("Over the turn of the year in the Bernese Oberland.", "Zum Jahreswechsel im Berner Oberland."),
    location: t("Bernese Oberland", "Berner Oberland"),
    country: t("Switzerland", "Schweiz"),
    start_date: "2024-12-27",
    end_date: "2025-01-01",
    description: "",
    introduction: "",
    reflection: "",
    closing: "",
    preset: "quiet",
    published: true,
    demo: true,
    cover_id: 1,
    cover: photos[0],
    photo_count: photos.length,
    chapter_count: 3,
    photos,
    chapters: [
      chapter(
        11,
        0,
        "2024-12-27",
        t("Arriving in snow", "Ankommen im Schnee"),
        t(
          "The wooden chalet stands against the light. We unpack without hurrying. In the evening the peaks turn red, and we stay outside longer than the cold allows.",
          "Das Holzchalet steht im Gegenlicht. Wir packen aus, ohne uns zu beeilen. Am Abend färben sich die Gipfel rot, und wir stehen länger draußen, als die Kälte es erlaubt.",
        ),
      ),
      chapter(
        12,
        1,
        "2024-12-29",
        t("Still water", "Stilles Wasser"),
        t(
          "By the lake the haze settles between the mountains. A rusty jetty reaches a little way out and ends in the water.",
          "Am See liegt der Dunst zwischen den Bergen. Ein rostiger Steg führt ein Stück hinaus und endet im Wasser.",
        ),
      ),
      chapter(
        13,
        2,
        "2025-01-01",
        t("The first light of the year", "Das erste Licht des Jahres"),
        t(
          "On New Year's Day we climb. A suspension bridge spans two snowy summits, and above it the whole panorama opens up.",
          "Am Neujahrstag gehen wir hinauf. Eine Hängebrücke spannt sich zwischen zwei verschneiten Gipfeln, und darüber öffnet sich das ganze Panorama.",
        ),
      ),
    ],
  };
}

type Print = { photo: StoryPhoto; tilt: number; dx: number; dy: number };

/* The real journey in a small window. The page is rendered by the real components (JournalCanvas, as on
   /inspiration/quiet-atlas) into a same-origin iframe of a fixed virtual width (1280 px, 390 px on a phone), so
   its media queries, vh units and styles behave exactly like on a real screen; the frame is scaled down to the
   space that is left (the same technique as the editor preview). The visitor can scroll it (wheel, touch, keys, rail) while links and
   enlarging pictures do nothing; reveals and parallax are off, and the page glides slowly down by itself until
   touched – unless motion is off. */
const VIRTUAL_WIDE = 1280;
const VIRTUAL_PHONE = 390;
const GLIDE_DELAY = 10000;
const GLIDE_SPEED = 46; // virtual px per second
const GLIDE_RAMP = 1800;
const GLIDE_RESUME = 10000; // quiet time after the visitor's last touch before the glide carries on

function JourneyPreview({ journey, active }: { journey: Journey; active: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [near, setNear] = useState(false);
  const [touched, setTouched] = useState(false);
  const { locale } = useLocale();
  const motionOff = useMotionOff();
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    // The window only loads once the block is near the screen.
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: "600px 0px" },
    );
    watch.observe(el);
    return () => {
      resize.disconnect();
      watch.disconnect();
    };
  }, []);
  // The frame keeps the styles of the page (also while Vite swaps them), and never moves.
  useEffect(() => {
    if (!body) return;
    const doc = body.ownerDocument;
    const sync = () => {
      doc.head.innerHTML = "";
      document.querySelectorAll('style,link[rel="stylesheet"]').forEach((node) => doc.head.appendChild(node.cloneNode(true)));
    };
    const watch = new MutationObserver(sync);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [body]);
  useEffect(() => {
    if (!body) return;
    const root = body.ownerDocument.documentElement;
    root.lang = locale;
    root.dataset.motion = "off";
  }, [body, locale]);
  // The page glides through all of its photographs: load them up front instead of when they scroll into view.
  useEffect(() => {
    if (!body) return;
    const eager = () => body.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((image) => (image.loading = "eager"));
    eager();
    const watch = new MutationObserver(eager);
    watch.observe(body, { childList: true, subtree: true });
    const id = window.setTimeout(() => watch.disconnect(), 5000);
    return () => {
      window.clearTimeout(id);
      watch.disconnect();
    };
  }, [body]);
  // A slow glide down the page once the preview is on stage; back to the top when the table is reset. The visitor can
  // scroll the journey themselves: any wheel, touch, pointer, key or focus event inside the frame stops the glide,
  // and after a quiet spell it carries on from wherever the page is (and stops at the end).
  useEffect(() => {
    const doc = body?.ownerDocument;
    const scroller = doc?.scrollingElement;
    if (!doc || !scroller) return;
    if (!active) {
      scroller.scrollTop = 0;
      setTouched(false);
      return;
    }
    const gliding = !(motionOff || isMotionOff());
    let frame = 0;
    let startTimer = 0;
    let resumeTimer = 0;
    let started = 0;
    let last = 0;
    let position = 0;
    const stop = () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(resumeTimer);
      cancelAnimationFrame(frame);
      frame = 0;
      started = 0;
    };
    function interact() {
      stop();
      setTouched(true);
      if (gliding) resumeTimer = window.setTimeout(run, GLIDE_RESUME);
    }
    const step = (now: number) => {
      // Somebody else moved the page (scroll bar, a wheel we did not see): hand over to them.
      if (Math.abs(scroller.scrollTop - position) > 2) {
        interact();
        return;
      }
      if (!started) {
        started = now;
        last = now;
      }
      const elapsed = now - started;
      const dt = Math.min(64, now - last);
      last = now;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ramp = Math.min(1, elapsed / GLIDE_RAMP);
      position = Math.min(max, position + (GLIDE_SPEED * ramp * ramp * (3 - 2 * ramp) * dt) / 1000);
      scroller.scrollTop = position;
      frame = position < max ? requestAnimationFrame(step) : 0;
    };
    function run() {
      position = scroller!.scrollTop;
      started = 0;
      frame = requestAnimationFrame(step);
    }
    // Links lead nowhere from the preview and pictures do not open; the carousel controls (buttons) keep working.
    const guard = (event: Event) => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("a")) {
        event.preventDefault();
        event.stopPropagation();
      } else if (target.closest("img, picture") && !target.closest("button")) {
        event.stopPropagation();
      }
    };
    const events = ["wheel", "touchstart", "pointerdown", "keydown", "focusin"] as const;
    events.forEach((name) => doc.addEventListener(name, interact, { passive: true, capture: true }));
    doc.addEventListener("click", guard, true);
    if (gliding) startTimer = window.setTimeout(run, GLIDE_DELAY);
    return () => {
      stop();
      events.forEach((name) => doc.removeEventListener(name, interact, true));
      doc.removeEventListener("click", guard, true);
    };
  }, [active, body, motionOff]);
  const width = size.w >= 640 ? VIRTUAL_WIDE : VIRTUAL_PHONE;
  const scale = size.w > 0 ? Math.min(1, size.w / width) : 1;
  const edition = journey.story_template || "quiet-atlas";
  return (
    <div
      ref={outer}
      className="ht-preview"
      role="group"
      aria-label={t(`${journey.title}: the journey, set in First light`, `${journey.title}: die Reise, gesetzt in Erstes Licht`)}
    >
      {near && size.w > 0 && (
        <iframe
          className="ht-preview-frame"
          title={t("Preview of the journey", "Vorschau der Reise")}
          tabIndex={0}
          srcDoc={"<!doctype html><html><head></head><body></body></html>"}
          style={{ width, height: size.h / scale, transform: `scale(${scale})` }}
          onLoad={(event) => {
            const doc = event.currentTarget.contentDocument;
            if (!doc) return;
            document.querySelectorAll('style,link[rel="stylesheet"]').forEach((node) => doc.head.appendChild(node.cloneNode(true)));
            doc.documentElement.className = document.documentElement.className;
            doc.documentElement.classList.add("is-home-frame");
            doc.body.className = "preview-document home-preview-document";
            setBody(doc.body);
          }}
        >
          {body &&
            createPortal(
              <main className={`story-experience template-${edition} is-story-preview is-home-preview`}>
                <JournalCanvas journey={journey} />
              </main>,
              body,
            )}
        </iframe>
      )}
      <span className="ht-preview-hint" data-on={active && !touched && Boolean(body)} aria-hidden="true">
        {t("Scroll to explore", "Scrollen zum Erkunden")}
      </span>
    </div>
  );
}

// Eight prints fly towards the journey: each one on its own way (a loose fan), smaller and fainter, while the journey
// fades in underneath; then the table rests.
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const FLIGHT = 1000;
const STAGGER = 55;
const PREVIEW_AT = 560;

// Layout box without rotation: the centre survives a rotation, the size comes from offsetWidth/Height.
function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return { x: r.left + r.width / 2 - w / 2, y: r.top + r.height / 2 - h / 2, w, h };
}

type Phase = "before" | "flying" | "after";

export function HomeTransformation() {
  const [phase, setPhase] = useState<Phase>("before");
  const phaseRef = useRef<Phase>("before");
  const { locale } = useLocale();
  // The real example journey; until it has arrived (or if it cannot be reached) the built-in copy stands in.
  // A journey that arrives mid-flight waits until the table is reset, so nothing changes under the prints.
  const [loaded, setLoaded] = useState<Journey | null>(null);
  const pending = useRef<Journey | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<Journey>(STORY_PATH(locale), { signal: controller.signal })
      .then((journey) => {
        if (controller.signal.aborted || !journey?.photos?.length || !journey.chapters?.length) return;
        if (phaseRef.current === "before") setLoaded(journey);
        else pending.current = journey;
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [locale]);
  const journey = useMemo(() => loaded ?? fallbackJourney(), [loaded, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const { sheet, grid, count } = useMemo(() => {
    const roll = pickShots(journey);
    const prints: Print[] = contactSheet(roll.length).map((spec) => ({ ...spec, photo: roll[spec.shot] }));
    return { sheet: prints, grid: sheetGrid(prints.length), count: countWord(prints.length) };
  }, [journey]);
  const stageRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusLink = useRef(false);
  const focusButton = useRef(false);
  const cleanups = useRef<(() => void)[]>([]);
  const motionOff = useMotionOff();
  const isAfter = phase !== "before";
  const move = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const settle = () => cleanups.current.splice(0).forEach((done) => done());
  useEffect(() => settle, []);
  useEffect(() => {
    if (phase !== "before" && focusLink.current) {
      focusLink.current = false;
      linkRef.current?.focus({ preventScroll: true });
    }
    if (phase === "before" && focusButton.current) {
      focusButton.current = false;
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  // Only a click or a key press on the button starts this – never scrolling.
  const play = () => {
    if (phaseRef.current !== "before") return;
    focusLink.current = true;
    const stage = stageRef.current;
    if (!stage || motionOff || isMotionOff()) {
      move("after");
      return;
    }
    const prints = Array.from(stage.querySelectorAll<HTMLElement>(".ht-sheet .ht-print"));
    const area = stage.querySelector<HTMLElement>(".ht-preview")?.getBoundingClientRect();
    if (!prints.length || !area) {
      move("after");
      return;
    }
    const to = { x: area.left + area.width / 2, y: area.top + area.height / 2 };
    const animations = prints.map((print, i) => {
      const flight = flightOf(boxOf(print), to, i, prints.length);
      const dx = parseFloat(print.style.getPropertyValue("--dx")) || 0;
      const dy = parseFloat(print.style.getPropertyValue("--dy")) || 0;
      const tilt = parseFloat(print.style.getPropertyValue("--tilt")) || 0;
      return print.animate(
        [
          { translate: `${dx}px ${dy}px`, rotate: `${tilt}deg`, scale: 1, opacity: 1 },
          { opacity: 1, offset: 0.62 },
          { translate: `${dx + flight.tx}px ${dy + flight.ty}px`, rotate: "0deg", scale: flight.scale, opacity: 0 },
        ],
        { duration: FLIGHT, delay: i * STAGGER, easing: EASE, fill: "both" },
      );
    });
    move("flying");
    const showPreview = window.setTimeout(() => {
      stage.dataset.preview = "on";
    }, PREVIEW_AT);
    const land = () => {
      window.clearTimeout(showPreview);
      animations.forEach((animation) => animation.cancel());
    };
    cleanups.current.push(land);
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        if (phaseRef.current !== "flying") return;
        stage.dataset.preview = "on";
        move("after");
        // The prints are invisible by now; releasing them lets the table rest under the finished page.
        window.setTimeout(land, 60);
      },
      () => undefined,
    );
  };

  // Back to the light table – the prints wait for the next click, nothing plays by itself.
  const reset = () => {
    settle();
    delete stageRef.current?.dataset.preview;
    focusButton.current = true;
    if (pending.current) {
      setLoaded(pending.current);
      pending.current = null;
    }
    move("before");
  };

  return (
    <div className="page-width home-transform-inner">
      <header className="home-transform-head">
        <h2 id="home-transform-title" className="ht-title">
          <span className="ht-swap">
            <span className="ht-line-set" data-on={!isAfter} aria-hidden={isAfter}>
              <span className="ht-line">{t(`${count.en} photos.`, `${count.de} Fotos.`)}</span>
              <em className="ht-line">{t("Somewhere among four thousand others.", "Irgendwo zwischen viertausend anderen.")}</em>
            </span>
            <span className="ht-line-set" data-on={isAfter} aria-hidden={!isAfter}>
              <span className="ht-line">{t("Now it is", "Jetzt ist es")}</span>
              <em className="ht-line">{t("a story.", "eine Geschichte.")}</em>
            </span>
          </span>
        </h2>
        <div className="home-transform-side ht-actions">
          <div className="ht-swap">
            <div className="ht-action" data-on={!isAfter} inert={isAfter}>
              <button ref={buttonRef} type="button" className="ht-button" onClick={play}>
                {t("Make it a story", "Eine Geschichte daraus machen")}
              </button>
            </div>
            <div className="ht-action" data-on={isAfter} inert={!isAfter}>
              <Link ref={linkRef} to="/studio/new" className="ht-button is-solid">
                {t("Design your own story", "Eigene Geschichte gestalten")} <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <button type="button" className="ht-again" onClick={reset}>
                {t("Reset", "Zurücksetzen")}
              </button>
            </div>
          </div>
        </div>
      </header>
      <div ref={stageRef} className="ht-stage" data-phase={phase}>
        <div className="ht-layer ht-before" inert={isAfter}>
          <div className="hs-bar ht-bar">
            <span className="home-transform-label">
              {t("Before", "Vorher")}
              <span className="hs-bar-note">{t(`${sheet.length} photos, unsorted`, `${sheet.length} Fotos, unsortiert`)}</span>
            </span>
          </div>
          <div className="ht-table">
            <ul
              className="ht-sheet"
              role="img"
              aria-label={t(
                `Contact sheet: ${count.en.toLowerCase()} photos, unsorted.`,
                `Kontaktbogen: ${count.de.toLowerCase()} Fotos, unsortiert.`,
              )}
              style={{ "--cols": grid.cols, "--rows": grid.rows } as CSSProperties}
            >
              {sheet.map((print, i) => (
                <li
                  key={i}
                  className="ht-print"
                  style={{ "--tilt": `${print.tilt}deg`, "--dx": `${print.dx}px`, "--dy": `${print.dy}px` } as CSSProperties}
                >
                  <img
                    src={print.photo.src}
                    srcSet={print.photo.srcSet || undefined}
                    sizes="(max-width: 639px) 26vw, 16vw"
                    alt=""
                    width={640}
                    height={427}
                    loading="lazy"
                    decoding="async"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="ht-layer ht-after" inert={phase !== "after"}>
          <div className="hs-bar ht-bar">
            <span className="home-transform-label">
              {t("After", "Nachher")}
              <span className="hs-bar-note">
                {t("The same photos, as a story in First light.", "Dieselben Fotos, als Geschichte in Erstes Licht.")}
              </span>
            </span>
            <Link to="/inspiration/quiet-atlas" className="ht-more">
              {t("See the whole journey", "Die ganze Reise ansehen")} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <JourneyPreview journey={journey} active={phase === "after"} />
        </div>
      </div>
    </div>
  );
}

export type Mood = "quiet-atlas" | "after-hours";
const MOODS: { id: Mood; edition: string; name: () => string }[] = [
  { id: "quiet-atlas", edition: "I", name: () => t("First light", "Erstes Licht") },
  { id: "after-hours", edition: "II", name: () => t("Last light", "Letztes Licht") },
];

/* One motif, the same words; only the edition changes. The parent owns the state so the whole
   band and the edition cards below can follow it. */
export function MoodSwitch({ mood, onChange }: { mood: Mood; onChange: (mood: Mood) => void }) {
  const motif = SHOTS.klippe;
  return (
    <div className="mood-demo">
      <p className="mood-demo-line">
        <span className="mood-demo-kicker">{t("Try it", "Probier es aus")}</span>
        <span className="mood-demo-note">
          {t(
            "One photo, the same words. Only the mood changes.",
            "Ein Foto, dieselben Worte. Nur die Stimmung wechselt.",
          )}
        </span>
      </p>
      <div className="mood-switch" data-mood={mood} role="group" aria-label={t("Choose a mood", "Stimmung wählen")}>
        {MOODS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="mood-switch-button"
            aria-pressed={mood === item.id}
            onClick={() => onChange(item.id)}
          >
            <span className="mood-switch-no" aria-hidden="true">{`Edition ${item.edition}`}</span>
            <span className="mood-switch-name">{item.name()}</span>
          </button>
        ))}
        <span className="mood-switch-line" aria-hidden="true" />
      </div>
      <div className="mood-spread" data-mood={mood}>
        {MOODS.map((item) => {
          const active = item.id === mood;
          return (
            <div
              key={item.id}
              className={`mood-layer template-${item.id} is-${item.id === "quiet-atlas" ? "light" : "dark"}`}
              aria-hidden={!active}
              aria-label={active ? t(`Sample page in ${item.name()}`, `Beispielseite in ${item.name()}`) : undefined}
              role={active ? "group" : undefined}
            >
              <figure className="mood-photo">
                <img
                  src={img(motif.src)}
                  srcSet={`${img(motif.src)} 640w, ${img(motif.src, 1280)} 1280w`}
                  sizes="(max-width: 760px) calc(100vw - 44px), 56vw"
                  alt={active ? motif.alt() : ""}
                  width={1280}
                  height={853}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <div className="mood-copy">
                <span className="mood-kicker">{t("Day 2 · Tenerife", "Tag 2 · Teneriffa")}</span>
                <p className="mood-title">{t("Above the sea", "Über dem Meer")}</p>
                <p className="mood-body">
                  {t(
                    "Sitting at the edge for a long time. Far below, the sea barely moves. Only the wind says that evening is coming.",
                    "Lange am Rand sitzen. Tief unten bewegt sich das Meer kaum. Nur der Wind verrät, dass es Abend wird.",
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* "Zwei Editionen" on the home page (13.11.): a split title card between the dark "before/after"
   band and the two example stories. Left half paper, right half night; the headline reads across
   the seam ("Hell | oder dunkel."), so the heading itself shows both moods. On small screens it
   falls back to one plain heading block. The decorative halves are hidden from assistive tech;
   the real heading is the h2. */
export function HomeEditions() {
  return (
    <section id="editionen" className="home-duo" aria-labelledby="editions-heading" tabIndex={-1}>
      <div className="home-duo-plain">
        <span className="eyebrow">{t("Two editions", "Zwei Editionen")}</span>
        <h2 id="editions-heading">
          {t("Light or dark.", "Hell oder dunkel.")}{" "}
          <em>{t("Two lights, two moods.", "Zwei Lichter, zwei Stimmungen.")}</em>
        </h2>
      </div>
      <div className="home-duo-stage">
        <div className="home-duo-half is-light">
          <span className="home-duo-kicker" aria-hidden="true">{t("Two", "Zwei")}</span>
          <span className="home-duo-line" aria-hidden="true">{t("Light", "Hell")}</span>
          <span className="home-duo-line is-italic" aria-hidden="true">{t("Two lights,", "Zwei Lichter,")}</span>
          <p className="home-duo-lead">
            {t(
              "Choose the light that suits your journey – or combine both, module by module.",
              "Wähle das Licht, das zu deiner Reise passt – oder kombiniere beide Modul für Modul.",
            )}
          </p>
        </div>
        <div className="home-duo-half is-dark">
          <span className="home-duo-kicker" aria-hidden="true">{t("editions", "Editionen")}</span>
          <span className="home-duo-line" aria-hidden="true">{t("or dark.", "oder dunkel.")}</span>
          <span className="home-duo-line is-italic" aria-hidden="true">{t("two moods.", "zwei Stimmungen.")}</span>
          <Link to="/inspiration" className="text-link home-duo-link">
            {t("See both editions", "Beide Editionen ansehen")} <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
