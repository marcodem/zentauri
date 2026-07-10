# Release Notes — ZenTauri v1.0.2

This release resolves navigation and sidebar state issues when opening/loading files, refines prompt naming conventions to match English standards, and optimizes the workspace layout structure for single-file editing.

## Fixed Issues & Enhancements (v1.0.2)

### 📂 Active Explorer Navigation & Focus
* **Automatic Sidebar Explorer Activation:** Opening or loading a file (via the open file dialog, creating a new file, or loading a workspace) now automatically switches the active sidebar panel to the File Explorer view.
* **Immediate Menu Creation Focus:** Creating a new file via the top application menu now automatically loads and focuses the new document in the editor.
* **Seamless State Transitions:** Fixed a state transition where the sidebar view would remain stuck on the "Cheatsheet", "Settings", or "Search" screens after opening a file, requiring users to manually toggle back to the explorer. The interface now dynamically switches to the File Explorer so users see their newly loaded file in context immediately.

### 💼 Workspace Layout & Usability
* **Workspace Independent File Explorer:** When files are loaded but no workspace folder is opened, the File Explorer sidebar now successfully renders the "Open Editors" list, allowing users to view and switch between open documents.
* **No Folder Opened Prompt:** A clean, non-obtrusive "No Folder Opened" panel with a button is displayed underneath the open editors list to encourage folder loading without cluttering the interface.

### ✍️ Prompt & Inline Creation Enhancements
* **Default Prompt Placeholders in English:** The prompts for creating a new file now default to `new_file.md` (instead of `neue_datei.md`) and directory creation defaults to `new_folder` (instead of `neuer_ordner`).
* **Smart Inline Input Selection:** When creating a new file inline, the cursor selection automatically spans only the filename base (`new_file`) and excludes the `.md` extension, allowing for quick typing and overriding.

---

# Release Notes — ZenTauri v1.0.1

This release addresses file system permission constraints and refines explorer behaviors to deliver a more stable user experience.

## Fixed Issues & Enhancements (v1.0.1)

### 📂 File System Permissions & Resiliency
* **Global File System Access:** Extended the workspace filesystem scope to allow access to the entire disk (`**`). This ensures folders and workspaces located on external volumes (such as `/Volumes/...`) or other system directories can be loaded seamlessly.
* **Graceful Missing Workspace Recovery:** If a previously saved workspace directory no longer exists (e.g., external drive disconnected), the application recovers gracefully and displays a clear error state in the sidebar explorer with an option to reopen a directory instead of crashing.
* **File Dialog Fallbacks:** Added an "All Files" (`*`) filter to file open/save dialogs to resolve a macOS-specific issue where Markdown documents were occasionally disabled or grayed out.

### 🔄 Synchronized Tab Transitions
* **Smart Explorer Selection:** Clicking files in the explorer tree or "Open Editors" list first checks if the document is already open in one of the active editor tabs. If so, it switches directly to that tab instead of reloading it from disk, safeguarding unsaved changes and correctly resolving virtual `untitled://` tabs.

### ✍️ Enabled Explorer Tools
* **Save All:** Enabled the Save All action icon within the "Open Editors" panel to save all modified files concurrently.
* **Expanded Context Menu:** "New File" and "New Folder" context actions are now active when right-clicking files, creating items in the same directory as the target file.
* **Auto-Open:** Newly created files are immediately opened in the editor upon confirmation.

---

# Release Notes — ZenTauri v1.0.0

We are excited to announce the official release of **ZenTauri v1.0.0**! This release ports the rich, scholarly Markdown capabilities from our ZenNotes heritage onto a lightweight, native Tauri foundation, complete with modern IDE utilities for Sanskrit scholars and linguists.

## Features & Highlights

### 📂 Premium IDE-Style File Explorer
* **Inline File Operations:** Create files, folders, or rename nodes inline using smooth text inputs that confirm on `Enter`/`Blur` and cancel on `Escape`.
* **File-Type Specific Icons:** Dedicated styling indicators for Markdown, PDFs, image assets, and configuration files.
* **Directory Utilities:** Toolbar shortcuts to collapse all directories and manually refresh the workspace tree.
* **Active Document Tracking:** Clicking an active tab automatically expands parent directories and highlights the corresponding file in the explorer.

### 🔍 Search in File Panel
* **Document-Level Search:** Accessible via the search icon in the Activity Bar.
* **Real-time Previews:** Displays matching lines with line numbers and highlights the query.
* **Case-Sensitivity Filter:** Toggle precise case matching.
* **Quick-Jump Integration:** Clicking a search result instantly scrolls CodeMirror 6 and anchors the cursor to that line.

### ✍️ Custom Scholarly Markdown Rendering
* **Sanskrit Devanagari Highlighting:** Automatically detects text wrapped in CJK double brackets `《Sanskrit-Word》` and highlights it in Sanskrit-Red.
* **Structural Containers:** Native support for standard Payer-compatible layout styles (`:::grammar-box`, `:::grammar-box2`, `:::important`, `:::note-box`) without header titles.
* **Scientific Extensions:** Full support for LaTeX math (via KaTeX), Mermaid diagrams, and GFM tables.
* **Local Asset Support:** Direct preview rendering of local images, videos, and PDFs.

### 🚀 CI/CD Builds & Distribution
* **Automated Packaging:** GitHub Actions automatically builds target installers on every version tag (`v*`):
  * **macOS:** Universal `.dmg` / `.app` (compatible with M1/M2/M3 and Intel).
  * **Windows:** Standalone `.msi` installers and `.exe` binaries.
  * **Linux:** Debian packages (`.deb`) and portable `AppImage` files.
* Compiled binaries are automatically uploaded as draft releases on GitHub.
