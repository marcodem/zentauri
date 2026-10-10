/**
 * Heading-based scroll synchronization for Dual-Document / QA comparison mode.
 */

export interface MarkdownHeading {
  level: number;
  text: string;
  cleanText: string;
  numberPrefix: string | null;
  line: number; // 1-based
}

/**
 * Extracts headings (# ... ######) from markdown source outside of code blocks.
 */
export function extractHeadings(markdown: string): MarkdownHeading[] {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const headings: MarkdownHeading[] = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();

      // Extract number prefix like "1.", "1.2", "§ 4", "Lektion 01" (optionally followed by colon or space)
      const numMatch = rawText.match(
        /^(?:§\s*\d+|[Ll]ektion\s*\d+|[Cc]hapter\s*\d+|\d+(?:\.\d+)*\.?)(?=[:\s]|$)/i,
      );
      const numberPrefix = numMatch ? numMatch[0].trim().toLowerCase() : null;

      // Cleaned text for matching
      const cleanText = rawText
        .replace(
          /^(?:§\s*\d+|[Ll]ektion\s*\d+|[Cc]hapter\s*\d+|\d+(?:\.\d+)*\.?)[:\s]*/i,
          "",
        )
        .replace(/[*_`~[\]]/g, "")
        .trim()
        .toLowerCase();

      headings.push({
        level,
        text: rawText,
        cleanText,
        numberPrefix,
        line: i + 1,
      });
    }
  }

  return headings;
}

/**
 * Finds the heading active at the given line number (highest heading line <= line).
 */
export function findHeadingAtLine(
  headings: MarkdownHeading[],
  line: number,
): MarkdownHeading | null {
  if (headings.length === 0) return null;
  let active: MarkdownHeading | null = null;
  for (const h of headings) {
    if (h.line <= line) {
      active = h;
    } else {
      break;
    }
  }
  return active || headings[0];
}

/**
 * Matches a source heading to a target heading list.
 */
export function matchCorrespondingHeading(
  source: MarkdownHeading,
  targetHeadings: MarkdownHeading[],
  allSourceHeadings: MarkdownHeading[],
): { target: MarkdownHeading; matchType: "text" | "number" | "index" } | null {
  if (targetHeadings.length === 0) return null;

  // 1. Text match (if cleanText is meaningful, >= 3 chars)
  if (source.cleanText.length >= 3) {
    const textMatch = targetHeadings.find(
      (th) =>
        th.cleanText.length >= 3 &&
        (th.cleanText === source.cleanText ||
          th.cleanText.includes(source.cleanText) ||
          source.cleanText.includes(th.cleanText)),
    );
    if (textMatch) {
      return { target: textMatch, matchType: "text" };
    }
  }

  // 2. Number prefix match (e.g., "1." or "Lektion 01" vs "Lesson 01")
  if (source.numberPrefix) {
    const numClean = source.numberPrefix.replace(/\D/g, "");
    if (numClean) {
      const numMatch = targetHeadings.find((th) => {
        if (!th.numberPrefix) return false;
        const thNum = th.numberPrefix.replace(/\D/g, "");
        return thNum === numClean;
      });
      if (numMatch) {
        return { target: numMatch, matchType: "number" };
      }
    }
  }

  // 3. Index match (same level and ordinal position)
  const sourceSameLevel = allSourceHeadings.filter(
    (h) => h.level === source.level,
  );
  const targetSameLevel = targetHeadings.filter(
    (h) => h.level === source.level,
  );
  const indexInLevel = sourceSameLevel.indexOf(source);

  if (indexInLevel >= 0 && indexInLevel < targetSameLevel.length) {
    return { target: targetSameLevel[indexInLevel], matchType: "index" };
  }

  // 4. Global index fallback
  const globalIndex = allSourceHeadings.indexOf(source);
  if (globalIndex >= 0 && globalIndex < targetHeadings.length) {
    return { target: targetHeadings[globalIndex], matchType: "index" };
  }

  return { target: targetHeadings[0], matchType: "index" };
}

/**
 * Interpolates target line position from source line based on surrounding matched headings.
 * Provides smooth, anchor-to-anchor interpolation across documents of different lengths.
 */
export function interpolateTargetLine(
  sourceLine: number,
  sourceHeadings: MarkdownHeading[],
  targetHeadings: MarkdownHeading[],
  totalSourceLines: number,
  totalTargetLines: number,
): number {
  if (totalSourceLines <= 1) return 1;
  if (totalTargetLines <= 1) return 1;

  if (sourceHeadings.length === 0 || targetHeadings.length === 0) {
    // Pure percentage fallback if no headings exist
    const ratio = Math.max(
      0,
      Math.min(1, (sourceLine - 1) / Math.max(1, totalSourceLines - 1)),
    );
    return Math.round(1 + ratio * (totalTargetLines - 1));
  }

  // Find prev heading and next heading in source
  let prevSourceIdx = -1;
  let nextSourceIdx = -1;

  for (let i = 0; i < sourceHeadings.length; i++) {
    if (sourceHeadings[i].line <= sourceLine) {
      prevSourceIdx = i;
    } else {
      nextSourceIdx = i;
      break;
    }
  }

  // Before first heading
  if (prevSourceIdx === -1 && nextSourceIdx !== -1) {
    const nextSource = sourceHeadings[nextSourceIdx];
    const match = matchCorrespondingHeading(
      nextSource,
      targetHeadings,
      sourceHeadings,
    );
    const targetAnchor = match ? match.target.line : targetHeadings[0].line;
    const progress =
      nextSource.line > 1 ? (sourceLine - 1) / (nextSource.line - 1) : 0;
    return Math.max(1, Math.round(1 + progress * (targetAnchor - 1)));
  }

  // After last heading
  if (prevSourceIdx !== -1 && nextSourceIdx === -1) {
    const prevSource = sourceHeadings[prevSourceIdx];
    const match = matchCorrespondingHeading(
      prevSource,
      targetHeadings,
      sourceHeadings,
    );
    const targetAnchor = match
      ? match.target.line
      : targetHeadings[targetHeadings.length - 1].line;
    const remainingSource = Math.max(1, totalSourceLines - prevSource.line);
    const progress = Math.max(
      0,
      Math.min(1, (sourceLine - prevSource.line) / remainingSource),
    );
    const remainingTarget = Math.max(0, totalTargetLines - targetAnchor);
    return Math.max(
      1,
      Math.min(
        totalTargetLines,
        Math.round(targetAnchor + progress * remainingTarget),
      ),
    );
  }

  // Between two headings
  if (prevSourceIdx !== -1 && nextSourceIdx !== -1) {
    const prevSource = sourceHeadings[prevSourceIdx];
    const nextSource = sourceHeadings[nextSourceIdx];
    const prevMatch = matchCorrespondingHeading(
      prevSource,
      targetHeadings,
      sourceHeadings,
    );
    const nextMatch = matchCorrespondingHeading(
      nextSource,
      targetHeadings,
      sourceHeadings,
    );

    const prevTargetLine = prevMatch ? prevMatch.target.line : 1;
    const nextTargetLine = nextMatch ? nextMatch.target.line : totalTargetLines;

    const sourceSpan = Math.max(1, nextSource.line - prevSource.line);
    const progress = Math.max(
      0,
      Math.min(1, (sourceLine - prevSource.line) / sourceSpan),
    );
    const targetSpan = nextTargetLine - prevTargetLine;

    return Math.max(
      1,
      Math.min(
        totalTargetLines,
        Math.round(prevTargetLine + progress * targetSpan),
      ),
    );
  }

  return 1;
}
