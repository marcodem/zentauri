---
title: Release Notes
---

# 🚀 Zentauri Release Notes

### ZenTauri v1.1.18
- **macOS Systempfad-Schutz & Standalone File Mode:** Das Öffnen von Einzeldateien erklärt den Elternordner (z. B. `~/Desktop`) nicht mehr zum Workspace und verhindert macOS-TCC-Sicherheitswarnungen.
- **Projekt-CWD-Erkennung:** Beim Start im Terminal oder dev-Modus wird das aktuelle Projektverzeichnis automatisch als Workspace erkannt und dessen `README.md` geöffnet.
- **CLI & Verzeichnispfad-Support:** Übergebene Ordner (z. B. `zentauri .`) werden korrekt als Workspace-Ordner eingehängt, Dateien als Tabs geladen.
- **Tab- & Workspace-Stabilität:** Ungespeicherte und Standalone-Tabs bleiben auch ohne aktiven Workspace-Ordner dauerhaft erhalten.
- **Birchville Design & Layout:** Sidebar-Gruppenüberschriften, Klapppfeile und Einrückungen harmonisiert; redundante Randspalten entfernt.

---

### ZenTauri v1.1.17
- **Plugin Update:** Updated `markdown-it-extensible` to 1.3.0 with automatic container nesting elevation (`adjustContainerNesting`).
- **Typst Native PDF Export:** High-performance direct PDF generation without headless browser dependencies.
- **Documentation Migration:** Full technical documentation integrated via VitePress into GitHub Pages.

---

### ZenTauri v1.1.16
- **New File Creation:** Fixed inline file tree node creation and focus management.
- **SQLite Workspace Indexing:** Fast local SQLite database for indexing markdown links, headings, and metadata.
- **Native Typst PDF Export:** Integrated `typst-as-lib` inside Tauri backend for instant PDF publishing.

---

### ZenTauri v1.1.0
- **Tauri v2 Auto-Updater:** In-app one-click update checking and installation.
- **Silent Auto-Repair on Save:** Automated fixing of unclosed container blocks (`:::`) and unclosed Sanskrit brackets (`《...》`).
- **markdown-it-extensible Integration:** Shared rendering engine across Zentauri, Payer, and VS Code.

---

### ZenTauri v1.0.6
- **Obsidian-Style File Explorer:** Native Rust-First IPC architecture with real-time quick filter, sorting, and drag & drop.
- **MultiMarkdown Table Cell Merging:** Rowspan (`| ^^ |`) and Colspan (`|| text |` / `| text ||`) support.
- **Dynamic Snippet Dropdown:** Adaptive Snippet Toolbar dropdown populated from cheatsheet categories.
