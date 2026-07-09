# Zentauri

Zentauri is a lightweight, simplified Markdown note-taking app, built as a minimal successor to ZenNotes. It retains the essential core features of ZenNotes, most importantly its extensive Markdown extensions, but leaves behind the Electron bloat in favor of Tauri.

## Tech Stack
- **Tauri** - Fast, lightweight, and secure cross-platform framework
- **Vue.js** - Reactive frontend framework
- **CodeMirror 6** - Extensible code editor
- **Tailwind CSS v4** - Utility-first styling
- **Unified / Remark / Rehype** - Powerful Markdown parsing and rendering with custom plugins

## Features
- **Minimalistic Editor/Preview Split View**
- **IDE-Style File Explorer Sidebar:**
  - Inline file/folder creation and renaming (popup-free, with keyboard Enter/Esc/Blur confirmation).
  - Specific file icons for `.md` (Markdown), `.pdf` (PDF), images, and config files.
  - Toolbar controls to "Collapse All" folders and "Refresh" the workspace tree.
  - Focus-revealing: clicking active tabs expands parent folders and highlights that file in the tree.
- **Document-Specific Search Sidebar:**
  - Live search matches inside the active file with line numbers and preview snippets.
  - Case-sensitivity check.
  - Click-to-jump to instantly scroll and place the cursor on that line in CodeMirror 6.
- **Extensively Customized Markdown Rendering (Aligned with Payer):**
  - Custom containers (`:::grammar-box`, `:::grammar-box2`, `:::note-box`, `:::important`) matching the Payer stylesheet.
  - Explicit Sanskrit Devanagari markup (`《Wort》`) rendered in red.
  - Math expressions with KaTeX, Mermaid diagrams, and tables with colspans.
- **Local Asset Integration:** Seamlessly renders local images, videos, and PDFs inside notes.

## Development
To start the development server:
```sh
npm install
npm run tauri dev
```

To build for production:
```sh
npm run tauri build
```

## License
MIT
