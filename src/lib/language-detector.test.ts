import { describe, expect, it } from "vitest";
import {
  detectLanguageFromPath,
  detectWorkspaceLanguages,
  findCorrespondingFilePath,
} from "./language-detector";

describe("language-detector", () => {
  const workspaceFiles = [
    "/Volumes/SanDisk1TB/proj/Payer/docs/lektionen/lektion01.md",
    "/Volumes/SanDisk1TB/proj/Payer/docs/lektionen/lektion02.md",
    "/Volumes/SanDisk1TB/proj/Payer/docs/en/lektionen/lektion01.md",
    "/Volumes/SanDisk1TB/proj/Payer/docs/en/lektionen/lektion02.md",
    "/Volumes/SanDisk1TB/proj/Payer/docs/it/lektionen/lektion01.md",
    "/Volumes/SanDisk1TB/proj/Payer/docs/hi/lektionen/lektion01.md",
    "/Volumes/SanDisk1TB/proj/Payer/docs/fr/lektionen/lektion01.md",
  ];

  it("detects language from directory path", () => {
    const enInfo = detectLanguageFromPath(
      "/Volumes/SanDisk1TB/proj/Payer/docs/en/lektionen/lektion01.md",
    );
    expect(enInfo).not.toBeNull();
    expect(enInfo?.langCode).toBe("en");
    expect(enInfo?.relativeSubpath).toBe("lektionen/lektion01.md");

    const itInfo = detectLanguageFromPath(
      "/Volumes/SanDisk1TB/proj/Payer/docs/it/lektionen/lektion01.md",
    );
    expect(itInfo?.langCode).toBe("it");

    const deInfo = detectLanguageFromPath(
      "/Volumes/SanDisk1TB/proj/Payer/docs/lektionen/lektion01.md",
    );
    expect(deInfo?.langCode).toBe("de");
    expect(deInfo?.relativeSubpath).toBe("lektionen/lektion01.md");
  });

  it("finds corresponding file in target language", () => {
    const current =
      "/Volumes/SanDisk1TB/proj/Payer/docs/en/lektionen/lektion01.md";

    // Target: de (original German without 'de' prefix in Payer)
    const targetDe = findCorrespondingFilePath(current, "de", workspaceFiles);
    expect(targetDe).toBe(
      "/Volumes/SanDisk1TB/proj/Payer/docs/lektionen/lektion01.md",
    );

    // Target: it
    const targetIt = findCorrespondingFilePath(current, "it", workspaceFiles);
    expect(targetIt).toBe(
      "/Volumes/SanDisk1TB/proj/Payer/docs/it/lektionen/lektion01.md",
    );

    // Target: hi
    const targetHi = findCorrespondingFilePath(current, "hi", workspaceFiles);
    expect(targetHi).toBe(
      "/Volumes/SanDisk1TB/proj/Payer/docs/hi/lektionen/lektion01.md",
    );
  });

  it("scans workspace files and extracts available languages", () => {
    const langs = detectWorkspaceLanguages(workspaceFiles);
    const codes = langs.map((l) => l.code);
    expect(codes).toContain("de");
    expect(codes).toContain("en");
    expect(codes).toContain("it");
    expect(codes).toContain("hi");
    expect(codes).toContain("fr");
  });
});
