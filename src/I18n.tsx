import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import catalog from "./translations.json";
export type Locale = "de" | "en";
let active: Locale = (() => {
  try {
    return localStorage.getItem("wander-language") === "en" ? "en" : "de";
  } catch {
    return "de";
  }
})();
const Context = createContext<{
  locale: Locale;
  setLocale: (v: Locale) => void;
}>({ locale: active, setLocale: () => {} });
export function t(en: string, de?: string): string {
  if (active !== "de") return en;
  const translated = de || (catalog as Record<string, string>)[en];
  if (translated) return translated;
  // Backend wording: "Please provide a valid <field>[ for the story| for the <kind> module] (maximum N characters)."
  const field = en.match(
    /^Please provide a valid (.+?)(?: for the (story|(\w+) module))? \(maximum (\d+) characters\)\.$/,
  );
  if (field) {
    const names: Record<string, string> = {
      title: "Titel",
      subtitle: "Untertitel",
      location: "Ort",
      country: "Land",
      description: "Beschreibung",
      introduction: "Einleitung",
      reflection: "Rückblick",
      closing: "Abschluss",
      story: "Text",
      quote: "Zitat",
      alt: "alternative Bildbeschreibung",
      password: "Passwort",
    };
    // Same German names as moduleNames in JournalCanvas.tsx (not imported here: it imports this file).
    const modules: Record<string, string> = {
      chapter: "Tag / Kapitel",
      hero: "Titelbild",
      image: "Einzelbild",
      pair: "Bildpaar / Gruppe",
      rail: "Horizontale Bildreihe",
      filmstrip: "Laufender Fotostreifen",
      wall: "Fotowand",
      gallery: "Galerie",
      text: "Text",
      quote: "Zitat",
    };
    const [, key, scope, kind, maximum] = field;
    const name = names[key] || key;
    const ask = `Bitte einen gültigen Wert eingeben (maximal ${maximum} Zeichen).`;
    if (scope === "story") return `Geschichte · ${name}: ${ask}`;
    if (kind) return `Modul „${modules[kind] || kind}“ · ${name}: ${ask}`;
    return `Bitte einen gültigen Wert für ${name} eingeben (maximal ${maximum} Zeichen).`;
  }
  if (en.startsWith("Please provide a valid ") && en.endsWith("."))
    return "Bitte ein gültiges Datum eingeben.";
  return en;
}
export const tr = t;
export const getLocale = () => active;
export const useLocale = () => useContext(Context);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, update] = useState<Locale>(active);
  const setLocale = (v: Locale) => {
    active = v;
    try {
      localStorage.setItem("wander-language", v);
    } catch {
      /* Selection still works for this session. */
    }
    update(v);
  };
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <Context.Provider value={{ locale, setLocale }}>
      {children}
    </Context.Provider>
  );
}
export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="language-switch">
      <span className="sr-only">{t("Language", "Sprache")}</span>
      <select
        aria-label={t("Language", "Sprache")}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="de">DE</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
