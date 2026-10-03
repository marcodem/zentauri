---
layout: doc
title: Zentauri — Technical Wiki
---

# 🌌 Zentauri — Technical Documentation & Wiki

Welcome to the official technical documentation for **Zentauri**, the modern, ultra-fast scholarly Markdown editor.

::: note-box
Zentauri is a native desktop editor built on the **Tauri v2** framework. It combines a lightweight, blazingly fast **Rust backend** with a responsive **Vue 3 frontend**, providing a specialized authoring environment for academic writing, knowledge graphing, and high-quality PDF publishing.
:::

---

## 🏛️ Core Pillars

| Pillar | Technology | Goal |
| :--- | :--- | :--- |
| 🦀 **Rust-First Architecture** | Tauri v2, Rust, SQLite | Maximum performance, low memory footprint, and native OS integration |
| 📝 **Scholarly Editing** | Vue 3, CodeMirror 6, markdown-it-extensible | Split-pane editing, auto-repair, and specialized academic metadata |
| 🖨️ **Native PDF Export** | Typst (`typst-as-lib`) | Instant, high-quality PDF typesetting without headless browsers |
| 🕸️ **Knowledge Graph** | SQLite Indexing, `v-network-graph` | Visual, interactive mapping of interconnected markdown files |

---

## 📌 Dokumentations-Index

### 1. 📐 [System-Architektur](./system-architecture)
Ein tiefer Einblick in Zentauris Rust-First Dateihandling, IPC-Kommunikation, SQLite Workspace-Indexierung und den Verzicht auf schwere Node.js/Chromium-Abhängigkeiten.

### 2. 📝 [Editor Features & Scholarly Extensions](./scholarly-features)
Details zu den integrierten akademischen Werkzeugen: IAST- und Devanāgarī-Metadatenextraktion, benutzerdefinierte Container-Blöcke (`::: grammar-box`), mathematische Formeln und der interaktive Knowledge Graph.

---

::: tip-box
Über die linke Navigation kann jederzeit direkt zwischen den Kapiteln gewechselt werden.
:::
