import { describe, expect, it } from "vitest";
import {
  containsDevanagari,
  devanagariToHk,
  devanagariToIast,
  findSanskritWordRange,
  hkToDevanagari,
  iastToDevanagari,
  toggleHkTransliteration,
  toggleSchemeTransliteration,
  toggleTransliteration,
} from "./transliteration";

describe("transliteration", () => {
  it("detects Devanagari characters accurately", () => {
    expect(containsDevanagari("धर्म")).toBe(true);
    expect(containsDevanagari("dharma")).toBe(false);
    expect(containsDevanagari("kṛṣṇa")).toBe(false);
    expect(containsDevanagari("कृष्ण")).toBe(true);
  });

  it("converts IAST to Devanagari", () => {
    expect(iastToDevanagari("dharmaḥ")).toBe("धर्मः");
    expect(iastToDevanagari("kṛṣṇaḥ")).toBe("कृष्णः");
    expect(iastToDevanagari("saṃskṛtam")).toBe("संस्कृतम्");
    expect(iastToDevanagari("saṁskṛtam")).toBe("संस्कृतम्");
    expect(iastToDevanagari("śāntiḥ")).toBe("शान्तिः");
    expect(iastToDevanagari("vidyā")).toBe("विद्या");
  });

  it("converts Devanagari to IAST", () => {
    expect(devanagariToIast("धर्मः")).toBe("dharmaḥ");
    expect(devanagariToIast("कृष्णः")).toBe("kṛṣṇaḥ");
    expect(devanagariToIast("संस्कृतम्")).toBe("saṃskṛtam");
    expect(devanagariToIast("शान्तिः")).toBe("śāntiḥ");
  });

  it("toggles IAST bidirectionally back and forth", () => {
    const original = "dharmaḥ";
    const dev = toggleTransliteration(original);
    expect(dev).toBe("धर्मः");

    const back = toggleTransliteration(dev);
    expect(back).toBe(original);
  });

  it("converts Harvard-Kyoto to Devanagari", () => {
    expect(hkToDevanagari("dharmaH")).toBe("धर्मः");
    expect(hkToDevanagari("kRSNaH")).toBe("कृष्णः");
    expect(hkToDevanagari("saMskRtam")).toBe("संस्कृतम्");
    expect(hkToDevanagari("zAntiH")).toBe("शान्तिः");
    expect(hkToDevanagari("dharmakSetre")).toBe("धर्मक्षेत्रे");
  });

  it("converts Devanagari to Harvard-Kyoto", () => {
    expect(devanagariToHk("धर्मः")).toBe("dharmaH");
    expect(devanagariToHk("कृष्णः")).toBe("kRSNaH");
    expect(devanagariToHk("संस्कृतम्")).toBe("saMskRtam");
    expect(devanagariToHk("शान्तिः")).toBe("zAntiH");
    expect(devanagariToHk("धर्मक्षेत्रे")).toBe("dharmakSetre");
  });

  it("toggles Harvard-Kyoto bidirectionally back and forth", () => {
    const original = "dharmakSetre";
    const dev = toggleHkTransliteration(original);
    expect(dev).toBe("धर्मक्षेत्रे");

    const back = toggleHkTransliteration(dev);
    expect(back).toBe(original);
  });

  it("supports toggleSchemeTransliteration for both schemes", () => {
    expect(toggleSchemeTransliteration("kṛṣṇaḥ", "iast")).toBe("कृष्णः");
    expect(toggleSchemeTransliteration("कृष्णः", "iast")).toBe("kṛṣṇaḥ");
    expect(toggleSchemeTransliteration("kRSNaH", "hk")).toBe("कृष्णः");
    expect(toggleSchemeTransliteration("कृष्णः", "hk")).toBe("kRSNaH");
  });

  it("preserves brackets 《...》 and ⟪...⟫ in both schemes", () => {
    expect(toggleTransliteration("《dharma》")).toBe("《धर्म》");
    expect(toggleTransliteration("《धर्म》")).toBe("《dharma》");
    expect(toggleTransliteration("⟪kṛṣṇa⟫")).toBe("⟪कृष्ण⟫");
    expect(toggleTransliteration("⟪कृष्ण⟫")).toBe("⟪kṛṣṇa⟫");

    expect(toggleHkTransliteration("《dharma》")).toBe("《धर्म》");
    expect(toggleHkTransliteration("《धर्म》")).toBe("《dharma》");
    expect(toggleHkTransliteration("⟪kRSNa⟫")).toBe("⟪कृष्ण⟫");
    expect(toggleHkTransliteration("⟪कृष्ण⟫")).toBe("⟪kRSNa⟫");
  });

  it("preserves :sig[...] directives in both schemes", () => {
    expect(toggleTransliteration(":sig[kṛṣṇaḥ]")).toBe(":sig[कृष्णः]");
    expect(toggleTransliteration(":sig[कृष्णः]")).toBe(":sig[kṛṣṇaḥ]");

    expect(toggleHkTransliteration(":sig[kRSNaH]")).toBe(":sig[कृष्णः]");
    expect(toggleHkTransliteration(":sig[कृष्णः]")).toBe(":sig[kRSNaH]");
  });

  it("converts mixed text with directives correctly without corrupting tags or dropping outer text", () => {
    expect(iastToDevanagari("dharmaḥ :sig[kṛṣṇaḥ] śāntiḥ")).toBe(
      "धर्मः :sig[कृष्णः] शान्तिः",
    );
    expect(devanagariToIast("धर्मः :sig[कृष्णः] शान्तिः")).toBe(
      "dharmaḥ :sig[kṛṣṇaḥ] śāntiḥ",
    );
    expect(hkToDevanagari("dharmaH :mark[kRSNaH] zAntiH")).toBe(
      "धर्मः :mark[कृष्णः] शान्तिः",
    );
    expect(devanagariToHk("धर्मः :mark[कृष्णः] शान्तिः")).toBe(
      "dharmaH :mark[kRSNaH] zAntiH",
    );
  });

  it("finds Sanskrit/IAST/Devanagari word range around cursor", () => {
    const doc = "Text mit kṛṣṇaḥ und रामः hier.";
    // Cursor at 'ṛ' in kṛṣṇaḥ (index 10)
    const range1 = findSanskritWordRange(doc, 10);
    expect(range1).toEqual({ from: 9, to: 15 });
    expect(doc.slice(range1!.from, range1!.to)).toBe("kṛṣṇaḥ");

    // Cursor at 'म' in रामः (index 21)
    const range2 = findSanskritWordRange(doc, 21);
    expect(range2).not.toBeNull();
    expect(doc.slice(range2!.from, range2!.to)).toBe("रामः");

    // Cursor at punctuation / whitespace
    const range3 = findSanskritWordRange(doc, doc.length - 1); // '.'
    expect(range3).toBeNull();
  });
});
