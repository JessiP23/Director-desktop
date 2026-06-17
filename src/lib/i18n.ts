import en from "@/messages/en.json";
import it from "@/messages/it.json";
import es from "@/messages/es.json";

/**
 * Minimal i18n for the desktop chat. The strings are copied verbatim from
 * wmstudio's `messages/{en,it,es}.json` (the `director.conversation` slice), and
 * looked up by locale — the same key-based logic next-intl uses on the web,
 * without pulling in the framework.
 *
 * The desktop has no locale route, and the user accepts the model's reply
 * language, so the locale is detected from the conversation text (see
 * `detectLocale`) to keep the UI consistent with what the model is saying.
 */
export type Locale = "en" | "it" | "es";

const BUNDLES = { en, it, es } as const;

/** The `director.conversation` message slice for a locale. */
export function conversationMessages(locale: Locale) {
  return BUNDLES[locale].director.conversation;
}

// Marker-based detection, mirroring the backend's approach.
const ES_MARKERS = /[¿¡ñ]|[áíóú]|\b(generar|continuar|procede|cancelar|imagen|vídeo|esto|también)\b/i;
const IT_MARKERS = /[àèìòù]|\b(genera|procedi|conferma|annulla|immagine|questa|proposta|anteprima)\b/i;

export function detectLocale(text: string): Locale {
  const sample = (text || "").toLowerCase();
  if (ES_MARKERS.test(sample)) return "es";
  if (IT_MARKERS.test(sample)) return "it";
  return "en";
}

/**
 * App-UI locale — follows the OS language (en/it/es), default English. Drives
 * static chrome ported from the web (the references canvas, etc.). Chat content
 * still adapts to the model via `detectLocale`.
 */
export function appLocale(): Locale {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (lang.startsWith("it")) return "it";
  if (lang.startsWith("es")) return "es";
  return "en";
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
  const locale = appLocale();
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
