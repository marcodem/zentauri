import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { extractReleaseNotes } from "./releaseNotesExtractor";

describe("Release Notes Extractor & Validator", () => {
  it("extracts valid multi-line release notes from docs/release-notes.md for current package version", () => {
    const docsPath = path.resolve(__dirname, "../../docs/release-notes.md");
    expect(fs.existsSync(docsPath)).toBe(true);

    const docsContent = fs.readFileSync(docsPath, "utf8");
    const notes = extractReleaseNotes(packageJson.version, docsContent);

    expect(notes).toBeTruthy();
    expect(notes.length).toBeGreaterThan(50);
    // Must contain bullet points
    expect(notes).toMatch(/[-*]\s+\*\*/);
    // Must not contain trailing separator
    expect(notes).not.toContain("---");
  });

  it("extracts valid notes from RELEASE_NOTES.md as fallback", () => {
    const rootPath = path.resolve(__dirname, "../../RELEASE_NOTES.md");
    expect(fs.existsSync(rootPath)).toBe(true);

    const rootContent = fs.readFileSync(rootPath, "utf8");
    const notes = extractReleaseNotes(packageJson.version, rootContent);

    expect(notes).toBeTruthy();
    expect(notes.length).toBeGreaterThan(50);
    expect(notes).toMatch(/###|\*/);
  });

  it("returns empty string when version is unknown", () => {
    const notes = extractReleaseNotes(
      "99.99.99",
      "### ZenTauri v1.0.0\n- Test",
    );
    expect(notes).toBe("");
  });
});
