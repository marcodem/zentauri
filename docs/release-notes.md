---
title: Release Notes
---

# 🚀 Zentauri Release Notes

### ZenTauri v1.1.20
- **Update-Benachrichtigung & 1-Click-Aktualisierung:** Automatische Prüfung auf neue Versionen beim Start (nach 4 Sekunden, um den Editorstart nicht zu verzögern) sowie periodisch alle 4 Stunden im laufenden Betrieb. Dezentes Birchville-Frosted-Glass-Popup am unteren Bildschirmrand mit Versionsanzeige, Fortschrittsbalken und 1-Click-Neustart (`UpdateNotification.vue`). Temporäres Zurückstellen („Später“) wird sitzungsbasiert (`sessionStorage`) gespeichert.
- **Plattform- & CI/CD-Erweiterung für Linux ARM64:** GitHub Actions Release-Pipeline um native ARM64-Runner (`ubuntu-24.04-arm`) erweitert. ZenTauri wird nun auch nativ für `linux-aarch64` (AppImage und komprimiertes AppImage-Archiv) paketiert und im Tauri-Update-Manifest automatisch verlinkt.

---

### ZenTauri v1.1.19
- **Editor-Datenintegrität & Tab-Stabilität:** Pufferverlust bei Tab-Wechsel und Tab-Schließen behoben; deterministische Sicherung vor Wechseln und bei App-Beendigung (`beforeunload`); strikte Trennung von Autosave und Auto-Repair (Korrekturen erfolgen nur bei manuellem Speichern oder Tab-Wechsel, nie während des Tippens).
- **Sicherheit & Sandbox-Härtung:** Strikte Content Security Policy (CSP) ohne `unsafe-eval`; Tauri File-System-Scope auf Standardordner gehärtet mit dynamischer Workspace-Freigabe (`fs_scope().allow_directory`); Zugriff auf System- und Volume-Roots (`/Volumes`, `C:\`, `/System` etc.) sowie Traversals strikt blockiert; Mermaid-Diagramme auf `securityLevel: "strict"` gesetzt.
- **Typst PDF-Export & Formel-Engine:** Übersetzung von LaTeX-Mathematik in native Typst-Math-Syntax (`\frac`, `\cdot`, `\sum`, `\int`, griechische Buchstaben etc.); dynamische Code-Fence-Längen (`max + 1` Backticks); Fließtext-Doppelslashes `//` als `\/\/` maskiert; Codeblöcke vor Normalisierungsfiltern geschützt.
- **Knowledge-Graph & Navigation:** Klicks auf relative Markdown-Links in der Vorschau öffnen die Zieldatei im Editor statt einer Webview-Fehlernavigation; vollständige Normalisierung von Wikilinks und Markdown-Links im SQLite-Indexer und im Graph-Frontend.
- **Performance & Rendering:** CodeMirror Live-Preview auf `ViewPlugin` mit `view.visibleRanges` umgestellt (enorme Performance-Steigerung bei großen Dokumenten); Lookaround-RegEx für Kursivschrift verhindert fehlerhaftes Aufsplitten von `snake_case`; Mermaid-Rendering debounced (200 ms) mit Request-ID-Validierung.
- **Backend- & Plattformstabilität:** Menüeintrag „Ordner schließen“ (`CmdOrCtrl+Shift+W`) reaktiviert; SQLite mit WAL-Modus und 5-Sekunden Busy-Timeout; Indexer-Schutz mit Tiefenlimit (20 Ebenen) und Dateigrößen-Cap (2 MB); Windows- und macOS-Pfadtrenner sowie Zeichenvalidierung beim Umbenennen harmonisiert; Kindprozesse in `reveal_in_explorer` entkoppelt.

---

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
