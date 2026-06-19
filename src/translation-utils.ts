// =============================================================================
// Translation & RTL utilities (shared by MCP server and Bible Reader UI)
// =============================================================================

export interface TranslationLike {
  id: string;
  name: string;
  language?: string;
}

export interface ParsedTranslation {
  id: string;
  name: string;
  shortName: string;
}

export interface ReaderContentLike {
  direction?: "rtl" | "ltr";
  language?: string;
  translation?: TranslationLike;
}

/** Detect RTL from translation ID or BCP-47 language code. */
export function isRtlTranslation(
  translation: TranslationLike,
  language?: string
): boolean {
  const id = translation.id.toLowerCase();
  const lang = (language ?? translation.language ?? "").toLowerCase();
  return id === "wlc" || lang === "he" || lang === "heb" || lang.startsWith("he-");
}

/**
 * Reader-side RTL detection. Server-provided `direction`/`language` in
 * structuredContent is authoritative; ID/language checks are defensive fallbacks
 * for older responses or missing metadata.
 */
export function isRtlContent(
  data: ReaderContentLike | null | undefined,
  fallbackTranslationId = "web"
): boolean {
  if (!data) return false;
  if (data.direction === "rtl") return true;
  if (data.direction === "ltr") return false;

  const lang = (data.language ?? data.translation?.language ?? "").toLowerCase();
  const id = (data.translation?.id ?? fallbackTranslationId).toLowerCase();
  return id === "wlc" || lang === "he" || lang === "heb" || lang.startsWith("he-");
}

/** Parse list_translations tool text output into translation entries. */
export function parseTranslationsList(text: string): ParsedTranslation[] {
  const translations: ParsedTranslation[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const match = line.match(/^•\s+([A-Za-z0-9_.-]+)\s+-\s+(.+)$/);
    if (match) {
      translations.push({
        id: match[1].toLowerCase(),
        name: match[2].trim(),
        shortName: match[1],
      });
    }
  }

  return translations;
}

export function readerStructuredContent(
  base: Record<string, unknown>,
  translation: TranslationLike,
  language?: string
) {
  const resolvedLanguage = language ?? translation.language;
  const rtl = isRtlTranslation(translation, resolvedLanguage);
  return {
    ...base,
    translation,
    direction: rtl ? "rtl" : "ltr",
    language: resolvedLanguage ?? (rtl ? "he" : "en"),
  };
}

/**
 * Inline browser helpers injected into BIBLE_READER_HTML.
 * Keep in sync with exported functions above — parity covered in translation-utils.test.ts.
 */
export const BIBLE_READER_INLINE_UTILS = `
    function isRtlContent(data, currentTranslation) {
      if (!data) return false;
      if (data.direction === "rtl") return true;
      if (data.direction === "ltr") return false;
      const lang = (data.language || data.translation?.language || "").toLowerCase();
      const id = (data.translation?.id || currentTranslation || "").toLowerCase();
      return id === "wlc" || lang === "he" || lang === "heb" || lang.startsWith("he-");
    }

    function parseTranslationsList(text) {
      const translations = [];
      const lines = text.split("\\n");
      for (const line of lines) {
        const match = line.match(/^•\\s+([A-Za-z0-9_.-]+)\\s+-\\s+(.+)$/);
        if (match) {
          translations.push({
            id: match[1].toLowerCase(),
            name: match[2].trim(),
            shortName: match[1],
          });
        }
      }
      return translations;
    }
`;
