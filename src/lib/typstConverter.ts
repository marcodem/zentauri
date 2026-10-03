import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
// @ts-ignore
import multimdTable from "markdown-it-multimd-table";

// Initialize a clean markdown-it instance specifically for Typst AST generation
const mdTypst = new MarkdownIt({ html: false }).use(multimdTable, {
  multiline: true,
  rowspan: true,
  headerless: true,
  multibody: true,
  autolabel: true,
});

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

CONTAINERS.forEach((name) => {
  mdTypst.use(container, name, {
    validate: (params: string) =>
      params.trim().match(new RegExp(`^${name}(?:\\s+(.*))?$`, "i")),
  });
});

function escapeTypst(text: string): string {
  // Escape Typst special characters: \ [ ] ( ) $ # * _ ~ `
  return text
    .replace(/\\/g, "\\\\")
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

function processInlineScholarly(text: string): string {
  // Convert 《Sanskrit》 -> #text(font: "SanskritFont")[Sanskrit]
  let res = text.replace(
    /[⟪《]([^⟫⟩》]+)[⟫⟩》](\s*\|\|?)?/g,
    (match, content, pipe) => {
      let danda = "";
      if (pipe) {
        danda = pipe.trim() === "||" ? "॥" : "।";
        danda = " " + danda;
      }
      return `#text(font: "Noto Sans Devanagari")[${escapeTypst(content)}${danda}]`;
    },
  );

  // Convert :sig[Text] -> #text(fill: red, weight: "bold")[Text]
  // We use regex replacement on the plain text
  res = res.replace(/:sig\[(.*?)\]/g, '#text(fill: red, weight: "bold")[$1]');

  // Convert :mark[Text] -> #highlight(fill: yellow)[Text]
  res = res.replace(/:mark\[(.*?)\]/g, "#highlight(fill: yellow)[$1]");

  // Convert :br
  res = res.replace(/:br\b/g, "\\\n");

  // Convert :indent
  res = res.replace(/:indent\b/g, "#h(1em)");

  return res;
}

export function convertMarkdownToTypst(markdown: string): string {
  // Apply table normalization as in markdown.ts
  let normalizedSrc = markdown
    .replace(/^([ \t]*)(:{3,})([a-zA-Z0-9_-]+)[ \t]+(\[)/gm, "$1$2$3$4")
    .replace(
      /^([ \t]*)(:{3,})[ \t]*([a-zA-Z0-9_-]+)[ \t]+([^\[\s\n\r][^\n\r]*)$/gm,
      "$1$2$3[$4]",
    )
    .replace(/^([ \t]*)(:{3,})[ \t]+([a-zA-Z0-9_-]+)/gm, "$1$2$3");

  const tokens = mdTypst.parse(normalizedSrc, {});
  let typstCode = `
#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
)
#set text(
  font: ("Linux Libertine", "Noto Sans Devanagari"),
  size: 11pt,
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
        if (m && m[1]) {
          title = `*${escapeTypst(m[1])}*\n\n`;
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
        typstCode += `]\n\n`;
      }
      continue;
    }

    switch (token.type) {
      case "heading_open":
        typstCode +=
          "=".repeat(parseInt(token.tag.replace("h", "")) || 1) + " ";
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
        const fence = token.content.includes("```") ? "````" : "```";
        typstCode += `${fence}${lang}\n${token.content}\n${fence}\n\n`;
        break;
      }
      case "table_open":
        inTable = true;
        // In Typst, we must define the columns explicitly.
        // Unfortunately, markdown-it token stream doesn't easily tell us column count upfront unless we look ahead.
        // We'll use a heuristic lookahead for the first tr_open.
        tableColsCount = 0;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === "th_open" || tokens[j].type === "td_open") {
            tableColsCount++;
          } else if (tokens[j].type === "tr_close" && tableColsCount > 0) {
            break;
          }
        }
        if (tableColsCount === 0) tableColsCount = 2; // fallback
        typstCode += `#table(columns: ${tableColsCount}, stroke: 0.5pt + luma(200),\n`;
        break;
      case "table_close":
        inTable = false;
        typstCode += `)\n\n`;
        break;
      case "thead_open":
      case "thead_close":
      case "tbody_open":
      case "tbody_close":
      case "tr_open":
      case "tr_close":
        break;
      case "th_open":
        typstCode += `  [*`;
        break;
      case "th_close":
        typstCode += `*],\n`;
        break;
      case "td_open":
        typstCode += `  [`;
        break;
      case "td_close":
        typstCode += `],\n`;
        break;
      case "math_inline":
        typstCode += `$${token.content}$`;
        break;
      case "math_block":
        typstCode += `$ ${token.content} $\n\n`;
        break;
      case "inline":
        if (token.children) {
          for (const child of token.children) {
            switch (child.type) {
              case "text":
                typstCode += processInlineScholarly(escapeTypst(child.content));
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
                typstCode += `$${child.content}$`;
                break;
              case "link_open": {
                const href = escapeTypstString(child.attrGet("href") || "");
                typstCode += `#link("${href}")[`;
                break;
              }
              case "link_close":
                typstCode += `]`;
                break;
              case "image": {
                const src = escapeTypstString(child.attrGet("src") || "");
                typstCode += `#image("${src}")`;
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
