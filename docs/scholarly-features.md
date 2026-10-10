---
title: Editor Features & Scholarly Extensions
---

# 📝 Editor Features & Scholarly Extensions

Zentauri integrates custom extensions on top of `markdown-it-extensible` to support complex academic typesetting needs out-of-the-box, ensuring a streamlined authoring flow without context-switching.

---

## 1. Advanced Markdown Extensions

We've extended the standard markdown parser to support unique semantic blocks crucial for grammatical descriptions and literary analysis:

- **Scholarly Blocks:** Custom containers like `::: grammar-box`, `::: note-box`, and `::: important`.
- **Inline Sanskrit Typographics:** Support for special inline syntax like `《Sanskrit》` mapping perfectly to custom fallback fonts (e.g., Noto Sans Devanagari) during rendering.
- **Visual Signals:** Direct inline highlights using `:sig[Signal]` and `:mark[Highlight]`.
- **Math & Equations:** Native MathJax/KaTeX syntax `$e^{i\pi} + 1 = 0$` mapped to Typst math environments.
- **Mermaid Diagrams:** Fully supported in the editor live preview.

---

## 2. Interactive Knowledge Graph

Zentauri parses and extracts document connections dynamically:

- Support for bi-directional `[[Wiki Links]]` and standard relative markdown links `[Label](./file.md)`.
- Powered by `v-network-graph` in the frontend, generating a visual, interactive constellation of your notes and scholarly research.
- Double-clicking nodes dynamically navigates your editor straight to the source file.

---

## 3. Auto-Repair & Intelligent Workflows

Zentauri features a built-in Javascript-based syntax repair utility (`auto-repair.ts`) that runs seamlessly and silently on every document save:

- **Silent Auto-Repair:** Fixes minor syntax inconsistencies (like broken container boundaries or malformed YAML) automatically.
- **Visual Feedback:** A subtle UI indicator in the top toolbar verifies that the syntax was repaired without intrusive popups.

---

## 4. Metadata Display

The file explorer natively hooks into the SQLite backend to fetch and display intelligent YAML metadata. Instead of just file names, the explorer dynamically displays parsed document `title`s and visual badges representing localized content (`IAST`, `Devanagari`).

---

## 5. QA-Vergleichsmodus & Synchron-Scrollen

Für Übersetzer, Lektoren und vergleichende Textanalysen (nach Vorbild des Payer QA Viewers):

- **Dual- & Triple-Pane (2-Col / 3-Col):** Parallele Anzeige einer Referenzdatei links neben dem CodeMirror-Editor (2-Col) bzw. mit zusätzlicher Live-Vorschau rechts (3-Col).
- **SWAP-Funktion:** Schneller Seitentausch von Referenz- und Arbeitsdokument mit einem Klick.
- **Heading-basiertes Synchron-Scrollen:** Intelligente Verknüpfung über Markdown-Überschriften (`#`, `##`, `###`), Nummernpräfixe und relative Interpolation – kein Desynchronisieren bei unterschiedlich langen Sprachfassungen. Umschaltbar zwischen *Sync: Header*, *Sync: Percentage* und *Sync: Off*.
- **Parallele Sprachnavigation:** Automatische Erkennung paralleler Sprachversionen (z. B. `de/` ↔ `en/`) und Ein-Klick-Auswahl passender Referenzdokumente im Workspace.

