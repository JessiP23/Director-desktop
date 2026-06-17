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
