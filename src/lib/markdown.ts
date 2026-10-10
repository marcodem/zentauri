import DOMPurify from "dompurify";
import katex from "katex";
import MarkdownIt from "markdown-it";
import markdownItAttrs from "markdown-it-attrs";
// @ts-ignore
import * as extensiblePluginModule from "markdown-it-extensible";
// @ts-ignore
import multimdTable from "markdown-it-multimd-table";
import { adjustContainerNesting } from "./auto-repair";
import { recordRendererPerf } from "./perf";

type Token = Parameters<
  NonNullable<MarkdownIt["renderer"]["rules"]["fence"]>
>[0][number];

type StateInline = Parameters<
  MarkdownIt["inline"]["ruler"]["after"]
>[2] extends (state: infer S, ...args: never[]) => unknown
  ? S
  : any;

type StateBlock = Parameters<MarkdownIt["block"]["ruler"]["after"]>[2] extends (
  state: infer S,
  ...args: never[]
) => unknown
  ? S
  : any;

interface ExtensibleModule {
  default?: (md: MarkdownIt, options?: unknown) => void;
  (md: MarkdownIt, options?: unknown): void;
}

const extensibleModule = extensiblePluginModule as unknown as ExtensibleModule;
const extensiblePlugin = extensibleModule.default || extensibleModule;

const URI_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const ALLOWED_RENDERED_URI_SCHEME_RE =
  /^(?:https?|mailto|zen|zen-asset|blob):/i;
const SAFE_DATA_IMAGE_URI_RE =
  /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)(?:;charset=[^;]+)?;base64,[a-z0-9+/=]+$/i;

const ALLOWED_RENDERED_DATA_ATTRS = [
  "data-callout",
  "data-function-plot-source",
  "data-jsxgraph-source",
  "data-local-asset-href",
  "data-local-asset-kind",
  "data-local-asset-url",
  "data-mermaid-source",
  "data-resolved-path",
  "data-source-line",
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

  const raw =
    (DOMPurify as unknown as { default?: unknown }).default || DOMPurify;

  if (typeof (raw as any)?.sanitize === "function") {
    purifiedInstance = raw;
    return purifiedInstance;
  }
  if (typeof raw === "function") {
    const win =
      typeof window !== "undefined"
        ? window
        : typeof globalThis !== "undefined"
          ? (globalThis as unknown as { window?: Window }).window
          : null;
    if (win) {
      purifiedInstance = (raw as (w: Window) => unknown)(win);
      return purifiedInstance;
    }
  }
  return null;
}

function ensureSanitizerHooks(): void {
  if (sanitizerHooksInstalled) return;
  try {
    const purify = getPurify();
    if (purify && typeof purify.addHook === "function") {
      purify.addHook(
        "uponSanitizeAttribute",
        (
          _node: Element,
          data: { attrName: string; attrValue?: string; keepAttr?: boolean },
        ) => {
          if (
            data.attrName !== "href" &&
            data.attrName !== "src" &&
            data.attrName !== "xlink:href"
          ) {
            return;
          }
          const value = data.attrValue?.trim();
          if (value && URI_SCHEME_RE.test(value)) {
            const isAllowedScheme = ALLOWED_RENDERED_URI_SCHEME_RE.test(value);
            const isSafeDataUri = SAFE_DATA_IMAGE_URI_RE.test(value);
            if (!isAllowedScheme && !isSafeDataUri) {
              data.keepAttr = false;
            }
          }
        },
      );
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
      return mdBasic.utils.escapeHtml(html);
    }
    return purify.sanitize(html, {
      ALLOW_DATA_ATTR: true,
      ALLOW_ARIA_ATTR: true,
      ADD_ATTR: ALLOWED_RENDERED_DATA_ATTRS,
      ADD_TAGS: MATHML_TAGS,
    });
  } catch (e) {
    console.warn("DOMPurify sanitize failed:", e);
    return `<pre class="text-sm text-red-600">Sanitization error: ${mdBasic.utils.escapeHtml(String(e))}</pre>`;
  }
}

const MARKDOWN_RENDER_CACHE_LIMIT = 24;
const markdownRenderCache = new Map<string, string>();

// Custom KaTeX Math Plugin
export function katexMathPlugin(mdInstance: MarkdownIt) {
  // Inline math rule: $...$
  mdInstance.inline.ruler.after(
    "escape",
    "math_inline",
    (state: StateInline, silent: boolean) => {
      if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
      if (state.src.charCodeAt(state.pos + 1) === 0x24 /* $$ */) return false;

      const start = state.pos + 1;
      if (
        state.src.charCodeAt(start) === 0x20 ||
        state.src.charCodeAt(start) === 0x09
      ) {
        return false;
      }

      let match = start;
      let found = false;

      while (match < state.src.length) {
        match = state.src.indexOf("$", match);
        if (match === -1) break;

        const slice = state.src.slice(start, match);
        if (slice.includes("\n\n")) {
          return false;
        }

        let backslashCount = 0;
        let idx = match - 1;
        while (idx >= start && state.src.charCodeAt(idx) === 0x5c /* \ */) {
          backslashCount++;
          idx--;
        }

        if (backslashCount % 2 === 1) {
          match++;
          continue;
        }

        if (
          state.src.charCodeAt(match - 1) === 0x20 ||
          state.src.charCodeAt(match - 1) === 0x09
        ) {
          match++;
          continue;
        }

        found = true;
        break;
      }

      if (!found || match === -1) return false;
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
    (
      state: StateBlock,
      startLine: number,
      endLine: number,
      silent: boolean,
    ) => {
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

        if (!foundEnd) return false;
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
  mdInstance.renderer.rules.math_inline = (tokens: Token[], idx: number) => {
    try {
      return katex.renderToString(tokens[idx].content, {
        displayMode: false,
        throwOnError: false,
      });
    } catch (_err) {
      return `<span class="text-red-500 font-mono">${mdInstance.utils.escapeHtml(tokens[idx].content)}</span>`;
    }
  };

  mdInstance.renderer.rules.math_block = (
    tokens: Token[],
    idx: number,
    _options: any,
    env: any,
  ) => {
    const token = tokens[idx];
    const lineAttr =
      env?.sourceLines && token.map
        ? ` data-source-line="${token.map[0] + 1}"`
        : "";
    try {
      return `<div class="katex-block my-4 flex justify-center"${lineAttr}>${katex.renderToString(token.content, { displayMode: true, throwOnError: false })}</div>`;
    } catch (_err) {
      return `<pre class="text-red-500 font-mono"${lineAttr}>${mdInstance.utils.escapeHtml(token.content)}</pre>`;
    }
  };
}

function setupFenceRule(mdInstance: MarkdownIt) {
  const defaultFence = mdInstance.renderer.rules.fence;
  mdInstance.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim();
    const lineAttr =
      env?.sourceLines && token.map
        ? ` data-source-line="${token.map[0] + 1}"`
        : "";
    if (info === "mermaid") {
      const code = token.content.trim();
      return `<pre class="mermaid"${lineAttr} data-mermaid-source="${mdInstance.utils.escapeHtml(code)}">${mdInstance.utils.escapeHtml(code)}</pre>`;
    }
    if (info === "math" || info === "katex") {
      try {
        return `<div class="katex-block my-4 flex justify-center"${lineAttr}>${katex.renderToString(token.content.trim(), { displayMode: true, throwOnError: false })}</div>`;
      } catch (_err) {
        return `<pre class="text-red-500 font-mono"${lineAttr}>${mdInstance.utils.escapeHtml(token.content)}</pre>`;
      }
    }
    return defaultFence ? defaultFence(tokens, idx, options, env, self) : "";
  };
}

function setupSourceLines(mdInstance: MarkdownIt) {
  mdInstance.core.ruler.push("inject_source_lines", (state) => {
    if (!state.env?.sourceLines) return true;

    for (const token of state.tokens) {
      if (
        token.map &&
        (token.type.endsWith("_open") ||
          token.type === "fence" ||
          token.type === "code_block" ||
          token.type === "hr" ||
          token.type === "math_block")
      ) {
        token.attrSet("data-source-line", String(token.map[0] + 1));
      }
    }
    return true;
  });
}

function createBaseMarkdownIt(): MarkdownIt {
  const instance = new MarkdownIt({ html: true })
    .use(multimdTable, {
      multiline: true,
      rowspan: true,
      headerless: true,
      multibody: true,
      autolabel: true,
    })
    .use(markdownItAttrs)
    .use(katexMathPlugin);

  setupFenceRule(instance);
  setupSourceLines(instance);
  return instance;
}

const mdBasic = createBaseMarkdownIt();
const mdExtended = createBaseMarkdownIt().use(extensiblePlugin, {
  injectStyles: false,
  blockContainers: [
    { name: "grammar-box2", className: "grammar-box2" },
    { name: "grammarbox2", className: "grammar-box2" },
    { name: "grammar-box", className: "grammar-box" },
    { name: "grammarbox", className: "grammar-box" },
    { name: "deleteme-box", className: "deleteme-box" },
    { name: "deletemebox", className: "deleteme-box" },
    { name: "metrik-schema", className: "metrik-schema" },
    { name: "metrikschema", className: "metrik-schema" },
    { name: "note-box", className: "note-box" },
    { name: "notebox", className: "note-box" },
    { name: "laut-table", className: "laut-table" },
    { name: "lauttable", className: "laut-table" },
    { name: "media", className: "media" },
    { name: "center", className: "center" },
    { name: "important", className: "important" },
    { name: "indent", className: "indent" },
    { name: "compact", className: "compact" },
    { name: "no-header", className: "no-header" },
    { name: "noheader", className: "no-header" },
    { name: "info", className: "info custom-block" },
    { name: "tip", className: "tip custom-block" },
    { name: "warning", className: "warning custom-block" },
    { name: "danger", className: "danger custom-block" },
    { name: "details", className: "details custom-block" },
    { name: "custom1", className: "custom1" },
    { name: "custom2", className: "custom2" },
    { name: "custom3", className: "custom3" },
    { name: "custom4", className: "custom4" },
    { name: "custom5", className: "custom5" },
  ],
});

export function normalizeMarkdownSource(
  src: string,
  extensionsEnabled: boolean,
): string {
  const lines = src.split("\n");
  let inCodeFence = false;
  let codeFenceChar = "";
  let codeFenceLen = 0;

  const processedLines = lines.map((line) => {
    // Check code fence toggle: ``` or ~~~
    const fenceMatch = line.match(/^[ \t]*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceChar = char;
        codeFenceLen = len;
        return line;
      }
      if (char === codeFenceChar && len >= codeFenceLen) {
        inCodeFence = false;
        return line;
      }
    }

    if (inCodeFence) {
      return line;
    }

    let current = line;

    // Container title bracket normalization (only if extensions are enabled)
    if (extensionsEnabled) {
      current = current
        .replace(/^([ \t]*:{3,}[ \t]*[a-zA-Z0-9_-]+)[ \t]*\[\s*\]/, "$1")
        .replace(/^([ \t]*)(:{3,})([a-zA-Z0-9_-]+)[ \t]+(\[)/, "$1$2$3$4")
        .replace(
          /^([ \t]*)(:{3,})[ \t]*([a-zA-Z0-9_-]+)[ \t]+([^\[\s\n\r][^\n\r]*)$/,
          "$1$2$3[$4]",
        )
        .replace(/^([ \t]*)(:{3,})[ \t]+([a-zA-Z0-9_-]+)/, "$1$2$3");
    }

    // Table cell merge & MultiMarkdown pipe syntax
    const trimmed = current.trim();
    if (trimmed.endsWith("|")) {
      if (trimmed.match(/^\|\|+\s*[^|\n]/)) {
        const pipeCount = (trimmed.match(/^\|+/)?.[0] || "").length;
        const rest = trimmed.replace(/^\|+/, "").trim();
        const content = rest.replace(/\|$/, "").trim();
        const trailingPipes = "|".repeat(pipeCount);
        current = `| ${content} ${trailingPipes}`;
      } else {
        current = current.replace(
          /\|(\|+)\s*([^|\n]+?)\s*\|/g,
          (match, extraPipes, content) => {
            if (content.trim() === "^^") return match;
            return `| ${content.trim()} |${extraPipes}`;
          },
        );
      }
    }

    return current;
  });

  let result = processedLines.join("\n");

  if (extensionsEnabled) {
    const nestingResult = adjustContainerNesting(result, {
      closeUnclosed: true,
    });
    if (nestingResult.didRepair) {
      result = nestingResult.repaired;
    }
  }

  return result;
}

export function renderMarkdown(
  src: string,
  options?: { markdownExtensionsEnabled?: boolean; sourceLines?: boolean },
): string {
  const markdownExtensionsEnabled = options?.markdownExtensionsEnabled ?? true;
  const sourceLines = options?.sourceLines ?? false;
  const normalizedSrc = normalizeMarkdownSource(src, markdownExtensionsEnabled);

  const cacheKey = `${markdownExtensionsEnabled ? "ext" : "noext"}:${sourceLines ? "lines" : "nolines"}:${normalizedSrc}`;
  const cached = markdownRenderCache.get(cacheKey);
  if (cached != null) {
    // Refresh LRU order on hit
    markdownRenderCache.delete(cacheKey);
    markdownRenderCache.set(cacheKey, cached);
    recordRendererPerf("markdown.render.cache-hit", 0, {
      chars: normalizedSrc.length,
    });
    return cached;
  }

  const startedAt = performance.now();
  try {
    const renderer = markdownExtensionsEnabled ? mdExtended : mdBasic;
    let rawHtml = renderer.render(normalizedSrc, { sourceLines });

    if (markdownExtensionsEnabled) {
      // Remove empty title containers (e.g. <div class="md-box__title"></div> or whitespace only)
      rawHtml = rawHtml.replace(
        /<div class="md-box__title">\s*<\/div>\n?/g,
        "",
      );
      rawHtml = rawHtml.replace(
        /<div class="custom-block-title">\s*<\/div>\n?/g,
        "",
      );

      // Remove empty paragraphs immediately following container opening or preceding container closing
      rawHtml = rawHtml.replace(
        /(<div class="[^"]*(?:custom-block|box)[^"]*">\n?)(?:\s*<p>\s*<\/p>\n?)+/g,
        "$1",
      );
      rawHtml = rawHtml.replace(/(?:\s*<p>\s*<\/p>\n?)+(<\/div>\n?)/g, "$1");
    }

    const html = sanitizeRenderedHtml(rawHtml);
    markdownRenderCache.set(cacheKey, html);
    if (markdownRenderCache.size > MARKDOWN_RENDER_CACHE_LIMIT) {
      const oldest = markdownRenderCache.keys().next().value;
      if (oldest !== undefined) {
        markdownRenderCache.delete(oldest);
      }
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
