import * as React from "react";
import en from "@/messages/en.json";
import it from "@/messages/it.json";
import es from "@/messages/es.json";

/**
 * Minimal i18n for the desktop chat. The strings are copied verbatim from
 * wmstudio's `messages/{en,it,es}.json` (the `director.conversation` slice), and
 * looked up by locale — the same key-based logic next-intl uses on the web,
 * without pulling in the framework.
 *
 * The desktop has no locale route, so the app keeps one persisted UI language
 * in localStorage and falls back to the OS language on first launch.
 */
export type Locale = "en" | "it" | "es";

const BUNDLES = { en, it, es } as const;
const LOCALE_STORAGE_KEY = "director-desktop-locale";
const LOCALE_CHANGE_EVENT = "director-desktop-locale-change";

export const LANGUAGES: { locale: Locale; label: string }[] = [
  { locale: "en", label: "English" },
  { locale: "it", label: "Italiano" },
  { locale: "es", label: "Español" },
];

function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  if (lower.startsWith("it")) return "it";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";
  return null;
}

function systemLocale(): Locale {
  return normalizeLocale(typeof navigator !== "undefined" ? navigator.language : "en") ?? "en";
}

function readStoredLocale(): Locale {
  try {
    return normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY)) ?? systemLocale();
  } catch {
    return systemLocale();
  }
}

let currentLocale: Locale | null = null;

function readLocaleSnapshot(): Locale {
  if (!currentLocale) currentLocale = readStoredLocale();
  return currentLocale;
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

function subscribeLocale(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const notify = () => listener();
  const notifyFromStorage = () => {
    currentLocale = readStoredLocale();
    listener();
  };
  window.addEventListener(LOCALE_CHANGE_EVENT, notify);
  window.addEventListener("storage", notifyFromStorage);
  return () => {
    window.removeEventListener(LOCALE_CHANGE_EVENT, notify);
    window.removeEventListener("storage", notifyFromStorage);
  };
}

/** The `director.conversation` message slice for a locale. */
export function conversationMessages(locale: Locale) {
  return BUNDLES[locale].director.conversation;
}

/**
 * App-UI locale — persisted by the profile language menu and initialized from
 * the OS language (en/it/es). This is the desktop's equivalent of wmstudio's
 * route locale: a single UI language for all chrome and translated strings.
 */
export function appLocale(): Locale {
  return readLocaleSnapshot();
}

export function setAppLocale(locale: Locale) {
  currentLocale = locale;
  applyDocumentLocale(locale);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Best-effort persistence; the in-memory locale still updates.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

export function useAppLocale() {
  const locale = React.useSyncExternalStore<Locale>(subscribeLocale, appLocale, () => "en");
  React.useEffect(() => applyDocumentLocale(locale), [locale]);
  return locale;
}

function lookup(locale: Locale, path: string): string {
  let node: unknown = BUNDLES[locale];
  for (const part of path.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof node === "string" ? node : path;
}

/**
 * Drop-in shim for next-intl's `useTranslations(namespace)` over the copied
 * message bundles, so web components that call `t("brief.graph.back")` port with
 * no changes to their translation calls. Supports `{var}` interpolation.
 */
export function useTranslations(namespace: string) {
  const locale = useAppLocale();
  return (key: string, vars?: Record<string, string | number>) => {
    let str = lookup(locale, `${namespace}.${key}`);
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
      }
    }
    return str;
  };
}
