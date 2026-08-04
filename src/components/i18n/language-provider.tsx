"use client";

import { createContext, useContext } from "react";
import { translate, type Language, type TranslationKey } from "@/lib/i18n";

const LanguageContext = createContext<Language>("es");

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

/** `const { t, lang } = useT()` — translates against the client's saved language. */
export function useT() {
  const lang = useContext(LanguageContext);
  return {
    lang,
    t: (key: TranslationKey) => translate(key, lang),
  };
}
