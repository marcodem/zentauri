/**
 * Multi-language and parallel corpus path detection for Zentauri QA mode.
 */

export interface LanguageInfo {
  code: string;
  label: string;
}

export const KNOWN_LANGUAGES: Record<string, string> = {
  de: "Deutsch (DE)",
  en: "English (EN)",
  it: "Italiano (IT)",
  fr: "Français (FR)",
  es: "Español (ES)",
  hi: "हिन्दी (HI)",
  sa: "संस्कृतम् (SA)",
  ru: "Русский (RU)",
  uk: "Українська (UK)",
  ta: "தமிழ் (TA)",
  pa: "ਪੰਜਾਬੀ (PA)",
  la: "Latin (LA)",
  rm: "Romansh (RM)",
  ro: "Română (RO)",
  id: "Bahasa Indonesia (ID)",
  "zh-cn": "Simplified Chinese (ZH-CN)",
  zh: "Traditional Chinese (ZH)",
  he: "עברית (HE)",
  ar: "العربية (AR)",
  el: "Ελληνικά (EL)",
  th: "ไทย (TH)",
  grc: "Ancient Greek (GRC)",
  fi: "Suomi (FI)",
  hu: "Magyar (HU)",
  fa: "فارسی (FA)",
  bg: "Български (BG)",
  tr: "Türkçe (TR)",
  nl: "Nederlands (NL)",
  af: "Afrikaans (AF)",
  lt: "Lietuvių (LT)",
  sh: "Srpsko-hrvatski (SH)",
  sq: "Shqip (SQ)",
  pt: "Português (PT)",
  vi: "Tiếng Việt (VI)",
  am: "አማርኛ (AM)",
  gez: "ግዕዝ (GEZ)",
  pl: "Polski (PL)",
  cs: "Čeština (CS)",
  sk: "Slovenčina (SK)",
  sl: "Slovenščina (SL)",
  ka: "ქართული (KA)",
  hy: "Հայերեն (HY)",
  si: "සිංහල (SI)",
  te: "తెలుగు (TE)",
  da: "Dansk (DA)",
  no: "Norsk (NO)",
  sv: "Svenska (SV)",
  is: "Íslenska (IS)",
};

/**
 * Normalizes file path to forward slashes.
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Detects the language code and remaining relative subpath from a file path.
 */
export function detectLanguageFromPath(
  filePath: string,
): { langCode: string; relativeSubpath: string } | null {
  if (!filePath) return null;
  const normalized = normalizePath(filePath);
  const segments = normalized.split("/");

  // 1. Check for directory segment matching known language code
  // e.g. /docs/en/lektionen/lektion01.md -> en, lektionen/lektion01.md
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i].toLowerCase();
    if (KNOWN_LANGUAGES[seg]) {
      const subpath = segments.slice(i + 1).join("/");
      return { langCode: seg, relativeSubpath: subpath };
    }
  }

  // 2. Check for filename suffix pattern like doc_en.md or doc.en.md
  const fileName = segments[segments.length - 1];
  const suffixMatch = fileName.match(
    /^(.*?)[._-]([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)\.md$/i,
  );
  if (suffixMatch) {
    const lang = suffixMatch[2].toLowerCase();
    if (KNOWN_LANGUAGES[lang]) {
      const baseName = suffixMatch[1];
      const parent = segments.slice(0, segments.length - 1).join("/");
      return {
        langCode: lang,
        relativeSubpath: parent ? `${parent}/${baseName}.md` : `${baseName}.md`,
      };
    }
  }

  // 3. Fallback: If in a standard docs/lessons folder without explicit lang prefix, treat as German (de) primary
  if (normalized.includes("/lektionen/") || normalized.includes("/docs/")) {
    const idx = normalized.indexOf("/lektionen/");
    if (idx >= 0) {
      return {
        langCode: "de",
        relativeSubpath: normalized.slice(idx + 1), // "lektionen/..."
      };
    }
  }

  return null;
}

/**
 * Finds the corresponding file path in the target language among a list of known workspace files.
 */
export function findCorrespondingFilePath(
  currentFilePath: string,
  targetLangCode: string,
  allWorkspaceFiles: string[],
): string | null {
  if (!currentFilePath || allWorkspaceFiles.length === 0) return null;
  const currentInfo = detectLanguageFromPath(currentFilePath);
  const normalizedCurrent = normalizePath(currentFilePath);
  const targetCode = targetLangCode.toLowerCase();

  if (currentInfo) {
    const { langCode: currentLang, relativeSubpath } = currentInfo;
    if (currentLang === targetCode) return currentFilePath;

    // Search for file ending with targetCode + "/" + relativeSubpath
    // or (if target is 'de') either ending with "/de/" + subpath or plain subpath
    const candidates = [
      `/${targetCode}/${relativeSubpath}`,
      `/${targetCode.toUpperCase()}/${relativeSubpath}`,
    ];

    if (targetCode === "de") {
      candidates.push(`/${relativeSubpath}`); // Payer German is at /lektionen/... without /de/
    }

    for (const f of allWorkspaceFiles) {
      const normF = normalizePath(f);
      for (const cand of candidates) {
        if (normF.endsWith(cand)) {
          return f;
        }
      }
    }
  }

  // Fallback: simple string replacement of language folder (e.g. /en/ -> /de/)
  const currentLangMatch = normalizedCurrent.match(
    /\/([a-z]{2}(?:-[a-z]{2})?)\//i,
  );
  if (currentLangMatch) {
    const fromLang = currentLangMatch[1];
    const candidatePath = normalizedCurrent.replace(
      new RegExp(`/${fromLang}/`, "i"),
      `/${targetCode}/`,
    );
    const found = allWorkspaceFiles.find(
      (f) => normalizePath(f) === candidatePath,
    );
    if (found) return found;

    if (targetCode === "de") {
      const strippedPath = normalizedCurrent.replace(
        new RegExp(`/${fromLang}/`, "i"),
        "/",
      );
      const foundStripped = allWorkspaceFiles.find(
        (f) => normalizePath(f) === strippedPath,
      );
      if (foundStripped) return foundStripped;
    }
  }

  return null;
}

/**
 * Scans a list of workspace file paths and returns all distinct detected languages.
 */
export function detectWorkspaceLanguages(
  allWorkspaceFiles: string[],
): LanguageInfo[] {
  const foundCodes = new Set<string>();

  for (const f of allWorkspaceFiles) {
    const info = detectLanguageFromPath(f);
    if (info) {
      foundCodes.add(info.langCode);
    }
  }

  // Always include 'de' and 'en' if at least one language was found
  if (foundCodes.size > 0) {
    foundCodes.add("de");
    foundCodes.add("en");
  }

  return Array.from(foundCodes)
    .sort()
    .map((code) => ({
      code,
      label: KNOWN_LANGUAGES[code] || code.toUpperCase(),
    }));
}
