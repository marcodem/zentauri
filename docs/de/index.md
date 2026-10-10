---
layout: doc
title: Zentauri — Technische Dokumentation
---

# 🌌 Zentauri — Technische Dokumentation

Willkommen zur offiziellen Dokumentation für **Zentauri**, dem modernen, ultra-schnellen Markdown-Editor für akademische Arbeiten und wissenschaftliche Textkorpora.

::: note-box
**Zweck & Layout-Philosophie**:
Der primäre Zweck von Zentauri ist es, aus **Markdown sauberes, semantisches HTML herzustellen** (prädestiniert für wissenschaftliche Web-Korpora, Online-Editionen und VitePress-Dokumentationen). 

Zwar besteht eine integrierte PDF-Exportfunktion, Zentauri versteht sich jedoch nicht als mächtige Desktop-Publishing-Suite (DTP): Es bietet bewusst nur wenige, gezielte Markdown-Syntaxerweiterungen (`::: grammar-box`, `::: note-box`, `::: center`, `:indent`, `:br`, Tabellenspans), die ein minimales, didaktisches Layouten direkt im Textfluss erlauben.
:::

---

## 🎯 Primärzweck: Markdown zu HTML

Zentauri fokussiert sich auf die medienneutrale Strukturierung von Texten:
1. **HTML als primäres Zielformat:** Die Textauszeichnung wird verlustfrei und hochgradig standardisiert in HTML überführt – ideal für Webseiten, VitePress-Dokumentationen und digitale Lehrbücher.
2. **Minimales Layouting im Markdown:** Statt visueller Pixel-Schieberei gibt es eine kleine, feine Auswahl an semantischen Layout-Direktiven (Container-Boxen, Einrückungen, Inline-Signalmarkierungen und Textzentrierung).
3. **PDF-Export:** Die integrierte PDF-Funktion rendert das erzeugte HTML zur Weitergabe und Archivierung, ersetzt aber kein komplexes Satzprogramm für Print-Layouts.

---

## 🏛️ Kernsäulen

| Kernsäule | Technologie | Zielsetzung |
| :--- | :--- | :--- |
| 🦀 **Rust-First Architektur** | Tauri v2, Rust, SQLite | Maximale Performance, minimaler Speicherverbrauch und native OS-Integration |
| 📝 **Scholarly Editing** | Vue 3, CodeMirror 6, markdown-it-extensible | Split-Pane Editing, Silent Auto-Repair und akademische Metadaten |
| 🖨️ **Nativer PDF-Export** | Typst (`typst-as-lib`) | Blitzschneller, hochpräziser PDF-Satz ohne Chromium- oder Node.js-Ballast |
| 🕸️ **Knowledge Graph** | SQLite Indexing, `v-network-graph` | Interaktive Visualisierung von Dokumentenverknüpfungen und Wiki-Links |

---

## 📌 Dokumentationsübersicht

### Erste Schritte
- 💻 **[Installation & Setup](./installation)**: Anleitung für macOS (Gatekeeper-Freigabe), Windows und Linux sowie automatische Updates.
- 📖 **[Benutzerhandbuch & Custom CSS](./user-guide)**: Bedienung des Editors, Erstellen eigener Syntax-Elemente und Anpassung via `custom.css`.

### Architektur & Technik
- 📐 **[System-Architektur](./system-architecture)**: Rust-First File-Explorer, IPC-Kommunikation, SQLite-Indexierung und Typst-PDF-Pipeline.
- ⌨️ **[Sanskrit-Eingabearchitektur](./scholarly-input-architecture)**: 3-stufiges Hybridkonzept, In-Editor IME und Tastatur-Shortcuts.
- 📝 **[Scholarly Features](./scholarly-features)**: Container-Blöcke (`::: grammar-box`), Devanāgarī-Formatierung und QA-Vergleichsmodus.
- 🚀 **[Release Notes](./release-notes)**: Versionshistorie und Feature-Übersicht von v1.0 bis v1.2.0.

---

::: tip HINWEIS
Nutzen Sie die linke Navigationsleiste oder die Sprachauswahl im Kopfbereich, um direkt zwischen Themen und Sprachen zu wechseln.
:::
