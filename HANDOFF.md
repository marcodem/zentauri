# Handoff Zentauri (Stand 2026-10-10)

## Anlass
Prüfung, ob kramdown gegenüber markdown-it + markdown-it-extensible Vorteile bringt.
Ergebnis: **nein** (kramdown ist Ruby; Zentauri ist JS/TS mit Tauri/Vite/Vue/CodeMirror 6;
eigene Features hängen an markdown-it-Tokens, z. B. `data-source-line` über `token.map`,
KaTeX-Plugin, `:::`-Container). Ideen aus kramdown wurden stattdessen als markdown-it-Plugins übernommen.

## Geändert
- `package.json`: `markdown-it-footnote@^4`, `markdown-it-deflist@^4` ergänzt.
- `src/lib/markdown.ts`: beide Plugins in `createBaseMarkdownIt()` (gilt für Basis- und Extended-Modus).
- `src/lib/markdown.test.ts`: zwei neue Tests (Fußnoten inkl. Anker-IDs nach DOMPurify, Definitionslisten).
- `src/lib/syntax-cheatsheet.ts`: zwei Einträge in „Standard Markdown“ (`[^1] Footnote`, `Term : Definition`).
- `src/styles.css`: kleine `.prose`-Regeln für `.footnotes`, `.footnote-backref`, `dt`, `dd`.

Verifiziert: `npx vitest run` (79 Tests grün), `tsc --noEmit`, `biome check` ohne Befunde.

## Offen / nicht geprüft
- Optik der Fußnoten/Definitionslisten in der laufenden App nicht angesehen.
- Live-Preview im CodeMirror-Editor (`src/lib/editor-extensions/live-preview.ts`) kennt die neue Syntax nicht (keine Hervorhebung/Widgets).
- Typst-Export (`src/lib/typstConverter.ts`): Fußnoten und Definitionslisten werden dort nicht konvertiert (kommen als Rohtext).
- Weitere nicht gerenderte kramdown-ähnliche Features (Stand Test): Heading-IDs/TOC, `{::comment}`, `{::nomarkdown}`,
  Smart Typography, `~sub~`/`^sup^`, `==mark==`, Task-Listen, Auto-Links, Abkürzungen. Bei Bedarf als Plugins ergänzen
  (`markdown-it-anchor`, `-sub`, `-sup`, `-abbr`, `-task-lists`; `typographer: true`, `linkify: true`).
- Git-Repo; die Änderungen sind nicht committet.
