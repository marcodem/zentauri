import Sanscript from "@indic-transliteration/sanscript";

/**
 * Supported transliteration schemes for bidirectional conversion with Devanagari.
 */
export type TransliterationScheme = "iast" | "hk";

/**
 * Checks if the string contains Devanagari characters.
 */
export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Helper to transliterate text while preserving directive wrappers (:sig[...] and :mark[...]).
 */
function transformPreservingDirectives(
  text: string,
  transform: (chunk: string) => string,
): string {
  if (!text) return text;
  if (!text.includes(":sig[") && !text.includes(":mark[")) {
    return transform(text);
  }
  const parts = text.split(/(:(?:sig|mark)\[[\s\S]*?\])/g);
  return parts
    .map((part) => {
      const match = part.match(/^(:(?:sig|mark)\[)([\s\S]*?)(\])$/);
      if (match) {
        return match[1] + transform(match[2]) + match[3];
      }
      return part ? transform(part) : "";
    })
    .join("");
}

/**
 * Transliterates IAST to Devanagari.
 */
export function iastToDevanagari(text: string): string {
  if (!text) return text;
  // Normalize ISO 15919 / keyboard variants like ṁ to standard IAST ṃ
  const normalized = text.replace(/ṁ/g, "ṃ").replace(/Ṁ/g, "Ṃ");
  return transformPreservingDirectives(normalized, (chunk) =>
    chunk ? Sanscript.t(chunk, "iast", "devanagari") : "",
  );
}

/**
 * Transliterates Devanagari to IAST.
 */
export function devanagariToIast(text: string): string {
  if (!text) return text;
  return transformPreservingDirectives(text, (chunk) =>
    chunk ? Sanscript.t(chunk, "devanagari", "iast") : "",
  );
}

/**
 * Smart bidirectional toggle (IAST <-> Devanagari):
 * If the input contains Devanagari, convert Devanagari -> IAST.
 * Otherwise, convert IAST -> Devanagari.
 */
export function toggleTransliteration(text: string): string {
  if (!text) return text;
  return containsDevanagari(text)
    ? devanagariToIast(text)
    : iastToDevanagari(text);
}

/**
 * Transliterates Harvard-Kyoto (HK) to Devanagari.
 */
export function hkToDevanagari(text: string): string {
  if (!text) return text;
  return transformPreservingDirectives(text, (chunk) =>
    chunk ? Sanscript.t(chunk, "hk", "devanagari") : "",
  );
}

/**
 * Transliterates Devanagari to Harvard-Kyoto (HK).
 */
export function devanagariToHk(text: string): string {
  if (!text) return text;
  return transformPreservingDirectives(text, (chunk) =>
    chunk ? Sanscript.t(chunk, "devanagari", "hk") : "",
  );
}

/**
 * Smart bidirectional toggle (Harvard-Kyoto <-> Devanagari):
 * If the input contains Devanagari, convert Devanagari -> Harvard-Kyoto.
 * Otherwise, convert Harvard-Kyoto -> Devanagari.
 */
export function toggleHkTransliteration(text: string): string {
  if (!text) return text;
  return containsDevanagari(text) ? devanagariToHk(text) : hkToDevanagari(text);
}

/**
 * Smart bidirectional toggle for a specified scheme ('iast' or 'hk').
 */
export function toggleSchemeTransliteration(
  text: string,
  scheme: TransliterationScheme = "iast",
): string {
  if (scheme === "hk") {
    return toggleHkTransliteration(text);
  }
  return toggleTransliteration(text);
}

/**
 * Finds the Sanskrit/IAST/Harvard-Kyoto/Devanagari word range around a given character position.
 */
export function findSanskritWordRange(
  doc: string,
  pos: number,
): { from: number; to: number } | null {
  const charRegex = /[\p{L}\p{M}\u0900-\u097F']/u;
  if (pos < 0 || pos >= doc.length || !charRegex.test(doc[pos])) {
    return null;
  }
  let from = pos;
  let to = pos;

  while (from > 0 && charRegex.test(doc[from - 1])) {
    from--;
  }
  while (to < doc.length && charRegex.test(doc[to])) {
    to++;
  }

  return from < to ? { from, to } : null;
}
