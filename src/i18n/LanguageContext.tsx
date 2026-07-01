import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type Language, translations } from "./translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations["pt"];
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "zeus:lang";
const VALID: Language[] = ["pt", "en", "es", "it", "de", "fr"];

const detectInitial = (): Language => {
  if (typeof window === "undefined") return "pt";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && VALID.includes(saved)) return saved;
    const nav = (window.navigator.language || "pt").slice(0, 2).toLowerCase() as Language;
    if (VALID.includes(nav)) return nav;
  } catch {}
  return "pt";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(detectInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    } catch {}
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};

/** Map app language -> BCP47 locale for Intl formatters. */
export const languageToLocale: Record<Language, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  it: "it-IT",
  de: "de-DE",
  fr: "fr-FR",
};
