---
title: Roadmap & Feature-Backlog
---

# 🗺️ Roadmap & Feature-Backlog

Dieses Dokument erfasst geplante Ausbau-Features, Architekturkonzepte und vorläufig zurückgestellte Funktionen für künftige Versionen (Ziel: **ZenTauri v2.0.0**).

---

## 📌 Statusübersicht der Features

| Funktion | Aktueller Status | Zielversion | Beschreibung |
| :--- | :--- | :--- | :--- |
| **QA Reference Dual-Pane** | ✅ **Aktiv (v1.2.0)** | v1.2.0 | 2- und 3-Spalten-Vergleich, Heading-Scroll-Sync, Seitentausch (SWAP) |
| **Harvard-Kyoto & IAST Shortcuts** | ✅ **Aktiv (v1.2.0)** | v1.2.0 | Bidirektionale Tastenkürzel `⌥⌘D` & `⌥⌘H` mit Tag-geschützter Transliteration |
| **Wissenschaftliche Fußnoten & Deflists** | ✅ **Aktiv (v1.2.0)** | v1.2.0 | Standard `[^1]` Fußnoten und `Begriff\n: Definition` Definitionslisten |
| **Nativer Typst-PDF-Compiler** | ⏳ **In Entwicklung** | v2.0.0 | Direkter Typst-Satz im Rust-Backend (`src-tauri`) ohne Browser-Drucker |
| **In-Editor Live-IME (Stufe 2)** | 📋 **Backlog / Konzipiert** | v2.0.0 | Echtzeit-Wandlung in `《...》` und Compose-Sequenzen im Fließtext |
| **Wissensgraph & Wikilinks** | 📋 **Backlog / Pausiert** | v2.0.0 | Re-Integration des Graphen, `[[`-Autovervollständigung und Cmd+Klick |

---

## 1. Nativer Typst-PDF-Compiler

- **Status:** In Entwicklung (`src-tauri` via `typst`- und `typst-pdf`-Crates)
- **Ziel:** Vollständige Ablösung der WebKit-basierten Druckfunktion durch blitzschnellen, nativen PDF-Satz direkt über die Typst-Compiler-Engine in Rust.

### Meilensteine:
1. **Direktes AST-Mapping:** Übersetzung von Markdown-Elementen in semantischen Typst-Code.
2. **Akademisches Satzlayout:** Automatische Paginierung, Ränder, Fußnoten und Devanāgarī-Schriftartenkaskaden.
3. **Plattformunabhängig & leicht:** Keine Chromium- oder Node.js-Abhängigkeiten.

---

## 2. In-Editor Live-IME (Stufe 2 des Hybridkonzepts)

- **Status:** Geplant / Architektur dokumentiert in [Sanskrit-Eingabearchitektur](./scholarly-input-architecture)
- **Ziel:** Kontextbezogene Echtzeit-Transliteration direkt im CodeMirror-Editor ohne Wechsel des Betriebssystem-Tastaturlayouts.

### Gliederung der Stufen:
- **Stufe 1 (Kanonische Speicherung):** ✅ *Aktiv* — Markdown-Dateien speichern immer standardkonformes IAST oder Unicode Devanāgarī.
- **Stufe 2 (In-Editor Live-IME):** 📋 *Geplant / Roadmap*
  - **Scope-basierter Live-IME:** Beim Tippen innerhalb von Sanskrit-Klammern (`《...》` oder `⟪...⟫`) wird 7-Bit Harvard-Kyoto (`kRSNaH`) in Echtzeit zu IAST (`kṛṣṇaḥ`) oder Devanāgarī (`कृष्णः`) transformiert.
  - **Compose-Sequenzen:** Schnelle Tastenkürzel im Fließtext (`.r` => `ṛ`, `-a` => `ā`, `~n` => `ñ` etc.).
- **Stufe 3 (Post-Hoc Transliteration):** ✅ *Aktiv* — Globale Shortcuts `⌥⌘D` und `⌥⌘H` für markierte Abschnitte.

> [!NOTE]
> **Kompatibilität mit OS-Tastaturlayouts:** Direkte Eingaben über installierte OS-Layouts (z. B. EasyUnicode) werden transparent durchgereicht und zu 100 % unterstützt.

---

## 3. Wissensgraph & Bidirektionale Wikilinks

- **Status:** Backlog (zur Verschlankung des Editors und Reduktion der Bundle-Größe um ~600 kB vorläufig aus der UI entfernt)
- **Komponenten:** `src/components/GraphView.vue`, `src-tauri/src/db.rs` (SQLite Workspace Indexer)

### Geplante Ausbaustufen bei Wiederaufnahme:
1. **Editor-Autovervollständigung für Wikilinks (`[[`):** Fuzzy-Suche beim Tippen von `[[` im CodeMirror-Editor.
2. **Quelltext-Navigation (`Cmd+Klick`):** Direktes Öffnen verlinkter Dateien per Tastaturklick.
3. **Backlinks-Inspektor:** Einblendung eingehender Referenzen in der Sidebar.
4. **Graph-Filter & Orphan-Erkennung:** Isolierung verwaister Notizen.
