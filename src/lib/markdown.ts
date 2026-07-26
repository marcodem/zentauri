import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import markdownItAttrs from "markdown-it-attrs";
// @ts-ignore
import multimdTable from "markdown-it-multimd-table";
import katex from "katex";
// @ts-ignore
import * as extensiblePluginModule from "markdown-it-extensible";
const extensiblePlugin =
  (extensiblePluginModule as any).default || extensiblePluginModule;
import "markdown-it-extensible/css";
import { recordRendererPerf } from "./perf";

const URI_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const ALLOWED_RENDERED_URI_SCHEME_RE =
  /^(?:https?|mailto|zen|zen-asset|blob|data):/i;
const ALLOWED_RENDERED_URI_RE =
  /^(?:(?:https?|mailto|zen|zen-asset|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
const ALLOWED_RENDERED_DATA_ATTRS = [
  "data-callout",
  "data-function-plot-source",
  "data-jsxgraph-source",
  "data-local-asset-href",
  "data-local-asset-kind",
  "data-local-asset-url",
  "data-mermaid-source",
  "data-resolved-path",
  "data-tag",
  "data-tikz-source",
  "data-zen-diagram-expanded",
  "data-zen-diagram-kind",
  "data-zen-diagram-source",
  "translate",
  "lang",
  "rowspan",
  "colspan",
];

let sanitizerHooksInstalled = false;

let purifiedInstance: any = null;

function getPurify(): any {
  if (purifiedInstance) return purifiedInstance;

  const raw = (DOMPurify as any).default || DOMPurify;
  if (typeof raw?.sanitize === "function") {
    purifiedInstance = raw;
    return purifiedInstance;
  }
  if (typeof raw === "function") {
    const win =
      typeof window !== "undefined"
        ? window
        : typeof globalThis !== "undefined"
          ? (globalThis as any).window
          : null;
    if (win) {
      purifiedInstance = raw(win);
      return purifiedInstance;
    }
  }
  purifiedInstance = raw;
  return purifiedInstance;
}

function ensureSanitizerHooks(): void {
  if (sanitizerHooksInstalled) return;
  try {
    const purify = getPurify();
    if (purify && typeof purify.addHook === "function") {
      purify.addHook("uponSanitizeAttribute", (_node: any, data: any) => {
        if (
          data.attrName !== "href" &&
          data.attrName !== "src" &&
          data.attrName !== "xlink:href"
        ) {
          return;
        }
        const value = data.attrValue?.trim();
        if (
          value &&
          URI_SCHEME_RE.test(value) &&
          !ALLOWED_RENDERED_URI_SCHEME_RE.test(value)
        ) {
          data.keepAttr = false;
        }
      });
      sanitizerHooksInstalled = true;
    } else if (typeof window !== "undefined") {
      console.warn("DOMPurify instance does not support addHook");
    }
  } catch (e) {
    console.warn("Could not install DOMPurify hook:", e);
  }
}

const MATHML_TAGS = [
  "annotation",
  "annotation-xml",
  "math",
  "mrow",
  "mi",
  "mn",
  "mo",
  "ms",
  "mspace",
  "mtext",
  "menclose",
  "merror",
  "mfenced",
  "frac",
  "mfrac",
  "mpadded",
  "mphantom",
  "mroot",
  "msqrt",
  "mstyle",
  "mmultiscripts",
  "mover",
  "munder",
  "munderover",
  "mtable",
  "mtr",
  "mtd",
  "semantics",
  "svg",
  "path",
  "use",
  "g",
  "line",
  "rect",
  "circle",
];

function sanitizeRenderedHtml(html: string): string {
  ensureSanitizerHooks();
  try {
    const purify = getPurify();
    if (!purify || typeof purify.sanitize !== "function") {
      return html;
    }
    return purify.sanitize(html, {
      ALLOW_DATA_ATTR: true,
      ALLOW_ARIA_ATTR: true,
      ALLOWED_URI_REGEXP: ALLOWED_RENDERED_URI_RE,
      ADD_ATTR: ALLOWED_RENDERED_DATA_ATTRS,
      ADD_TAGS: MATHML_TAGS,
    });
  } catch (e) {
    console.warn("DOMPurify sanitize failed:", e);
    return html; // fallback
  }
}

const MARKDOWN_RENDER_CACHE_LIMIT = 24;
const markdownRenderCache = new Map<string, string>();

const md = new MarkdownIt({ html: true })
  .use(multimdTable, {
    multiline: true,
    rowspan: true,
    headerless: true,
    multibody: true,
    autolabel: true,
  })
  .use(markdownItAttrs)
  .use(extensiblePlugin);

// Custom KaTeX Math Plugin
function katexMathPlugin(mdInstance: any) {
  // Inline math rule: $...$
  mdInstance.inline.ruler.after(
    "escape",
    "math_inline",
    (state: any, silent: boolean) => {
      if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
      if (state.src.charCodeAt(state.pos + 1) === 0x24 /* $$ */) return false;

      const start = state.pos + 1;
      let match = start;
      while ((match = state.src.indexOf("$", match)) !== -1) {
        if (state.src.charCodeAt(match - 1) !== 0x5c /* \ */) {
          break;
        }
        match++;
      }

      if (match === -1) return false;
      const content = state.src.slice(start, match);

      if (!silent) {
        const token = state.push("math_inline", "math", 0);
        token.content = content;
      }

      state.pos = match + 1;
      return true;
    },
  );

  // Block math rule: $$...$$
  mdInstance.block.ruler.after(
    "blockquote",
    "math_block",
    (state: any, startLine: number, endLine: number, silent: boolean) => {
      const startPos = state.bMarks[startLine] + state.tShift[startLine];
      const maxPos = state.eMarks[startLine];

      if (startPos + 2 > maxPos) return false;
      if (state.src.slice(startPos, startPos + 2) !== "$$") return false;

      let nextLine = startLine;
      let content = "";

      const restOfLine = state.src.slice(startPos + 2, maxPos).trim();
      if (restOfLine.endsWith("$$") && restOfLine.length >= 2) {
        content = restOfLine.slice(0, -2);
        nextLine = startLine;
      } else {
        let foundEnd = false;
        const lines: string[] = [];
        if (restOfLine) lines.push(restOfLine);

        while (++nextLine < endLine) {
          const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
          const lineEnd = state.eMarks[nextLine];
          const lineText = state.src.slice(lineStart, lineEnd).trim();

          if (lineText === "$$" || lineText.endsWith("$$")) {
            foundEnd = true;
            if (lineText !== "$$") {
              lines.push(lineText.slice(0, -2).trim());
            }
            break;
          }
          lines.push(lineText);
        }

        if (!foundEnd && silent) return false;
        content = lines.join("\n");
      }

      if (!silent) {
        const token = state.push("math_block", "math", 0);
        token.block = true;
        token.content = content;
        token.map = [startLine, nextLine + 1];
      }

      state.line = nextLine + 1;
      return true;
    },
  );

  // Renderers
  mdInstance.renderer.rules.math_inline = (tokens: any[], idx: number) => {
    try {
      return katex.renderToString(tokens[idx].content, {
        displayMode: false,
        throwOnError: false,
      });
    } catch (err) {
      return `<span class="text-red-500 font-mono">${mdInstance.utils.escapeHtml(tokens[idx].content)}</span>`;
    }
  };

  mdInstance.renderer.rules.math_block = (tokens: any[], idx: number) => {
    try {
      return `<div class="katex-block my-4 flex justify-center">${katex.renderToString(tokens[idx].content, { displayMode: true, throwOnError: false })}</div>`;
    } catch (err) {
      return `<pre class="text-red-500 font-mono">${mdInstance.utils.escapeHtml(tokens[idx].content)}</pre>`;
    }
  };
}

md.use(katexMathPlugin);

// Custom fence rule for Mermaid & Math block rendering
const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info.trim();
  if (info === "mermaid") {
    const code = token.content.trim();
    return `<pre class="mermaid" data-mermaid-source="${md.utils.escapeHtml(code)}">${md.utils.escapeHtml(code)}</pre>`;
  }
  if (info === "math" || info === "katex") {
    try {
      return `<div class="katex-block my-4 flex justify-center">${katex.renderToString(token.content.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (err) {
      return `<pre class="text-red-500 font-mono">${md.utils.escapeHtml(token.content)}</pre>`;
    }
  }
  return defaultFence ? defaultFence(tokens, idx, options, env, self) : "";
};

export function renderMarkdown(
  src: string,
  options?: { markdownExtensionsEnabled?: boolean },
): string {
  const markdownExtensionsEnabled = options?.markdownExtensionsEnabled ?? true;

  // Table cell merge & Payer compatibility normalize
  let normalizedSrc = src
    .replace(/^([ \t]*)(:{3,})([a-zA-Z0-9_-]+)[ \t]+(\[)/gm, "$1$2$3$4")
    .replace(
      /^([ \t]*)(:{3,})[ \t]*([a-zA-Z0-9_-]+)[ \t]+([^\[\s\n\r][^\n\r]*)$/gm,
      "$1$2$3[$4]",
    )
    .replace(/^([ \t]*)(:{3,})[ \t]+([a-zA-Z0-9_-]+)/gm, "$1$2$3");

  // Normalize leading-pipe colspan syntaxes like "|| text |" or "||text|" into MultiMarkdown trailing-pipe syntax "| text ||"
  normalizedSrc = normalizedSrc
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.endsWith("|")) return line;

      // Row starts with multiple pipes: e.g. "|| test |" or "||test|"
      if (trimmed.match(/^\|\|+\s*[^|\n]/)) {
        const pipeCount = (trimmed.match(/^\|+/)?.[0] || "").length;
        const rest = trimmed.replace(/^\|+/, "").trim();
        const content = rest.replace(/\|$/, "").trim();
        const trailingPipes = "|".repeat(pipeCount);
        return `| ${content} ${trailingPipes}`;
      }

      // Cell inside row has leading extra pipes: e.g. "| || test |"
      let updated = line;
      updated = updated.replace(
        /\|(\|+)\s*([^|\n]+?)\s*\|/g,
        (match, extraPipes, content) => {
          if (content.trim() === "^^") return match;
          return `| ${content.trim()} |${extraPipes}`;
        },
      );
      return updated;
    })
    .join("\n");

  const cacheKey = markdownExtensionsEnabled
    ? `ext:${normalizedSrc}`
    : `noext:${normalizedSrc}`;
  const cached = markdownRenderCache.get(cacheKey);
  if (cached != null) {
    recordRendererPerf("markdown.render.cache-hit", 0, {
      chars: normalizedSrc.length,
    });
    return cached;
  }

  const startedAt = performance.now();
  try {
    let rawHtml = md.render(normalizedSrc);

    const html = sanitizeRenderedHtml(rawHtml);
    markdownRenderCache.set(cacheKey, html);
    while (markdownRenderCache.size > MARKDOWN_RENDER_CACHE_LIMIT) {
      const oldest = markdownRenderCache.keys().next().value;
      if (!oldest) break;
      markdownRenderCache.delete(oldest);
    }
    recordRendererPerf("markdown.render", performance.now() - startedAt, {
      chars: normalizedSrc.length,
    });
    return html;
  } catch (err) {
    recordRendererPerf("markdown.render.error", performance.now() - startedAt, {
      chars: normalizedSrc.length,
    });
    console.error("markdown render failed", err);
    return `<pre class="text-sm text-red-600">Markdown error: ${(err as Error).message}</pre>`;
  }
}
