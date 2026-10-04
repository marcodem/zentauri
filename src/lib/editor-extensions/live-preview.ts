import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

/**
 * CodeMirror 6 Live Preview Extension for ZenTauri (Phase 2)
 *
 * Dynamically decorates Markdown text and markdown-it-extensible containers
 * on INACTIVE lines (where cursor is not present) within visibleRanges.
 * When the cursor moves into a line, decorations on that line are unmasked so the
 * raw Markdown text is instantly visible and editable.
 */
export const livePreviewExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLivePreviewDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildLivePreviewDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// Hidden syntax decoration (collapses/hides syntax tokens when inactive)
const hiddenSyntaxDeco = Decoration.mark({
  class: "cm-hidden-syntax",
});

const boldTextDeco = Decoration.mark({
  class: "cm-live-bold",
});

const italicTextDeco = Decoration.mark({
  class: "cm-live-italic",
});

const inlineCodeDeco = Decoration.mark({
  class: "cm-live-inline-code",
});

const linkTextDeco = Decoration.mark({
  class: "cm-live-link",
});

const sanskritVerseDeco = Decoration.mark({
  class: "cm-sanskrit-verse",
});

const sanskritRuleDeco = Decoration.mark({
  class: "cm-sanskrit-rule",
});

const headingLineDecos: Record<number, Decoration> = {
  1: Decoration.line({ class: "cm-live-h1" }),
  2: Decoration.line({ class: "cm-live-h2" }),
  3: Decoration.line({ class: "cm-live-h3" }),
  4: Decoration.line({ class: "cm-live-h4" }),
  5: Decoration.line({ class: "cm-live-h5" }),
  6: Decoration.line({ class: "cm-live-h6" }),
};

const blockquoteLineDeco = Decoration.line({ class: "cm-live-blockquote" });
const listItemLineDeco = Decoration.line({ class: "cm-live-list-item" });

interface DecoRange {
  from: number;
  to: number;
  deco: Decoration;
}

function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const builder = new RangeSetBuilder<Decoration>();

  // Determine active lines where cursor or selection is present
  const activeLines = new Set<number>();
  for (const range of view.state.selection.ranges) {
    const headLine = doc.lineAt(range.head).number;
    const anchorLine = doc.lineAt(range.anchor).number;
    const minLine = Math.min(headLine, anchorLine);
    const maxLine = Math.max(headLine, anchorLine);
    for (let l = minLine; l <= maxLine; l++) {
      activeLines.add(l);
    }
  }

  // Optimize: compute decorations only for visible ranges instead of all document lines!
  for (const { from, to } of view.visibleRanges) {
    const startLine = doc.lineAt(from).number;
    const endLine = doc.lineAt(to).number;

    // Check if startLine is within a fenced code block
    let inCodeBlock = false;
    const checkBackStart = Math.max(1, startLine - 200);
    for (let l = checkBackStart; l < startLine; l++) {
      const lineText = doc.line(l).text;
      if (/^[ \t]*(`{3,}|~{3,})/.test(lineText)) {
        inCodeBlock = !inCodeBlock;
      }
    }

    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
      const line = doc.line(lineNum);
      const text = line.text;

      // Track fenced code blocks (```lang or ~~~lang)
      const codeBlockMatch = text.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
      if (codeBlockMatch) {
        if (inCodeBlock) {
          // Closing fence
          inCodeBlock = false;
          if (!activeLines.has(lineNum)) {
            builder.add(
              line.from,
              line.from,
              Decoration.line({ class: "cm-code-card-footer" }),
            );
          }
          continue;
        }

        // Opening fence
        inCodeBlock = true;
        if (!activeLines.has(lineNum)) {
          const lang = codeBlockMatch[3].trim();
          builder.add(
            line.from,
            line.from,
            Decoration.line({
              class: `cm-code-card-header ${lang ? `cm-code-lang-${lang}` : ""}`,
            }),
          );
        }
        continue;
      }

      if (inCodeBlock) {
        if (!activeLines.has(lineNum)) {
          builder.add(
            line.from,
            line.from,
            Decoration.line({ class: "cm-code-card-body" }),
          );
        }
        continue;
      }

      // Skip active lines — keep raw markdown syntax fully visible
      if (activeLines.has(lineNum)) {
        continue;
      }

      const inlineDecos: DecoRange[] = [];

      // 1. Container Fences (::: container-name[title])
      const containerOpenMatch = text.match(
        /^(\s*)(:{3,})\s*([a-zA-Z0-9_-]+)(?:\[(.*?)\])?/,
      );
      if (containerOpenMatch) {
        const containerName = containerOpenMatch[3];
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            class: `cm-container-header cm-container-${containerName}`,
          }),
        );
        // Hide the ::: colons
        inlineDecos.push({
          from: line.from,
          to:
            line.from +
            containerOpenMatch[1].length +
            containerOpenMatch[2].length,
          deco: hiddenSyntaxDeco,
        });
      }

      const containerCloseMatch = text.match(/^(\s*)(:{3,})\s*$/);
      if (containerCloseMatch && !containerOpenMatch) {
        builder.add(
          line.from,
          line.from,
          Decoration.line({ class: "cm-container-footer" }),
        );
        inlineDecos.push({
          from: line.from,
          to: line.from + containerCloseMatch[0].length,
          deco: hiddenSyntaxDeco,
        });
      }

      // 2. Headings (# H1, ## H2, etc.)
      const headingMatch = text.match(/^(#{1,6})\s+/);
      if (headingMatch && !containerOpenMatch && !containerCloseMatch) {
        const level = headingMatch[1].length;
        if (headingLineDecos[level]) {
          builder.add(line.from, line.from, headingLineDecos[level]);
        }
        const hashLength = headingMatch[0].length;
        inlineDecos.push({
          from: line.from,
          to: line.from + hashLength,
          deco: hiddenSyntaxDeco,
        });
      }

      // 3. Blockquotes (> text)
      if (text.startsWith("> ")) {
        builder.add(line.from, line.from, blockquoteLineDeco);
        inlineDecos.push({
          from: line.from,
          to: line.from + 2,
          deco: hiddenSyntaxDeco,
        });
      }

      // 4. Unordered Lists (- text, * text, + text)
      const listMatch = text.match(/^(\s*)([-*+]|\d+\.)\s+/);
      if (
        listMatch &&
        !headingMatch &&
        !containerOpenMatch &&
        !containerCloseMatch
      ) {
        builder.add(line.from, line.from, listItemLineDeco);
        const markerLength = listMatch[0].length;
        inlineDecos.push({
          from: line.from,
          to: line.from + markerLength,
          deco: Decoration.mark({ class: "cm-live-list-bullet" }),
        });
      }

      // 5. Bold (**text** or __text__)
      const boldRegex = /(\*\*|__)(.*?)\1/g;
      for (const match of text.matchAll(boldRegex)) {
        if (match.index == null) continue;
        const start = line.from + match.index;
        const end = start + match[0].length;
        const delimLen = match[1].length;

        inlineDecos.push({
          from: start,
          to: start + delimLen,
          deco: hiddenSyntaxDeco,
        });
        inlineDecos.push({
          from: start + delimLen,
          to: end - delimLen,
          deco: boldTextDeco,
        });
        inlineDecos.push({
          from: end - delimLen,
          to: end,
          deco: hiddenSyntaxDeco,
        });
      }

      // 6a. Italic (*text*) — excluding **
      const italicAsteriskRegex = /(?<!\*)\*([^*\s](?:.*?[^*\s])?)\*(?!\*)/g;
      for (const match of text.matchAll(italicAsteriskRegex)) {
        if (match.index == null) continue;
        const start = line.from + match.index;
        const end = start + match[0].length;
        inlineDecos.push({
          from: start,
          to: start + 1,
          deco: hiddenSyntaxDeco,
        });
        inlineDecos.push({
          from: start + 1,
          to: end - 1,
          deco: italicTextDeco,
        });
        inlineDecos.push({
          from: end - 1,
          to: end,
          deco: hiddenSyntaxDeco,
        });
      }

      // 6b. Italic (_text_) — boundary enforced so snake_case_identifier is preserved!
      const italicUnderscoreRegex =
        /(?:^|(?<=[^\w]))_([^_\s](?:.*?[^_\s])?)_(?=[^\w]|$)/g;
      for (const match of text.matchAll(italicUnderscoreRegex)) {
        if (match.index == null) continue;
        const start = line.from + match.index;
        const end = start + match[0].length;
        inlineDecos.push({
          from: start,
          to: start + 1,
          deco: hiddenSyntaxDeco,
        });
        inlineDecos.push({
          from: start + 1,
          to: end - 1,
          deco: italicTextDeco,
        });
        inlineDecos.push({
          from: end - 1,
          to: end,
          deco: hiddenSyntaxDeco,
        });
      }

      // 7. Inline Code (`code`)
      const codeRegex = /(`+)(.*?)\1/g;
      for (const match of text.matchAll(codeRegex)) {
        if (match.index == null) continue;
        const start = line.from + match.index;
        const end = start + match[0].length;
        const delimLen = match[1].length;

        inlineDecos.push({
          from: start,
          to: start + delimLen,
          deco: hiddenSyntaxDeco,
        });
        inlineDecos.push({
          from: start + delimLen,
          to: end - delimLen,
          deco: inlineCodeDeco,
        });
        inlineDecos.push({
          from: end - delimLen,
          to: end,
          deco: hiddenSyntaxDeco,
        });
      }

      // 8. Links ([text](url))
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      for (const match of text.matchAll(linkRegex)) {
        if (match.index == null) continue;
        const start = line.from + match.index;
        const textLen = match[1].length;
        const fullLen = match[0].length;

        inlineDecos.push({
          from: start,
          to: start + 1,
          deco: hiddenSyntaxDeco,
        });
        inlineDecos.push({
          from: start + 1,
          to: start + 1 + textLen,
          deco: linkTextDeco,
        });
        inlineDecos.push({
          from: start + 1 + textLen,
          to: start + fullLen,
          deco: hiddenSyntaxDeco,
        });
      }

      // 9. Sanskrit Verse Brackets《text》
      const verseRegex = /《(.*?)》/g;
      for (const match of text.matchAll(verseRegex)) {
        if (match.index == null) continue;
        const start = line.from + match.index;
        const end = start + match[0].length;

        inlineDecos.push({ from: start, to: end, deco: sanskritVerseDeco });
      }

      // 10. Sanskrit Rule Brackets ⟪text⟫
      const ruleRegex = /⟪(.*?)⟫/g;
      for (const match of text.matchAll(ruleRegex)) {
        if (match.index == null) continue;
        const start = line.from + match.index;
        const end = start + match[0].length;

        inlineDecos.push({ from: start, to: end, deco: sanskritRuleDeco });
      }

      // Sort inline decorations strictly by `from` position ascending
      inlineDecos.sort((a, b) => a.from - b.from || a.to - b.to);

      // Filter out overlapping ranges to prevent RangeSetBuilder panic
      let lastTo = line.from;
      for (const r of inlineDecos) {
        if (r.from >= lastTo && r.from < r.to) {
          builder.add(r.from, r.to, r.deco);
          lastTo = r.to;
        }
      }
    }
  }

  return builder.finish();
}
