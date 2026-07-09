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

## Mathematics
Use \`$\` for inline math and \`$$\` for block math.
Einstein's equation: $E=mc^2$

Block:
$$
\\int_{a}^{b} x^2 \\,dx
$$

## Highlights & Super/Subscripts

Highlight text using \`==\`: ==This is highlighted==

**Signalrot:** Use \`:sig[Text]\` to make inline text bright red for emphasis: :sig[Achtung]

Superscripts use \`^^\`: 2^^10^^ = 1024

Subscripts use \`~\`: H~2~O is water.
`;

const advancedContent = `# Advanced Formatting

## Tables with Colspans
Standard Markdown tables don't support merging cells. Zentauri does!
Use \`>|\` in a cell to merge it with the cell to the left.

| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Merged across all 3 |>|>|

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

const developerGuideContent = `# Developer Guide: Extending Markdown

Zentauri uses \`unified\`, \`remark\`, and \`rehype\` to process Markdown into HTML. 
This makes it incredibly easy to add new syntax features.

## Architecture
The processing pipeline is defined in \`src/lib/markdown.ts\`.
1. **Remark:** Parses Markdown into a Markdown Syntax Tree (mdast).
2. **Remark Plugins:** Transforms the mdast (e.g. \`remark-math\` parses \`$math$\`).
3. **Rehype:** Converts the mdast into an HTML Syntax Tree (hast).
4. **Rehype Plugins:** Transforms the hast (e.g. \`rehype-katex\` converts math nodes to HTML).
5. **Stringify:** Outputs the final HTML string.

## How to add a new plugin

1. **Install the plugin:**
   \`\`\`bash
   npm install remark-your-plugin
   \`\`\`

2. **Import it in \`src/lib/markdown.ts\`:**
   \`\`\`typescript
   import yourPlugin from 'remark-your-plugin'
   \`\`\`

3. **Add it to the processor pipeline:**
   \`\`\`typescript
   const processor = unified()
     .use(remarkParse)
     .use(yourPlugin) // <-- Add it here!
     .use(remarkRehype, { allowDangerousHtml: true })
     // ...
   \`\`\`

## Creating custom directives
For custom block types like \`:::mybox\`, Zentauri uses \`remark-directive\`.
You can add handling for your new directive in the \`remarkCustomBoxes\` plugin found in \`src/lib/markdown.ts\`.

Simply look for the \`visit(tree, (node) => { ... })\` block and add your logic:
\`\`\`typescript
if (node.type === 'containerDirective' && node.name === 'mybox') {
  const data = node.data || (node.data = {})
  data.hName = 'div'
  data.hProperties = { className: ['md-box', 'md-box--mybox'] }
}
\`\`\`
Then add the styling for \`.md-box--mybox\` in \`src/custom-boxes.css\`.
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
  { id: 'welcome', title: 'Welcome', content: welcomeContent },
  { id: 'vim', title: 'Vim Mode', content: vimContent },
  { id: 'info_boxes', title: 'Info Boxes', content: infoBoxesContent },
  { id: 'scholarly', title: 'Scholarly & Math', content: scholarlyContent },
  { id: 'advanced', title: 'Advanced Formatting', content: advancedContent },
  { id: 'developer_guide', title: 'Developer Guide', content: developerGuideContent }
];
