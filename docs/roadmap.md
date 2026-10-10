---
title: Roadmap & Feature Backlog
---

# 🗺️ Roadmap & Feature Backlog

This document provides transparent tracking of features currently in development, architectural plans, and features parked in the backlog for future releases (target: **ZenTauri v2.0.0**).

---

## 📌 Implementation Status Overview

| Capability | Current Status | Target Milestone | Description |
| :--- | :--- | :--- | :--- |
| **QA Reference Dual-Pane** | ✅ **Active (v1.2.0)** | v1.2.0 | Side-by-side comparison (2-col / 3-col), heading scroll sync, swap control |
| **Harvard-Kyoto & IAST Hotkeys** | ✅ **Active (v1.2.0)** | v1.2.0 | Bidirectional shortcuts `⌥⌘D` & `⌥⌘H` with tag-safe directive isolation |
| **Academic Footnotes & Deflists** | ✅ **Active (v1.2.0)** | v1.2.0 | Standard `[^1]` footnotes and `Term\n: Definition` lists via markdown-it |
| **Native Typst PDF Compilation** | ⏳ **In Development** | v2.0.0 | Pure Rust Typst compilation in `src-tauri` without browser/WebKit print engine |
| **In-Editor Live IME (Stage 2)** | 📋 **Backlog / Conceived** | v2.0.0 | CodeMirror live conversion inside `《...》` and compose sequences in prose |
| **Knowledge Graph & Wikilinks** | 📋 **Backlog / Parked** | v2.0.0 | Re-integration of interactive graph, `[[` fuzzy autocomplete, and Cmd+Click |

---

## 1. Native Typst PDF Compilation

- **Status:** In Development (`src-tauri` via `typst` & `typst-pdf` crates)
- **Goal:** Completely replacing web-based HTML print rendering with instantaneous, publication-grade academic PDF typesetting powered directly by the native Typst compiler.

### Key Milestones:
1. **Direct AST Mapping:** Compiling Markdown AST elements into semantic Typst markup.
2. **Academic Layouts:** Automated page numbering, margins, footnotes, and Devanagari typography cascades.
3. **No Heavy Chromium/Node Dependencies:** Lightweight, cross-platform binary builds.

---

## 2. In-Editor Live IME (Stage 2 of Sanskrit Hybrid Framework)

- **Status:** Planned / Architecture documented in [Sanskrit Input Architecture](./scholarly-input-architecture)
- **Goal:** Context-aware real-time transliteration directly inside the CodeMirror 6 editor without switching operating system keyboard layouts.

### Planned Stages:
- **Stage 1 (Canonical Storage):** ✅ *Active* — Markdown source always persists standard IAST or Unicode Devanāgarī.
- **Stage 2 (In-Editor Live IME):** 📋 *Planned*
  - **Scope-Based Live IME:** While typing inside Sanskrit brackets (`《...》` or `⟪...⟫`), ASCII Harvard-Kyoto (`kRSNaH`) is converted to IAST (`kṛṣṇaḥ`) or Devanāgarī (`कृष्णः`) in real time.
  - **Compose Sequences:** Fast inline character sequences in running prose (`.r` => `ṛ`, `-a` => `ā`, `~n` => `ñ`, etc.).
- **Stage 3 (Post-Hoc Transliteration):** ✅ *Active* — Global shortcuts `⌥⌘D` and `⌥⌘H` for selection toggling.

> [!NOTE]
> **OS Keyboard Compatibility:** Direct input via OS keyboards (such as EasyUnicode or Mac Option-keys) is always passed through unmodified and will never be constrained by Stage 2.

---

## 3. Knowledge Graph & Bidirectional Wikilinks

- **Status:** Backlog (temporarily deactivated in active UI to reduce bundle size by ~600 kB)
- **Components:** `src/components/GraphView.vue`, `src-tauri/src/db.rs` (SQLite Workspace Indexer)

### Planned Enhancements upon Re-Activation:
1. **Editor Autocomplete for Wikilinks (`[[`):** Fuzzy document search popup when typing `[[` in CodeMirror.
2. **Direct Source Code Navigation (`Cmd+Click`):** Instant jumping to linked target files.
3. **Backlinks Inspector:** Dedicated sidebar panel for incoming cross-references.
4. **Graph Filters & Orphan Detection:** Isolate unlinked notes and filter by tags or folders.
