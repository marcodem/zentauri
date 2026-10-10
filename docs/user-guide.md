---
title: User Guide & Customization
---

# 📖 Zentauri User Guide

Zentauri is designed specifically for academic writing, knowledge management, and presentation of structured text (such as systematic grammars and linguistic paradigms).

::: tip Core Purpose & Layout Philosophy
* **Markdown to HTML:** The primary objective of Zentauri is compiling semantic Markdown into clean **HTML** (ideal for web publishings, online documentation, and digital text corpora).
* **Minimal Layouting:** Zentauri is an authoring tool rather than a desktop publishing suite. It provides a carefully selected set of extra Markdown syntax extensions (container boxes, text centering, indents, table line-breaks) to allow minimal, structured layout directly in text.
* **PDF Export:** While Zentauri includes a PDF export function, its role is paginating and printing the generated HTML document cleanly rather than providing a freeform DTP layout canvas.
:::

---

## 1. Interface & Navigation

- **Sidebar Toolbar:** Access the File Explorer, Workspace Search, Cheatsheet, and Settings via the left-side activity bar.
- **Split-Pane Layout:** Live synchronized split-view with CodeMirror 6 on the left and rendered Markdown preview on the right.
- **Interactive Knowledge Graph:** View bi-directional links between documents rendered as an interactive node graph.

---

## 2. Scholarly Syntax & Boxes

Zentauri supports scholarly block containers out-of-the-box:

::: grammar-box
**Grammar Paradigm Example:**
devo viṣṇuḥ = ⟪देवो⟫ ⟪विष्णुः⟫ = "Viṣṇu ist ein Gott."
:::

- **Sanskrit Typographics:** Wrapped in `《Sanskrit-Text》` or `⟪Text⟫` for automatic Devanāgarī font mapping.
- **Inline Highlights:** Direct inline visual cues using `:sig[Signal Text]` (signal red) and `:mark[Highlighted Text]` (amber yellow).
- **Line Breaks in Tables:** Use `:br` for clean line breaks inside markdown table cells without breaking table structure.

---

## 3. Custom Stylesheets (User Empowerment)

You can customize layout details and fonts using your own stylesheet. Zentauri will automatically look for and load a `custom.css` file from your application config directory:

1. **Locate `custom.css`:** Located in `~/.config/zentauri/custom.css` (Linux/macOS) or `%APPDATA%\zentauri\custom.css` (Windows).
2. **Apply CSS Overrides:** A starter template is automatically generated on first launch.
3. **Restart Zentauri:** Changes take effect immediately upon restarting.

### Example: Modifying the Grammar-Box
```css
/* Change the grammar-box to a light blue theme */
.vp-doc .custom-block.grammar-box,
.grammar-box {
  background-color: #f0f8ff !important;
  border-left-color: #0369a1 !important;
}
```

---

## 4. Creating New Syntax Elements

Thanks to `markdown-it-extensible`, defining new syntax elements is straightforward:

### Dynamic Inline Directives (Zero-Code)
You can use new inline markers on the fly without changing any application code:
```markdown
This is a :magic[special text].
```
This renders as `<span class="magic">special text</span>`. To style it, add `.magic` to your `custom.css`:
```css
.magic {
  color: #b45309;
  font-weight: bold;
}
```

### Dynamic Block Containers
Pre-registered custom containers (`custom1` to `custom5`) can be styled directly:
```markdown
::: custom1 [Custom Title]
Content of custom container.
:::
```
```css
.custom-block.custom1 {
  background-color: #fcf9f2;
  border-left: 4px solid #b45309;
  padding: 1rem;
}
```
