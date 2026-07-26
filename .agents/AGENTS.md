# Project Rules
# Zentauri Projekt-Regeln
> [!IMPORTANT]
> Du bist der Agent für das Projekt Zentauri. Dies ist ein eigenständiger Editor.
> Zentauri nutzt das markdown-it-extensible für das Markdown-Rendering.
> Das Plugin liegt extern unter dem absoluten Pfad: `/Volumes/SanDisk1TB/proj/markdown-it-extensible`.
> Binde dieses Plugin immer lokal in die `package.json` von Zentauri ein (`file:/Volumes/SanDisk1TB/proj/markdown-it-extensible`). 
> Verändere NIEMALS Dateien innerhalb dieses Pfades, er ist Read-Only!
> Die PDF-Generierung aus Payer (Node.js/Playwright) wird NICHT übernommen, da dies die Architektur-Vorteile von Tauri (klein, nativ) zerstören würde. Für den PDF-Export wird eine Tauri-kompatible Lösung beibehalten.
> **PDF-Export Roadmap (Zukunftsmassnahme):** Wenn der PDF-Export umgesetzt wird, nutzen wir die Rust-Crate **Typst** (`typst` / `typst-pdf`) nativ im Tauri-Backend (`src-tauri`). Das Vue-Frontend übergibt AST/Template-Daten per Tauri-Command an Rust, welches das PDF ohne Playwright/Chromium-Ballast blitzschnell rendert.
> **Periodische Rust-Tooling Überwachung:** Überwache wöchentlich die Fortschritte im JS-Tooling-Ökosystem bezüglich des Übergangs zu Rust-basierten Komponenten (z. B. Vite / Rolldown, Oxc, Biome, Typst, WASM Markdown-Parser) und schlage bei relevanten Neuerungen entsprechende Architektur-Optimierungen für Zentauri vor.
> **Rust-First File-Explorer Architektur:** Das File-Handling und die Dateibaum-Verwaltung (Sortierung, Dateisystem-Analysen, Metadaten-Extraktion) werden primär als schlanke IPC-Schnittstellen gegen das Rust-Backend (`src-tauri`) konzipiert. Das JS/Vue-Frontend dient rein als UI-Präsentationsschicht ("Dumb UI"). Es dürfen KEINE schweren Node.js-spezifischen Dateisystem-Libraries verwendet werden, um maximale Kompatibilität mit zukünftigen Rust-Toolchains (Rolldown, Oxc, Biome) und WASM zu garantieren.