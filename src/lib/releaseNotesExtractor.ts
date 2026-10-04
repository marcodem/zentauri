/**
 * Extracts release notes for a given version/tag from docs/release-notes.md or RELEASE_NOTES.md.
 */
export function extractReleaseNotes(
  versionOrTag: string,
  docContent: string,
): string {
  const cleanVer = versionOrTag.replace(/^v/, "").trim();
  if (!cleanVer) return "";

  // 1. Try matching "### ZenTauri v1.2.3" in docs/release-notes.md
  const reDocs = new RegExp(
    `###\\s+ZenTauri\\s+v?${cleanVer.replace(/\./g, "\\.")}[\\s\\S]*?(?=(?:###\\s+ZenTauri|---\\s*###|$))`,
    "i",
  );
  const matchDocs = docContent.match(reDocs);
  if (matchDocs) {
    return matchDocs[0].replace(/^###[^\n]+\n+/, "").trim();
  }

  // 2. Try matching "# Release Notes — ZenTauri v1.2.3" in RELEASE_NOTES.md
  const reRoot = new RegExp(
    `#\\s+Release Notes[^\\n]+v?${cleanVer.replace(/\./g, "\\.")}[\\s\\S]*?(?=(?:#\\s+Release Notes|---\\s*#|$))`,
    "i",
  );
  const matchRoot = docContent.match(reRoot);
  if (matchRoot) {
    return matchRoot[0].replace(/^#[^\n]+\n+/, "").trim();
  }

  return "";
}
