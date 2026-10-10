import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
// @ts-ignore
import multimdTable from "markdown-it-multimd-table";
import { katexMathPlugin, normalizeMarkdownSource } from "./markdown";

// Initialize a clean markdown-it instance specifically for Typst AST generation
const mdTypst = new MarkdownIt({ html: false })
  .use(multimdTable, {
    multiline: true,
    rowspan: true,
    headerless: true,
    multibody: true,
    autolabel: true,
  })
  .use(katexMathPlugin);

const CONTAINERS = [
  "grammar-box",
  "grammarbox",
  "grammar-box2",
  "grammarbox2",
  "media",
  "center",
  "metrik-schema",
  "metrikschema",
  "important",
  "deleteme-box",
  "deletemebox",
  "literatur-box",
  "literatur",
  "note-box",
  "notebox",
  "laut-table",
  "lauttable",
  "indent",
  "compact",
  "no-header",
  "noheader",
  "gaga-box",
  "info",
  "tip",
  "warning",
  "danger",
  "details",
  "custom1",
  "custom2",
  "custom3",
  "custom4",
  "custom5",
];

for (const name of CONTAINERS) {
  mdTypst.use(container, name, {
    validate: (params: string) =>
      params.trim().match(new RegExp(`^${name}(?:\\s+(.*))?$`, "i")),
  });
}

function escapeTypst(text: string): string {
  // Escape Typst special characters: \ [ ] ( ) $ # * _ ~ ` and comments //
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\/\//g, "\\/\\/")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`")
    .replace(/~/g, "\\~")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/@/g, "\\@");
}

function escapeTypstString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function latexToTypstMath(latex: string): string {
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/\\(?:mathbf|textbf)\{([^}]+)\}/g, 'bold("$1")')
    .replace(/\\(?:mathit|textit)\{([^}]+)\}/g, 'italic("$1")')
    .replace(/\\text\{([^}]+)\}/g, '"$1"')
    .replace(/\\cdot/g, " dot ")
    .replace(/\\times/g, " times ")
    .replace(/\\le(?:q)?/g, " <= ")
    .replace(/\\ge(?:q)?/g, " >= ")
    .replace(/\\neq/g, " != ")
    .replace(/\\pm/g, " plus.minus ")
    .replace(/\\infty/g, " infinity ")
    .replace(/\\sum/g, " sum ")
    .replace(/\\prod/g, " product ")
    .replace(/\\int/g, " integral ")
    .replace(/\\partial/g, " partial ")
    .replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/\{([^{}]+)\}/g, "($1)");
}

function processInlineScholarly(rawText: string): string {
  const regex =
    /([⟪《][^⟫⟩》]+[⟫⟩》](?:\s*\|\|?)?)|(:sig\[.*?\])|(:mark\[.*?\])|(:br\b)|(:indent\b)/g;

  let lastIndex = 0;
  let result = "";

  for (const match of rawText.matchAll(regex)) {
    if (match.index > lastIndex) {
      result += escapeTypst(rawText.slice(lastIndex, match.index));
    }

    const matchedStr = match[0];
    if (match[1]) {
      // Sanskrit
      const sktMatch = matchedStr.match(/^[⟪《]([^⟫⟩》]+)[⟫⟩》](\s*\|\|?)?$/);
      if (sktMatch) {
        const content = sktMatch[1];
        const pipe = sktMatch[2];
        let danda = "";
        if (pipe) {
          danda = ` ${pipe.trim() === "||" ? "॥" : "।"}`;
        }
        result += `#text(font: ("Kohinoor Devanagari", "Noto Sans Devanagari", "Noto Serif Devanagari", "Devanagari MT"), fill: rgb("#b22222"))[${escapeTypst(content)}${danda}]`;
      } else {
        result += escapeTypst(matchedStr);
      }
    } else if (match[2]) {
      // :sig[Text]
      const sigContent = matchedStr.slice(5, -1);
      result += `#text(fill: rgb("#ff0000"), weight: "bold")[${escapeTypst(sigContent)}]`;
    } else if (match[3]) {
      // :mark[Text]
      const markContent = matchedStr.slice(6, -1);
      result += `#highlight(fill: yellow)[${escapeTypst(markContent)}]`;
    } else if (match[4]) {
      result += "\\\n";
    } else if (match[5]) {
      result += "#h(1em)";
    }

    lastIndex = match.index + matchedStr.length;
  }

  if (lastIndex < rawText.length) {
    result += escapeTypst(rawText.slice(lastIndex));
  }

  return result;
}

export interface TypstExportOptions {
  paper?: "a4" | "us-letter";
  margin?: { x?: string; y?: string };
  fontSize?: number;
  numbering?: string;
}

export function convertMarkdownToTypst(
  markdown: string,
  options?: TypstExportOptions,
): string {
  // Reuse code-fence safe normalization from markdown.ts
  const normalizedSrc = normalizeMarkdownSource(markdown, true);

  const tokens = mdTypst.parse(normalizedSrc, {});
  const paper = options?.paper ?? "a4";
  const marginX = options?.margin?.x ?? "2cm";
  const marginY = options?.margin?.y ?? "2.5cm";
  const fontSize = options?.fontSize ?? 11;
  const numbering = options?.numbering ?? "1";

  let typstCode = `
#set page(
  paper: "${paper}",
  margin: (x: ${marginX}, y: ${marginY}),
  numbering: "${numbering}",
)
#set text(
  font: ("Linux Libertine", "Times New Roman", "Kohinoor Devanagari", "Noto Sans Devanagari", "Noto Serif Devanagari", "Devanagari MT"),
  size: ${fontSize}pt,
)
#set par(justify: true)

`;

  let listNesting = 0;
  const listTypes: ("bullet" | "ordered")[] = [];
  let inTable = false;
  let tableColsCount = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type.startsWith("container_")) {
      const name = token.type
        .replace("container_", "")
        .replace("_open", "")
        .replace("_close", "");
      if (token.type.endsWith("_open")) {
        // Container open
        let title = "";
        const m = token.info
          .trim()
          .match(new RegExp(`^${name}\\s*\\[(.*?)\\]`, "i"));
        if (m?.[1]?.trim()) {
          title = `*${escapeTypst(m[1].trim())}*\n\n`;
        }

        let color = 'rgb("f8f9fa")'; // default gray
        let strokeColor = 'rgb("dee2e6")';

        if (name.includes("grammar")) {
          color = 'rgb("fffbeb")'; // yellow/amber
          strokeColor = 'rgb("f59e0b")';
        } else if (name === "important" || name.includes("danger")) {
          color = 'rgb("fef2f2")'; // red
          strokeColor = 'rgb("ef4444")';
        } else if (name === "info" || name.includes("custom1")) {
          color = 'rgb("f0fdfa")'; // teal
          strokeColor = 'rgb("14b8a6")';
        }

        typstCode += `#rect(width: 100%, fill: ${color}, stroke: (left: 4pt + ${strokeColor}), inset: 1em)[\n${title}`;
      } else {
        // Container close
        typstCode += "]\n\n";
      }
      continue;
    }

    switch (token.type) {
      case "heading_open":
        typstCode += `${"=".repeat(Number.parseInt(token.tag.replace("h", "")) || 1)} `;
        break;
      case "heading_close":
        typstCode += "\n\n";
        break;
      case "paragraph_open":
        break;
      case "paragraph_close":
        typstCode += "\n\n";
        break;
      case "blockquote_open":
        typstCode += "#quote(block: true)[\n";
        break;
      case "blockquote_close":
        typstCode += "]\n\n";
        break;
      case "bullet_list_open":
        listNesting++;
        listTypes.push("bullet");
        break;
      case "ordered_list_open":
        listNesting++;
        listTypes.push("ordered");
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        listNesting--;
        listTypes.pop();
        if (listNesting === 0) typstCode += "\n";
        break;
      case "list_item_open": {
        const indent = "  ".repeat(Math.max(0, listNesting - 1));
        const marker =
          listTypes[listTypes.length - 1] === "ordered" ? "+ " : "- ";
        typstCode += indent + marker;
        break;
      }
      case "list_item_close":
        typstCode += "\n";
        break;
      case "hr":
        typstCode += "#line(length: 100%, stroke: 0.5pt + luma(150))\n\n";
        break;
      case "code_block":
      case "fence": {
        const lang = (token.info || "").trim().split(/\s+/)[0];
        const backtickMatches = token.content.match(/`+/g) || [];
        let maxBackticks = 2;
        for (const m of backtickMatches) {
          if (m.length > maxBackticks) maxBackticks = m.length;
        }
        const fence = "`".repeat(maxBackticks + 1);
        typstCode += `${fence}${lang}\n${token.content}\n${fence}\n\n`;
        break;
      }
      case "table_open":
        inTable = true;
        tableColsCount = 0;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === "th_open" || tokens[j].type === "td_open") {
            const colspanAttr = tokens[j].attrGet("colspan");
            const span = colspanAttr
              ? Number.parseInt(colspanAttr, 10) || 1
              : 1;
            tableColsCount += span;
          } else if (tokens[j].type === "tr_close" && tableColsCount > 0) {
            break;
          }
        }
        if (tableColsCount === 0) tableColsCount = 2; // fallback
        typstCode += `#table(columns: ${tableColsCount}, stroke: 0.5pt + luma(200),\n`;
        break;
      case "table_close":
        inTable = false;
        typstCode += ")\n\n";
        break;
      case "thead_open":
      case "thead_close":
      case "tbody_open":
      case "tbody_close":
      case "tr_open":
      case "tr_close":
        break;
      case "th_open":
      case "td_open": {
        const isHeader = token.type === "th_open";
        const colspanAttr = token.attrGet("colspan");
        const rowspanAttr = token.attrGet("rowspan");
        const hasSpan = colspanAttr || rowspanAttr;

        let cellPrefix = "  ";
        if (hasSpan) {
          const parts: string[] = [];
          if (colspanAttr) parts.push(`colspan: ${colspanAttr}`);
          if (rowspanAttr) parts.push(`rowspan: ${rowspanAttr}`);
          cellPrefix += `table.cell(${parts.join(", ")})[`;
        } else {
          cellPrefix += "[";
        }
        if (isHeader) {
          cellPrefix += "*";
        }
        typstCode += cellPrefix;
        break;
      }
      case "th_close":
        typstCode += "*],\n";
        break;
      case "td_close":
        typstCode += "],\n";
        break;
      case "math_inline":
        typstCode += `$${latexToTypstMath(token.content)}$`;
        break;
      case "math_block":
        typstCode += `$ ${latexToTypstMath(token.content)} $\n\n`;
        break;
      case "inline":
        if (token.children) {
          for (const child of token.children) {
            switch (child.type) {
              case "text":
                typstCode += processInlineScholarly(child.content);
                break;
              case "strong_open":
                typstCode += "*";
                break;
              case "strong_close":
                typstCode += "*";
                break;
              case "em_open":
                typstCode += "_";
                break;
              case "em_close":
                typstCode += "_";
                break;
              case "code_inline": {
                const safeCode = child.content.replace(/`/g, "\\`");
                typstCode += `\`${safeCode}\``;
                break;
              }
              case "math_inline":
                typstCode += `$${latexToTypstMath(child.content)}$`;
                break;
              case "link_open": {
                const href = escapeTypstString(child.attrGet("href") || "");
                typstCode += `#link("${href}")[`;
                break;
              }
              case "link_close":
                typstCode += "]";
                break;
              case "image": {
                const src = escapeTypstString(child.attrGet("src") || "");
                // Only embed images with valid paths to prevent Typst engine crashes
                if (src.startsWith("http://") || src.startsWith("https://")) {
                  typstCode += `[#link("${src}")[Image]]`;
                } else if (
                  src &&
                  !src.startsWith("zen:") &&
                  !src.startsWith("zen-asset:")
                ) {
                  typstCode += `#image("${src}")`;
                }
                break;
              }
              case "softbreak":
                typstCode += " ";
                break;
              case "hardbreak":
                typstCode += "\\\n";
                break;
            }
          }
        }
        break;
    }
  }

  return typstCode;
}
