import { describe, expect, it } from "vitest";
import {
  extractHeadings,
  findHeadingAtLine,
  interpolateTargetLine,
  matchCorrespondingHeading,
} from "./heading-sync";

describe("heading-sync", () => {
  const docA = `# Lektion 01: Einführung
Einleitender Text.

## 1. Das Alphabet
Hier stehen die Laute.

## 2. Lautlehre
Details zur Lautlehre.

### 2.1 Vokale
Die einfachen Vokale.
`;

  const docB = `# Lesson 01: Introduction
Introductory text which is longer in English.
More explanations here.

## 1. The Alphabet
Here are the phonemes.

## 2. Phonology
Detailed explanation of phonetics and sounds.
Extra paragraph for language nuances.

### 2.1 Vowels
Short and long vowels.
`;

  it("extracts markdown headings ignoring code fences", () => {
    const withFence = `${docA}\n\`\`\`markdown\n# Fake Header inside code\n\`\`\`\n`;
    const headings = extractHeadings(withFence);
    expect(headings.length).toBe(4);
    expect(headings[0].text).toBe("Lektion 01: Einführung");
    expect(headings[0].numberPrefix).toBe("lektion 01");
    expect(headings[1].text).toBe("1. Das Alphabet");
    expect(headings[1].numberPrefix).toBe("1.");
    expect(headings[2].text).toBe("2. Lautlehre");
    expect(headings[3].text).toBe("2.1 Vokale");
  });

  it("finds the active heading for a given line", () => {
    const headings = extractHeadings(docA);
    expect(findHeadingAtLine(headings, 1)?.text).toBe("Lektion 01: Einführung");
    expect(findHeadingAtLine(headings, 3)?.text).toBe("Lektion 01: Einführung");
    expect(findHeadingAtLine(headings, 4)?.text).toBe("1. Das Alphabet");
    expect(findHeadingAtLine(headings, 8)?.text).toBe("2. Lautlehre");
    expect(findHeadingAtLine(headings, 12)?.text).toBe("2.1 Vokale");
  });

  it("matches corresponding headings across languages via numbers or index", () => {
    const hA = extractHeadings(docA);
    const hB = extractHeadings(docB);

    // Number matching: "1. Das Alphabet" -> "1. The Alphabet"
    const match1 = matchCorrespondingHeading(hA[1], hB, hA);
    expect(match1).not.toBeNull();
    expect(match1?.target.text).toBe("1. The Alphabet");
    expect(match1?.matchType).toBe("number");

    // Number matching: "2.1 Vokale" -> "2.1 Vowels"
    const match21 = matchCorrespondingHeading(hA[3], hB, hA);
    expect(match21).not.toBeNull();
    expect(match21?.target.text).toBe("2.1 Vowels");
  });

  it("smoothly interpolates line position between matching headings", () => {
    const hA = extractHeadings(docA);
    const hB = extractHeadings(docB);

    // At line 1 (start) -> target line 1
    const targetAtStart = interpolateTargetLine(1, hA, hB, 15, 20);
    expect(targetAtStart).toBe(1);

    // At line of heading 1 (line 4 in docA) -> exactly target heading line (line 5 in docB)
    const targetAtH1 = interpolateTargetLine(hA[1].line, hA, hB, 15, 20);
    expect(targetAtH1).toBe(hB[1].line);
  });
});
