export interface HelpChapter {
  id: string;
  title: string;
  content: string;
}

const welcomeContent = `# Welcome to Zentauri

This is your new Markdown home.
Zentauri combines the simplicity of markdown with powerful extensions like Mermaid and LaTeX.

## Shortcuts
- **Settings:** Click the ⚙️ icon to change themes or font sizes.
- **Help:** Click the ? icon to open this guide.
- **Vim Mode:** Toggle Vim mode from the toolbar if you prefer keyboard navigation.
- **Cheatsheet:** A quick reference to standard Markdown.

---
Checkout the other help files to learn about advanced extensions!
`;

const infoBoxesContent = `# Extended Info Boxes

Zentauri uses a special syntax to create visually distinct blocks, great for notes, tables, and warnings matching the Payer project format.

## Supported Payer Containers

Use the \`:::\` syntax to create a box.

:::important
This is an important box (violet). It renders as an \`aside\` element.
:::

:::grammarbox
This is a grammarbox (yellow/gold). Often used for Sanskrit grammar.
:::

:::grammarbox2
This is an advanced grammarbox (orange).
:::

:::note-box
This is a didactic note box (gray).
:::

You can also center content:
:::center
This text is centered.
:::

## Nesting Boxes

You can nest boxes inside each other. To do this, the outer box must have more colons than the inner box (e.g., 4 colons for the outer box, 3 for the inner box).

::::grammarbox
This is the outer box with 4 colons (\`::::grammarbox\`).

:::no-header
| Nested | Table |
|---|---|
| Inside | Box |
:::

::::
`;

const scholarlyContent = `# Scholarly & Math Extensions

Zentauri supports extended syntax for academic writing.

## Mathematics (KaTeX)
Use \`$\` for inline math and \`$$\` for block math. The math syntax follows **KaTeX** (standard LaTeX math subset).

- **Inline Math:** \`$E=mc^2$\` renders as $E=mc^2$
- **Square Root:** \`$\\sqrt{a^2 + b^2} = c$\` renders as $\\sqrt{a^2 + b^2} = c$
- **Exponents / Subscripts:** \`$2^{10} = 1024$\` renders as $2^{10} = 1024$ and \`$\\text{H}_2\\text{O}$\` renders as $\\text{H}_2\\text{O}$

### Block Math Example:
$$
\\int_{a}^{b} x^2 \\,dx = \\frac{b^3 - a^3}{3}
$$

## Extended Inline Formatting (Payer Standard)

- **Signalrot (Red Highlight):** Extended Markdown syntax \`:sig[Signalrot Text]\` renders as: :sig[Signalrot Text]
- **Gelber Leuchtstift (Marker):** Extended Markdown syntax \`:mark[Gelber Leuchtstift]\` renders as: :mark[Gelber Leuchtstift]
- **Sanskrit Formatting:** Extended Markdown syntax \`《संस्कृतम्》\` renders as: 《संस्कृतम्》
- **Inline Line Break:** Extended Markdown syntax \`:br\` inserts an in-cell line break.
- **Inline Indent:** Extended Markdown syntax \`:indent\` inserts an in-cell tab indentation.
`;

const advancedContent = `# Advanced Formatting

## Tables with Cell Merging (Rowspan & Colspan)
Zentauri supports MultiMarkdown table cell merging:

- **Vertical Merging (Rowspan):** Place \`| ^^ |\` in the cell directly below to merge it vertically.
- **Horizontal Merging (Colspan):** Place double/triple pipes \`|||\` or \`| text ||\` to merge cells horizontally across columns.

| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Spanning across 3 columns |||
| Rowspan Cell | Column B | Column C |
| ^^ | Column B2 | Column C2 |

## Mermaid Diagrams
Create flowcharts, sequence diagrams, and more using \`mermaid\` code blocks.

\`\`\`mermaid
graph TD
  A[Hard] -->|Text| B(Round)
  B --> C{Decision}
  C -->|One| D[Result 1]
  C -->|Two| E[Result 2]
\`\`\`
`;

const developerGuideContent = `# Developer Guide: Shared Syntax Architecture

Zentauri uses \`markdown-it\` and the shared \`markdown-it-extensible\` plugin as its core Markdown rendering engine. 
This guarantees 100% rendering compatibility across Zentauri, the VS Code Extension, and the Payer web application.

---

## Programmatic Documentation & Syntax API

\`markdown-it-extensible\` exports programmatic helper methods and constants that allow host applications (like Zentauri) to query active syntax definitions dynamically:

- **\`getSyntaxHelp()\`**: Returns structured JSON containing all active block containers, inline directives, and Sanskrit formatting rules.
- **\`DEFAULT_BLOCK_CONTAINERS\`**: Exported array of default container definitions (\`name\`, \`className\`).
- **\`DEFAULT_INLINE_DIRECTIVES\`**: Exported array of default inline directive definitions (\`name\`, \`className\`, \`tag\`).

---

## Full TypeScript Declarations (\`index.d.ts\`)

The plugin includes complete TypeScript typings (\`index.d.ts\`). Developers using \`markdown-it-extensible\` receive instant hover documentation, JSDoc explanations, and type-safe autocompletion in VS Code / WebStorm when configuring:

\`\`\`typescript
import mdIt from 'markdown-it';
import extensiblePlugin from 'markdown-it-extensible';

const md = mdIt().use(extensiblePlugin, {
  blockContainers: [
    { name: 'warning-box', className: 'alert-red' }
  ],
  inlineDirectives: [
    { name: 'badge', className: 'badge-blue', tag: 'span' }
  ]
});
\`\`\`

---

## Zero-Code Custom Inline Styling in Zentauri

Zentauri supports zero-code custom inline elements via CSS without modifying any parser code:

1. **Write any directive in Markdown:**  
   \`\`\`markdown
   This is a :my-custom-style[highlighted badge] in Zentauri.
   \`\`\`
   *(Unregistered directives automatically fall back to \`<span class="my-custom-style">Text</span>\`)*
2. **Style it in your theme CSS (\`src/payer-theme.css\`):**  
   \`\`\`css
   .my-custom-style {
     background-color: #e0e7ff;
     color: #3730a3;
     padding: 0.1em 0.4em;
     border-radius: 4px;
   }
   \`\`\`

---

> [!TIP]
> **Complete Plugin Documentation on GitHub:**  
> For complete instructions on publishing, customizing, or extending syntax elements, see the official repository:  
> **[markdown-it-extensible GitHub Documentation](https://github.com/marcodem/markdown-it-extensible#readme)**
`;

const vimContent = `# Vim Mode

Zentauri includes a full Vim emulator for power users who prefer keyboard-centric text editing. You can toggle this mode using the "Vim Mode" button in the top toolbar.

## Basic Modes
- **Normal Mode:** This is the default mode when Vim is active. Keys like \`j\` and \`k\` navigate instead of typing characters.
- **Insert Mode:** Press \`i\` or \`a\` to enter Insert Mode. Now you can type text normally.
- **Visual Mode:** Press \`v\` to start selecting text.

## Escaping Insert Mode
To return to Normal Mode from Insert or Visual mode, simply press the **\`Esc\`** key.

## Important Navigation Commands
| Key | Action |
|---|---|
| \`h\`, \`j\`, \`k\`, \`l\` | Move Left, Down, Up, Right |
| \`w\` / \`b\` | Jump forward / backward by one word |
| \`0\` / \`$\` | Jump to beginning / end of the line |
| \`gg\` / \`G\` | Jump to top / bottom of the document |

## Editing Commands
| Key | Action |
|---|---|
| \`x\` | Delete character under cursor |
| \`dd\` | Delete current line |
| \`yy\` | Yank (copy) current line |
| \`p\` | Paste after cursor |
| \`u\` / \`Ctrl+r\` | Undo / Redo |

> [!TIP]
> **Saving:** You can type \`:w\` and press Enter in Normal Mode to save your document, just like in a real Vim environment! Alternatively, \`Cmd+S\` (or \`Ctrl+S\`) always works.
`;

export const HELP_CHAPTERS: HelpChapter[] = [
  { id: "welcome", title: "Welcome", content: welcomeContent },
  { id: "vim", title: "Vim Mode", content: vimContent },
  { id: "info_boxes", title: "Info Boxes", content: infoBoxesContent },
  { id: "scholarly", title: "Scholarly & Math", content: scholarlyContent },
  { id: "advanced", title: "Advanced Formatting", content: advancedContent },
  {
    id: "developer_guide",
    title: "Developer Guide",
    content: developerGuideContent,
  },
];
