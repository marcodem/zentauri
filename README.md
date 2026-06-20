# Zentauri

Zentauri is a lightweight, simplified Markdown note-taking app, built as a minimal successor to ZenNotes. It retains the essential core features of ZenNotes, most importantly its extensive Markdown extensions, but leaves behind the Electron bloat in favor of Tauri.

## Tech Stack
- **Tauri** - Fast, lightweight, and secure cross-platform framework
- **Vue.js** - Reactive frontend framework
- **CodeMirror 6** - Extensible code editor
- **Tailwind CSS v4** - Utility-first styling
- **Unified / Remark / Rehype** - Powerful Markdown parsing and rendering with custom plugins

## Features
- Minimalistic Editor/Preview split view
- Extensively customized Markdown rendering:
  - Custom containers (e.g. `:::grammar-box`, `:::important`)
  - Semantic wiki-links and tags
  - Math expressions with KaTeX
  - Mermaid diagrams
  - GitHub Flavored Markdown (GFM)
  - Seamless local asset embedding (images, videos, PDFs)

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
