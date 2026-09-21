"use client";

import { useCallback, useEffect, useState } from "react";

export type LanguageDefinition = { code: string; name: string; file: string; locale: string };
export type Translator = (key: string, vars?: Record<string, string | number>) => string;

const preferenceKey = "dartsScheduler.language";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function useI18n() {
  const [languages, setLanguages] = useState<LanguageDefinition[]>([
    { code: "hr", name: "Hrvatski", file: "hr.json", locale: "hr-HR" },
    { code: "en", name: "English", file: "en.json", locale: "en-GB" },
    { code: "de", name: "Deutsch", file: "de.json", locale: "de-DE" },
  ]);
  const [language, setLanguageState] = useState("hr");
  const [fallback, setFallback] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem(preferenceKey);
    const browser = navigator.language.toLowerCase();
    setLanguageState(saved || (browser.startsWith("hr") ? "hr" : browser.startsWith("de") ? "de" : "en"));
    fetch(`${basePath}/locales/languages.json`).then(async r => r.ok ? await r.json() as LanguageDefinition[] : Promise.reject()).then(value => setLanguages(value)).catch(() => undefined);
    fetch(`${basePath}/locales/en.json`).then(async r => await r.json() as Record<string, string>).then(value => setFallback(value)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const definition = languages.find(item => item.code === language) || languages.find(item => item.code === "en");
    if (!definition) return;
    fetch(`${basePath}/locales/${definition.file}`).then(async r => r.ok ? await r.json() as Record<string, string> : Promise.reject()).then(value => setMessages(value)).catch(() => setMessages(fallback));
    document.documentElement.lang = definition.code;
  }, [language, languages, fallback]);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    localStorage.setItem(preferenceKey, code);
  }, []);
  const t = useCallback<Translator>((key, vars = {}) => {
    let value = messages[key] || fallback[key] || key;
    Object.entries(vars).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, String(replacement)); });
    return value;
  }, [messages, fallback]);
  const locale = languages.find(item => item.code === language)?.locale || "en-GB";
  return { t, language, setLanguage, languages, locale };
}
