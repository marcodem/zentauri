---
layout: doc
title: Zentauri — Technical Documentation
---

# 🌌 Zentauri — Technical Documentation

Welcome to the official documentation for **Zentauri**, the modern, ultra-fast Markdown editor designed for academic research, philological studies, and structured text corpora.

::: note-box
**Purpose & Layout Philosophy**:
The primary purpose of Zentauri is compiling **Markdown into clean, semantic HTML** (predestined for scholarly web corpora, digital editions, and VitePress documentations). 

While an integrated PDF export function is built-in, Zentauri is not intended as a desktop publishing suite (DTP): it deliberately provides a concise, carefully chosen set of Markdown syntax extensions (`::: grammar-box`, `::: note-box`, `::: center`, `:indent`, `:br`, table spans) that enable minimal, didactic layouting directly within the natural text flow.
:::

---

## 🎯 Primary Purpose: Markdown to HTML

Zentauri focuses on media-neutral text structuring:
1. **HTML as the Primary Target:** Text markup is transformed into standard-compliant, semantic HTML without formatting loss — ideal for websites, VitePress portals, and digital textbooks.
2. **Minimal In-Markdown Layouting:** Rather than pixel-pushing visual layouts, Zentauri provides a focused set of semantic directives (container boxes, text centering, indents, inline signal markers, and table line breaks).
3. **PDF Export:** The native PDF export engine paginates and prints the generated HTML for archiving and distribution, rather than serving as a complex manual layout designer.

---

## 🏛️ Core Architectural Pillars

| Pillar | Technology | Status & Objective |
| :--- | :--- | :--- |
| 🦀 **Rust-First Architecture** | Tauri v2, Rust, SQLite | **Active** — Maximum responsiveness, minimal memory footprint, and native OS integration |
| 📝 **Scholarly Editing** | Vue 3, CodeMirror 6, markdown-it-extensible | **Active** — Split-pane editing, QA dual-comparison, footnotes, silent auto-repair, and philological metadata |
| 🖨️ **Native PDF Export** | Typst (`typst-as-lib`) | **Roadmap** — Instantaneous, high-precision academic PDF typesetting natively in Rust without Chromium |
| 🕸️ **Knowledge Graph** | SQLite Indexing, `v-network-graph` | **Roadmap** — Visual constellation of bidirectional cross-references (indexing active, UI parked) |

---

## 📌 Documentation Overview

### Getting Started
- 💻 **[Installation & Setup](./installation)**: Step-by-step setup for macOS (Gatekeeper bypass), Windows, and Linux, plus seamless automatic updates.
- 📖 **[User Guide & Customization](./user-guide)**: Editor workflows, custom inline/block syntax creation, and styling via `custom.css`.

### Architecture & Specifications
- 📐 **[System Architecture](./system-architecture)**: Rust-first file explorer, IPC bridges, SQLite indexing, and native Typst PDF pipeline.
- ⌨️ **[Sanskrit Input Architecture](./scholarly-input-architecture)**: 3-stage hybrid input concept, in-editor live IME, and global transliteration hotkeys.
- 📝 **[Scholarly Features](./scholarly-features)**: Container blocks (`::: grammar-box`), footnotes, Devanāgarī font cascade, and QA dual-pane comparison mode.
- 📋 **[Roadmap & Backlog](./roadmap)**: Delineation of active v1.x core features versus planned v2.0.0 milestones.
- 🚀 **[Release Notes](./release-notes)**: Complete release history and feature highlights.

---

::: tip NAVIGATION
Use the left sidebar or the language selector in the top navigation bar to explore topics and switch languages.
:::
