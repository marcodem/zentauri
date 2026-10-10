---
title: Release Notes
---

# 🚀 Zentauri Release Notes

### ZenTauri v1.2.0
- **QA Reference Dual-Document Modus:** Neuer Arbeitsmodus für vergleichende Textarbeit und Übersetzungskontrolle (`QaReferencePane.vue`). Bietet wählbare 2-Spalten- (Referenz links, Editor rechts) und 3-Spalten-Layouts (Referenz, Editor, Live-Vorschau) inklusive SWAP-Button zum sofortigen Seitentausch.
- **Intelligente Heading-Scroll-Synchronisation (`heading-sync.ts`):** Präziser Scroll-Abgleich basierend auf Markdown-Überschriften (`#`, `##`, `###`), der auch bei unterschiedlich langen Sprachversionen (z. B. Sanskrit-Original vs. deutsche Übersetzung) die Orientierung wahrt. Wählbare Modi: *Sync: Header*, *Sync: Percentage*, *Sync: Off*.
- **Automatischer Sprachdetektor & Korpusnavigation (`language-detector.ts`):** Automatische Erkennung paralleler Sprachversionen über Ordnerstrukturen (z. B. `/de/` ↔ `/en/`) oder Dateinamen (`doc_de.md` ↔ `doc_en.md`).
- **Harvard-Kyoto & IAST Sanskrit-Transliteration:** Vollständige bidirektionale Unterstützung für Harvard-Kyoto (HK) und IAST mit Devanāgarī. Schnelle Tastatur-Shortcuts `⌥⌘H` (HK) und `⌥⌘D` (IAST) sowie Menü-Buttons.
- **Tag-sichere Direktiven-Transliteration:** Intelligente Tag-Isolation für `:sig[...]` und `:mark[...]`, die Markup-Container vor Zerstörung schützt und den Text innerhalb und außerhalb der Tags verlässlich konvertiert.
- **Neue Statusleiste & Indikatoren (`StatusBar.vue`):** Interaktive Statusanzeigen für Zeilen/Spalten, Zeichen/Wörter, aktiven Scroll-Sync-Modus und schnelles Transliterations-Toggling.
- **Birchville „Scholarly Synthesis“ Standard:** Perfektionierte Pergament- und Deep-Ink-Farbpalette mit Frosted-Glass-Effekten und konsistenter Typografie.

---

### ZenTauri v1.1.23
- **Tab-Management & Schutz ungespeicherter Änderungen:** Schließen von modifizierten Tabs bei deaktiviertem Auto-Save blendet einen nativen 3-Wege-Dialog (Speichern, Nicht speichern, Abbrechen) via Tauri Dialog ein. Neues Kontextmenü per Rechtsklick auf Tabs (Schließen, Andere schließen, Rechts davon schließen, Pfad kopieren, Im Finder anzeigen).
- **Dateisystem-Synchronisation (Rust-First Watcher):** Einbindung des `notify`-Crates im Rust-Backend zur rekursiven Überwachung gemounteter Arbeitsbereiche. Änderungen werden über debouncte `workspace-fs-changed`-Events an das Frontend gestreamt, um den Dateibaum live zu synchronisieren.
- **Typst-PDF-Export & Sanskrit-Typografie:** Robuste Schriftarten-Kaskade für Devanagari (`Kohinoor Devanagari`, `Noto Sans Devanagari`, `Noto Serif Devanagari`, `Devanagari MT`) für fehlerfreie Ligaturen und Akzente. Einstellbare Papierformate (A4 / US Letter) im Einstellungsdialog.
- **Finder & CLI-Integration:** Beim Öffnen einer Datei über den Finder (Doppelklick) oder die Kommandozeile wird ein noch unberührter, leerer Entwurf automatisch ersetzt.
- **Performance & Code-Splitting:** Aufteilung schwerer Bibliotheken (Mermaid, KaTeX, Cytoscape), wodurch der Haupt-Bundle von 2.2 MB auf 491 kB optimiert wurde.

---

### ZenTauri v1.1.22
- **Sicherheit & Pfadvalidierung (PDF-Export):** Strikte Härtung von `export_pdf` gegen Path-Traversal und Arbitrary-File-Writes. Exportpfade werden auf Nullbytes, `.pdf`-Endung, sensible Konfigurationsdateien (`.ssh`, `.gnupg`, Shell-Configs) und geschützte Systemverzeichnisse validiert. Direkte Root-Schreibzugriffe werden blockiert.
- **Datenintegrität & SQLite-Bereinigung beim Löschen:** Implementierung des nativen Rust-Commands `delete_file_item`, der Dateien und Verzeichnisse löscht und atomar alle SQLite-Einträge sowie Kindelemente und Verlinkungen (`path LIKE (?1 || '/%')`) aus der Datenbank entfernt. `sync_directory` um rekursives Pruning gelöschter Ordnerinhalte erweitert.
- **Tauri-Capabilities bereinigt:** Widersprüchlichen und redundanten `fs:scope`-Block aus den App-Capabilities entfernt; `fs:read-all` und `fs:write-all` decken externe Arbeitsverzeichnisse ab.
- **Performance & Caching:** `markdownRenderCache` auf echte O(1)-LRU-Verwaltung umgestellt (Re-Insert bei Cache-Hit und O(1)-Eviction des ältesten Eintrags).
- **UX & App-Lebenszyklus:** `autoSave.cancel()` und deterministischer Zustandsabgleich in `onBeforeUnmount` und `beforeunload` verhindern den Verlust ungespeicherter Änderungen oder hängende Timer beim Beenden der Anwendung.
- **About-Dialog Build-Nummer:** Anzeige der Build-Nummer im About-Dialog und in den Einstellungen (`Version 1.1.22 (Build <N>)`) über `build.rs` und Git-Commit-Zähler.
- **Erweiterte Testabdeckung:** Neue automatisierte Tests für Link-Normalisierung und Container-Clicks in der Markdown-Vorschau (`Preview.test.ts`) sowie native Integrationstests für die PDF-Export-Pfadvalidierung (`test_features.rs`).

---

### ZenTauri v1.1.21
- **Release-Notes-Anzeige im Update-Popup & Einstellungen:** Erweiterung des Update-Popups um einen interaktiven Toggle („Was ist neu in vX.Y.Z?“), der die vom Updater bereitgestellten Markdown-Releasenotes anzeigt. Releasenotes werden über `renderMarkdown` sicher ohne Script- oder Container-Erweiterungen geparst und über DOMPurify sanitisiert gerendert. Auch im Einstellungsdialog werden die Releasenotes nun formatiert eingeblendet.
- **CI/CD-Härtung der Release-Pipeline:** Der `manifest`-Job wartet nun zwingend auf die erfolgreiche Beendigung des `release`-Jobs (`needs: release`) und verifiziert strikt die Existenz aller Signaturdateien (`.sig`) für Darwin, Windows und Linux, bevor das Update-Manifest `latest.json` publiziert wird.
- **UI- & Code-Bereinigung:** Entfernung ungenutzter Baum-Navigationsmethoden im Datei-Explorer, Behebung leerer Sidebar-Ansichten beim ersten App-Start und Bereinigung der VitePress-Container-Syntax in der Dokumentation.

---

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
