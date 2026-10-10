---
title: Release Notes
---

# 🚀 Zentauri Release Notes

### ZenTauri v1.2.0
- **QA Reference Dual-Document Mode:** Dedicated side-by-side workspace comparison view (`QaReferencePane.vue`). Offers 2-column (Reference vs. Editor) and 3-column layouts (Reference, Editor, Live Preview) with instant SWAP functionality.
- **Intelligent Heading Scroll Synchronization (`heading-sync.ts`):** High-precision scroll alignment based on Markdown headings (`#`, `##`, `###`), preventing scroll drift across asymmetric translations (e.g. Sanskrit verse vs. expanded English/German commentary). Modes: *Sync: Header*, *Sync: Percentage*, *Sync: Off*.
- **Automatic Language Version Matching (`language-detector.ts`):** Heuristic detector that discovers matching language siblings across directory conventions (`/de/` ↔ `/en/`) and file naming suffixes (`_de.md` ↔ `_en.md`).
- **Harvard-Kyoto & IAST Sanskrit Transliteration:** Bidirectional conversion between Harvard-Kyoto (HK) and IAST with Devanāgarī. Global keyboard shortcuts `⌥⌘H` (HK) and `⌥⌘D` (IAST) plus toolbar triggers.
- **Tag-Safe Directive Transliteration:** Custom directive isolation for `:sig[...]` and `:mark[...]`, preserving markup containers while safely converting enclosed payload and surrounding prose.
- **Interactive Status Bar (`StatusBar.vue`):** Live indicators for line/column, character/word count, active scroll-sync mode, and one-click transliteration toggles.
- **Birchville "Scholarly Synthesis" Design:** Harmonized warm ivory & deep ink light mode, candlelit dark mode, and frosted-glass headers.

---

### ZenTauri v1.1.23
- **Tab Management & Unsaved Changes Protection:** Closing modified tabs with auto-save disabled opens a native 3-way dialog (Save, Don't Save, Cancel) via Tauri Dialog. New tab bar context menu on right-click (Close, Close Others, Close to the Right, Copy Path, Reveal in Finder).
- **Filesystem Synchronization (Rust-First Watcher):** Integrated the native Rust `notify` crate to recursively watch mounted workspaces. Streams debounced `workspace-fs-changed` events to keep the file tree in sync.
- **Typst PDF Export & Sanskrit Typography:** Robust Devanagari font cascade (`Kohinoor Devanagari`, `Noto Sans Devanagari`, `Noto Serif Devanagari`, `Devanagari MT`) for seamless ligatures and accents. Configurable page formats (A4 / US Letter) in Settings.
- **Finder & CLI Integration:** Double-clicking files in Finder or launching via CLI automatically replaces untouched empty drafts.
- **Performance & Code-Splitting:** Code-split heavy diagram and rendering libraries (Mermaid, KaTeX, Cytoscape), reducing the entry chunk from 2.2 MB to 491 kB.

---

### ZenTauri v1.1.22
- **Security & Path Validation (PDF Export):** Strict hardening of `export_pdf` against directory traversal and arbitrary writes. Validates null bytes, `.pdf` extension, sensitive directories (`.ssh`, `.gnupg`), and system roots.
- **Data Integrity & SQLite Cleanup on Deletion:** Native Rust command `delete_file_item` atomic deletion of files, folders, and SQLite records. Recursive directory synchronization with pruning.
- **Tauri Capabilities Cleaned:** Streamlined `fs:read-all` and `fs:write-all` capabilities.
- **Performance & LRU Caching:** Converted `markdownRenderCache` to true O(1) LRU eviction.
- **UX & Lifecycle State:** `autoSave.cancel()` and deterministic cleanup in `beforeunload` prevent dirty state drops or dangling timers.

---

### ZenTauri v1.1.21
- **Release Notes Display in Update Popup & Settings:** Interactive "What's new in vX.Y.Z?" accordion in update popup and Settings dialog, rendered with safe sanitization via DOMPurify.
- **CI/CD Hardening:** Updater manifest generation waits strictly on all release artifacts and cryptographic signatures across Darwin, Windows, and Linux.

---

### ZenTauri v1.1.20
- **Background Update Checks & 1-Click Installation:** Automatic check at launch (delayed by 4 seconds) and recurring every 4 hours. Frosted-glass notification banner with progress and 1-click relaunch.
- **Linux ARM64 Packaging:** Added native GitHub Actions packaging for `linux-aarch64` (AppImage and compressed archives).

---

### ZenTauri v1.1.19
- **Editor Data Integrity & Tab State:** Zero buffer drops on tab switching; autosave cleanly separated from auto-repair.
- **Security Sandbox:** Strict CSP without `unsafe-eval`; dynamically scoped filesystem access (`fs_scope().allow_directory`).
- **Typst PDF Math Formulae:** LaTeX math expressions translated into native Typst math syntax.
- **Live Preview Performance:** Migrated CodeMirror live preview to `ViewPlugin` with `view.visibleRanges` viewport virtualization.

---

### ZenTauri v1.1.18
- **macOS System Directory Protection:** Opening standalone files no longer mounts user home or Desktop as workspaces, eliminating TCC permission dialogs.
- **CLI & Working Directory Auto-Detection:** Automatically mounts current working directory when launched from terminal.
- **Birchville Design & Layout:** Cleaned up documentation layout, sidebar carets, and typography.
