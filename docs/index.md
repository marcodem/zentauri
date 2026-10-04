---
layout: doc
title: Zentauri — Technical Documentation
---

# 🌌 Zentauri — Technische Dokumentation

Willkommen zur offiziellen Dokumentation für **Zentauri**, dem modernen, ultra-schnellen Markdown-Editor für akademische Arbeiten und wissenschaftliche Textkorpora.

::: note-box
Zentauri ist ein nativer Desktop-Editor auf Basis des **Tauri v2** Frameworks. Er kombiniert ein extrem schlankes, performantes **Rust-Backend** mit einem reaktiven **Vue 3 Frontend**, optimiert für wissenschaftliches Arbeiten, Wissensvernetzung und hochwertige PDF-Publikation.
:::

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
- 📝 **[Scholarly Features](./scholarly-features)**: Container-Blöcke (`::: grammar-box`), Devanāgarī-Formatierung und Knowledge-Graph.
- 🚀 **[Release Notes](./release-notes)**: Versionshistorie und Feature-Übersicht von v1.0 bis v1.1.20.

---

::: tip HINWEIS
Nutzen Sie die linke Navigationsleiste, um direkt zwischen den Kapiteln zu wechseln.
:::
