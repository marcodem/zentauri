# Zentauri

Zentauri is a lightweight (ca. 30MB on Mac), high-performance Markdown note-taking editor. Built with Tauri and Vue.js, it was first conceived as an extension to ZenNotes, but later built on a modern native desktop tech stack (Tauri -> ZenTauri). It combines native desktop performance with advanced scholarly Markdown rendering features specifically aligned with the Payer project (Sanskritkurs) standards.

If you wish to introduce your own Markdown syntax extensions, check out the help file under notes to developers.

---

## Tech Stack

- **Tauri** — Blazing fast desktop execution with a secure Rust backend.
- **Vue 3** — Highly reactive and responsive component-driven interface.
- **CodeMirror 6** — Modern, modular, and extensible editor experience.
- **Tailwind CSS v4** — Premium styling system with dark mode and custom palettes.
- **Unified / Remark / Rehype** — Custom AST-driven Markdown parsing and sanitization pipeline.

---

## Key Features

### 📂 Premium IDE-Style File Explorer

- **Popup-Free File Editing:** Create new files, folders, or rename existing nodes inline using smooth text fields that confirm on `Enter`/`Blur` and cancel on `Escape`.
- **File-Type Specific Icons:** Distinct visual cues for Markdown files, PDF documents, local images, and settings/config files.
- **Header Toolbar:** One-click shortcuts to **Collapse All** directory folders and **Refresh** the current workspace path.
- **Workspace Sync:** Clicking on open editor tabs automatically highlights and expands folders to reveal that file in the explorer tree.

### 🔍 Search in File Panel

- **Document-Level Search:** Accessible via the magnifying glass in the Activity Bar.
- **Live Previews:** Displays matching lines with line numbers and highlights the search term visually.
- **Case-Sensitivity Filter:** Toggle precise case matching.
- **Quick-Jump Integration:** Clicking a search result instantly scrolls CodeMirror 6 and anchors the cursor to that line.

### ✍️ Custom Scholarly Markdown Rendering

- **Sanskrit Devanagari Highlighting:** Matches word boundaries wrapped in CJK double brackets `《Sanskrit-Text》` and highlights them in Sanskrit-Red.
- **Custom Container Blocks:** Implements Payer-compatible style containers:
  - `:::grammar-box` (gold border)
  - `:::grammar-box2` (orange border)
  - `:::important` (purple border)
  - `:::note-box` (blue-grey border)
- **Scientific Extensions:** Full support for KaTeX math equations (inline & block), Mermaid structural diagrams, and GitHub Flavored Markdown (GFM) tables.
- **Local Asset Integration:** Renders local images, videos, and PDFs directly in the live preview.

---

## Development

### Prerequisites

Make sure you have Node.js and Rust/Cargo installed.

### Setup and Running Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the Tauri development server:

   ```bash
   npm run tauri dev
   ```

### Building for Production

To bundle Zentauri into a native desktop package (.app, .dmg, .msi, etc.):

```bash
npm run tauri build
```

## Releases & Build Artifacts

The desktop applications are automatically compiled via GitHub Actions with every release (triggered by pushing a version tag such as `v*`). The following installer files are generated as build artifacts:

- 🍎 **macOS:** Universal `.dmg` & `.app` (compatible with Apple Silicon M1/M2/M3 and Intel processors).
- 🪟 **Windows:** Standalone `.msi` installers and `.exe` binaries.
- 🐧 **Linux:** Debian package (`.deb`) and portable AppImage (`.AppImage`).

You can find the compiled binaries in the GitHub repository under the **Releases** tab.

---

## License

MIT
