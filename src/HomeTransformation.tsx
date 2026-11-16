import { BASE_URL } from "./staticSite";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { t } from "./I18n";
import { useMotionOff } from "./Motion";
import { isMotionOff } from "./motionState";
import { stripIndex, stripLabel, stripStep } from "./homeStripModel";
import { contactSheet, countWord, insetCss, pairPrints, planFlight, sheetGrid, type Box } from "./homeLightTable";
import "./home-editions.css";

/* G4: two home blocks that turn the promise into something to see.
   A – "Verwandlung" (15.11.): thirty prints on a dark light table; the reader's click sets them into a
   double page in First light (FLIP), after which the story can be paged through.
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

// The light table holds exactly the photos of the story below – each once, whole, unsorted.
// Fixed values only (no randomness): order and tilt of every print.
const ROLL: Shot[] = [
  SHOTS.panorama, SHOTS.chalet, SHOTS.kanal, SHOTS.abendrot,
  SHOTS.steg, SHOTS.steinmann, SHOTS.see, SHOTS.bruecke,
];
type Print = { shot: Shot; tilt: number; dx: number; dy: number };
const SHEET: Print[] = contactSheet(ROLL.length).map((spec) => ({ ...spec, shot: ROLL[spec.shot] }));
const GRID = sheetGrid(SHEET.length);
const COUNT = countWord(SHEET.length);

// The "after" is a small WANDER story in First light: four views, swiped sideways like the real thing.
type StripView = { key: string; name: () => string };
const VIEWS: StripView[] = [
  { key: "spread", name: () => t("Double page", "Doppelseite") },
  { key: "quote", name: () => t("Quote", "Zitat") },
  { key: "row", name: () => t("Row of images", "Bildreihe") },
  { key: "single", name: () => t("Single image", "Einzelbild") },
];

function StripImage({ item, sizes, caption }: { item: Shot; sizes: string; caption?: string }) {
  return (
    <figure className="hs-figure">
      <span className="hs-frame">
        <img
          src={img(item.src)}
          srcSet={`${img(item.src)} 640w, ${img(item.src, 1280)} 1280w`}
          sizes={sizes}
          alt={item.alt()}
          width={640}
          height={427}
          loading="lazy"
          decoding="async"
          data-shot={item.src}
        />
      </span>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function StoryStrip({ active }: { active: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const motionOff = useMotionOff();
  const count = VIEWS.length;
  const offsets = () => {
    const views = Array.from(viewportRef.current?.querySelectorAll<HTMLElement>(".hs-view") ?? []);
    const first = views[0]?.offsetLeft ?? 0;
    return views.map((view) => view.offsetLeft - first);
  };
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setIndex(stripIndex(offsets(), viewport.scrollLeft, viewport.scrollWidth - viewport.clientWidth));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  const go = (target: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const next = stripStep(target, 0, count);
    const left = offsets()[next] ?? 0;
    viewport.scrollTo({ left, behavior: motionOff || isMotionOff() ? "auto" : "smooth" });
    setIndex(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step) {
      event.preventDefault();
      go(index + step);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      go(event.key === "Home" ? 0 : count - 1);
    }
  };
  const page = "(max-width: 639px) 80vw, (max-width: 1023px) 38vw, 28vw";
  const half = "(max-width: 639px) 44vw, (max-width: 1023px) 22vw, 16vw";
  const small = "(max-width: 639px) 22vw, (max-width: 1023px) 14vw, 11vw";
  const third = "(max-width: 639px) 40vw, (max-width: 1023px) 22vw, 15vw";
  return (
    <div className="ht-layer ht-after" inert={!active}>
      <div className="hs-bar ht-bar">
        <span className="home-transform-label">
          {t("After", "Nachher")}
          <span className="hs-bar-note">
            {t("The same photos, as a story in First light.", "Dieselben Fotos, als Geschichte in Erstes Licht.")}
          </span>
        </span>
        <div className="hs-controls">
          <span className="hs-dashes" aria-hidden="true">
            {VIEWS.map((view, i) => (
              <span key={view.key} className={i === index ? "is-active" : undefined} />
            ))}
          </span>
          <span className="hs-count" aria-live="polite" aria-atomic="true">
            <span className="visually-hidden">{t("View", "Ansicht")} </span>
            {stripLabel(index, count)}
          </span>
          <button
            type="button"
            className="hs-arrow"
            aria-label={t("Previous view", "Vorherige Ansicht")}
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <ArrowLeft size={18} strokeWidth={1.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="hs-arrow"
            aria-label={t("Next view", "Nächste Ansicht")}
            disabled={index === count - 1}
            onClick={() => go(index + 1)}
          >
            <ArrowRight size={18} strokeWidth={1.4} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="hs-viewport template-quiet-atlas"
        tabIndex={0}
        role="region"
        aria-roledescription={t("carousel", "Bildstreifen")}
        aria-label={t(
          "Between snow and stillness, set in First light. Swipe or use the arrow keys.",
          "Zwischen Schnee und Stille, gesetzt in Erstes Licht. Wischen oder Pfeiltasten nutzen.",
        )}
        onKeyDown={onKeyDown}
      >
        <ol className="hs-track">
          {VIEWS.map((view, i) => (
            <li
              key={view.key}
              className={`hs-view hs-${view.key}`}
              aria-label={t(`View ${i + 1} of ${count}: ${view.name()}`, `Ansicht ${i + 1} von ${count}: ${view.name()}`)}
            >
              {view.key === "spread" && (
                <div className="hs-spread">
                  <div className="hs-page is-cover">
                    <span className="hs-frame">
                      <img
                        src={img(SHOTS.panorama.src)}
                        srcSet={`${img(SHOTS.panorama.src)} 640w, ${img(SHOTS.panorama.src, 1280)} 1280w`}
                        sizes={page}
                        alt={SHOTS.panorama.alt()}
                        width={1280}
                        height={853}
                        loading="lazy"
                        decoding="async"
                        data-shot={SHOTS.panorama.src}
                      />
                    </span>
                    <div className="hs-cover-type">
                      <span className="hs-kicker">{t("Bernese Oberland · Winter", "Berner Oberland · Winter")}</span>
                      <p className="hs-cover-title">{t("Between snow and stillness", "Zwischen Schnee und Stille")}</p>
                      <p className="hs-cover-sub">{t("Six winter days in the mountains.", "Sechs Wintertage in den Bergen.")}</p>
                    </div>
                  </div>
                  <div className="hs-page is-day">
                    <div className="hs-copy">
                      <span className="hs-kicker">{t("Day 1", "Tag 1")}</span>
                      <p className="hs-title">{t("Arriving in the snow", "Ankunft im Schnee")}</p>
                      <p className="hs-text">
                        {t(
                          "Late in the afternoon we reach the chalet. Then the light turns red, and everything goes quiet.",
                          "Am späten Nachmittag erreichen wir das Chalet. Dann wird das Licht rot, und alles wird still.",
                        )}
                      </p>
                    </div>
                    <div className="hs-day-images">
                      <StripImage item={SHOTS.chalet} sizes={half} caption={t("Chalet against the light", "Chalet im Gegenlicht")} />
                      <StripImage item={SHOTS.kanal} sizes={small} />
                      <StripImage item={SHOTS.abendrot} sizes={small} />
                    </div>
                  </div>
                </div>
              )}
              {view.key === "quote" && (
                <div className="hs-quote">
                  <span className="hs-kicker">{t("Day 2", "Tag 2")}</span>
                  <p>{t("In the evening, only the snow still speaks.", "Am Abend spricht nur noch der Schnee.")}</p>
                </div>
              )}
              {view.key === "row" && (
                <div className="hs-row">
                  <div className="hs-row-head">
                    <span className="hs-kicker">{t("Day 3", "Tag 3")}</span>
                    <p className="hs-title">{t("By the lake", "Am See")}</p>
                  </div>
                  <div className="hs-row-images">
                    {[SHOTS.steg, SHOTS.steinmann, SHOTS.see].map((item) => (
                      <StripImage key={item.src} item={item} sizes={third} />
                    ))}
                  </div>
                </div>
              )}
              {view.key === "single" && (
                <div className="hs-single">
                  <StripImage
                    item={SHOTS.bruecke}
                    sizes={page}
                    caption={t("Day 4 · Across the ridge", "Tag 4 · Über den Grat")}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* FLIP (geometry in homeLightTable.ts): every print flies from the light table to its frame in the story overview
   (all four views side by side); after a short rest the overview opens into the strip.
   A clone sits at the frame's final place and starts transformed back onto the print (translate,
   tilt, uniform scale); clip-path carries the crop from the print to the frame. Both boxes
   show the same photo with object-fit: cover, so working with the whole photo keeps the scale uniform. */
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const FLIGHT = 900;
const STAGGER = 40;
// After the last print lands, the overview rests a moment before it opens into the strip.
const HOLD = 420;

// Layout box without rotation: the centre survives a rotation, the size comes from offsetWidth/Height.
function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return { x: r.left + r.width / 2 - w / 2, y: r.top + r.height / 2 - h / 2, w, h };
}
function focusOf(el: HTMLImageElement): [number, number] {
  const [x, y] = getComputedStyle(el).objectPosition.split(" ");
  const part = (v?: string) => (v && v.endsWith("%") ? parseFloat(v) / 100 : 0.5);
  return [part(x), part(y)];
}
function launch(print: HTMLImageElement, target: HTMLImageElement, layer: HTMLElement, tilt: number, delay: number) {
  const origin = layer.getBoundingClientRect();
  const ratio =
    target.naturalWidth && target.naturalHeight
      ? target.naturalWidth / target.naturalHeight
      : print.naturalWidth && print.naturalHeight
        ? print.naturalWidth / print.naturalHeight
        : 1.5;
  const flight = planFlight(boxOf(print), boxOf(target), ratio, tilt, focusOf(print), focusOf(target));
  const clone = document.createElement("img");
  clone.src = target.complete && target.currentSrc ? target.currentSrc : print.currentSrc || print.src;
  clone.alt = "";
  clone.className = "ht-flier";
  clone.style.left = `${flight.photo.x - origin.left}px`;
  clone.style.top = `${flight.photo.y - origin.top}px`;
  clone.style.width = `${flight.photo.w}px`;
  clone.style.height = `${flight.photo.h}px`;
  layer.appendChild(clone);
  const animation = clone.animate(
    [
      {
        transform: `translate(${flight.tx}px, ${flight.ty}px) rotate(${tilt}deg) scale(${flight.scale})`,
        clipPath: insetCss(flight.startInset),
        filter: "saturate(0.5) brightness(0.8)",
      },
      { transform: "none", clipPath: insetCss(flight.endInset), filter: "none" },
    ],
    { duration: FLIGHT, delay, easing: EASE, fill: "both" },
  );
  return { clone, animation };
}

type Phase = "before" | "flying" | "after";

export function HomeTransformation() {
  const [phase, setPhase] = useState<Phase>("before");
  const phaseRef = useRef<Phase>("before");
  const stageRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);
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
  const expandFrom = useRef<DOMRect[] | null>(null);
  const views = () => Array.from(stageRef.current?.querySelectorAll<HTMLElement>(".hs-view") ?? []);
  // Overview → strip (FLIP): every page grows from its small place in the overview to its place in the strip.
  useLayoutEffect(() => {
    const from = expandFrom.current;
    expandFrom.current = null;
    if (phase !== "after" || !from || motionOff || isMotionOff()) return;
    const animations = views().map((view, i) => {
      const a = from[i];
      const b = view.getBoundingClientRect();
      if (!a || !b.width || !b.height) return null;
      return view.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: FLIGHT, easing: EASE },
      );
    });
    return () => animations.forEach((animation) => animation?.cancel());
  }, [phase, motionOff]);
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
    const layer = flightRef.current;
    if (!stage || !layer || motionOff || isMotionOff()) {
      move("after");
      return;
    }
    const viewport = stage.querySelector<HTMLElement>(".hs-viewport");
    if (viewport) viewport.scrollLeft = 0;
    // The overview (all views side by side) has to stand before the targets are measured.
    stage.dataset.phase = "flying";
    const visible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return el.offsetWidth > 0 && r.right > 0 && r.left < window.innerWidth;
    };
    const prints = Array.from(stage.querySelectorAll<HTMLImageElement>(".ht-sheet img[data-shot]")).filter(visible);
    const targets = Array.from(stage.querySelectorAll<HTMLImageElement>(".ht-after img[data-shot]")).filter(visible);
    const spot = (el: HTMLImageElement) => {
      const box = boxOf(el);
      return { shot: el.dataset.shot ?? "", at: { x: box.x, y: box.y } };
    };
    const pairs = pairPrints(prints.map(spot), targets.map(spot)).map(({ print, target }) => ({
      print: prints[print],
      target: targets[target],
    }));
    const flights = pairs.map(({ print, target }, i) => {
      const flight = launch(print, target, layer, Number(print.dataset.tilt) || 0, i * STAGGER);
      print.parentElement?.classList.add("is-lifted");
      target.classList.add("is-landing");
      return { ...flight, print, target };
    });
    const land = () => {
      flights.forEach(({ clone, animation, print, target }) => {
        animation.cancel();
        clone.remove();
        print.parentElement?.classList.remove("is-lifted");
        target.classList.remove("is-landing");
      });
    };
    cleanups.current.push(land);
    move("flying");
    const done = () => {
      if (phaseRef.current !== "flying") return;
      land();
      cleanups.current = cleanups.current.filter((item) => item !== land);
      const id = window.setTimeout(() => {
        if (phaseRef.current !== "flying") return;
        expandFrom.current = views().map((view) => view.getBoundingClientRect());
        move("after");
      }, HOLD);
      cleanups.current.push(() => window.clearTimeout(id));
    };
    if (flights.length) {
      Promise.all(flights.map(({ animation }) => animation.finished)).then(done, () => undefined);
    } else {
      const id = window.setTimeout(done, FLIGHT);
      cleanups.current.push(() => window.clearTimeout(id));
    }
  };

  // Back to the light table – the prints wait for the next click, nothing plays by itself.
  const reset = () => {
    settle();
    const viewport = stageRef.current?.querySelector<HTMLElement>(".hs-viewport");
    if (viewport) viewport.scrollLeft = 0;
    focusButton.current = true;
    move("before");
  };

  return (
    <div className="page-width home-transform-inner">
      <header className="home-transform-head">
        <h2 id="home-transform-title" className="ht-title">
          <span className="ht-swap">
            <span className="ht-line-set" data-on={!isAfter} aria-hidden={isAfter}>
              <span className="ht-line">{t(`${COUNT.en} photos.`, `${COUNT.de} Fotos.`)}</span>
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
              <span className="hs-bar-note">{t(`${SHEET.length} photos, unsorted`, `${SHEET.length} Fotos, unsortiert`)}</span>
            </span>
          </div>
          <div className="ht-table">
            <ul
              className="ht-sheet"
              role="img"
              aria-label={t(
                `Contact sheet: ${COUNT.en.toLowerCase()} photos from a winter week in Switzerland, unsorted.`,
                `Kontaktbogen: ${COUNT.de.toLowerCase()} Fotos einer Winterwoche in der Schweiz, unsortiert.`,
              )}
              style={{ "--cols": GRID.cols, "--rows": GRID.rows } as CSSProperties}
            >
              {SHEET.map((print, i) => (
                <li
                  key={i}
                  className="ht-print"
                  style={{ "--tilt": `${print.tilt}deg`, "--dx": `${print.dx}px`, "--dy": `${print.dy}px` } as CSSProperties}
                >
                  <img
                    src={img(print.shot.src)}
                    alt=""
                    width={640}
                    height={427}
                    loading="lazy"
                    decoding="async"
                    data-shot={print.shot.src}
                    data-tilt={print.tilt}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <StoryStrip active={phase === "after"} />
        <div ref={flightRef} className="ht-flight" aria-hidden="true" />
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
