import { renderMarkdown } from './src/lib/markdown.js';

const md = `
:::important
This is an important box
:::

\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;

console.log(renderMarkdown(md));
