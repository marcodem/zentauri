<script setup lang="ts">
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { highlightSelectionMatches } from "@codemirror/search";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { adjustContainerNesting } from "../lib/auto-repair";
import { directiveGuidelines } from "../lib/editor-extensions/directive-guidelines";
import { livePreviewExtension } from "../lib/editor-extensions/live-preview";
import {
  type TransliterationScheme,
  findSanskritWordRange,
  toggleSchemeTransliteration,
} from "../lib/transliteration";

export interface ScrollInfo {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  ratio: number;
  fractionalLine: number;
  totalLines: number;
}

export interface CursorInfo {
  line: number;
  column: number;
  selectedChars: number;
  totalLines: number;
}

const props = defineProps<{
  modelValue: string;
  vimMode?: boolean;
  livePreview?: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "scroll", info: ScrollInfo): void;
  (e: "user-interaction"): void;
  (e: "cursor-change", info: CursorInfo): void;
}>();

function insertText(text: string) {
  if (!view) return;
  const selection = view.state.selection.main;

  if (text.includes(":::")) {
    const docText = view.state.doc.toString();
    const docWithInsert =
      docText.slice(0, selection.from) + text + docText.slice(selection.to);
    const nestingResult = adjustContainerNesting(docWithInsert);
    if (nestingResult.didRepair) {
      const oldDoc = view.state.doc;
      view.dispatch({
        changes: { from: 0, to: oldDoc.length, insert: nestingResult.repaired },
        scrollIntoView: true,
      });
      try {
        const line = oldDoc.lineAt(selection.from);
        const col = selection.from - line.from;
        const newDoc = view.state.doc;
        const targetLineNum = Math.min(line.number, newDoc.lines);
        const newLine = newDoc.line(targetLineNum);
        const newBase = Math.min(newLine.to, newLine.from + col);
        view.dispatch({
          selection: { anchor: Math.min(newDoc.length, newBase + text.length) },
        });
      } catch {
        // fallback
      }
      view.focus();
      return;
    }
  }

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: { anchor: selection.from + text.length },
    scrollIntoView: true,
  });
  view.focus();
}

function wrapSelection(before: string, after: string) {
  if (!view) return;
  const selection = view.state.selection.main;
  const selectedText = view.state.sliceDoc(selection.from, selection.to);
  const replacement = `${before}${selectedText}${after}`;

  if (before.includes(":::")) {
    const docText = view.state.doc.toString();
    const docWithReplacement =
      docText.slice(0, selection.from) +
      replacement +
      docText.slice(selection.to);

    const nestingResult = adjustContainerNesting(docWithReplacement);
    if (nestingResult.didRepair) {
      const oldDoc = view.state.doc;
      view.dispatch({
        changes: {
          from: 0,
          to: oldDoc.length,
          insert: nestingResult.repaired,
        },
        scrollIntoView: true,
      });
      try {
        const line = oldDoc.lineAt(selection.from);
        const col = selection.from - line.from;
        const newDoc = view.state.doc;
        const targetLineNum = Math.min(line.number, newDoc.lines);
        const newLine = newDoc.line(targetLineNum);
        const newBase = Math.min(newLine.to, newLine.from + col);
        const newAnchor = Math.min(newDoc.length, newBase + before.length);
        const newHead = Math.min(
          newDoc.length,
          newAnchor + selectedText.length,
        );
        view.dispatch({
          selection: { anchor: newAnchor, head: newHead },
        });
      } catch {
        // fallback
      }
      view.focus();
      return;
    }
  }

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: replacement },
    selection: {
      anchor: selection.from + before.length,
      head: selection.from + before.length + selectedText.length,
    },
    scrollIntoView: true,
  });
  view.focus();
}

function toggleTransliteration(scheme: TransliterationScheme = "iast") {
  if (!view) return;
  const state = view.state;
  const docText = state.doc.toString();

  const tr = state.changeByRange((range) => {
    let from = range.from;
    let to = range.to;

    if (range.empty) {
      const wordRange = findSanskritWordRange(docText, range.head);
      if (wordRange) {
        from = wordRange.from;
        to = wordRange.to;
      }
    }

    if (from === to) {
      return { range };
    }

    const text = state.sliceDoc(from, to);
    const transformed = toggleSchemeTransliteration(text, scheme);

    if (transformed === text) {
      return { range };
    }

    return {
      changes: { from, to, insert: transformed },
      range: EditorSelection.range(from, from + transformed.length),
    };
  });

  if (!tr.changes.empty) {
    view.dispatch(tr);
  }
  view.focus();
}

function focus() {
  if (view) {
    view.focus();
  }
}

function jumpToLine(lineNum: number) {
  if (!view) return;
  try {
    const line = view.state.doc.line(lineNum);
    view.dispatch({
      selection: { anchor: line.from, head: line.from },
      scrollIntoView: true,
    });
    view.focus();
  } catch (e) {
    console.error("Failed to jump to line", e);
  }
}

let isProgrammaticScroll = false;
let rafUnlockId: number | null = null;

function scheduleUnlock() {
  if (rafUnlockId !== null) {
    cancelAnimationFrame(rafUnlockId);
  }
  rafUnlockId = requestAnimationFrame(() => {
    isProgrammaticScroll = false;
    rafUnlockId = null;
  });
}

function getScrollInfo(): ScrollInfo | null {
  if (!view) return null;
  const scroller = view.scrollDOM;
  const scrollTop = scroller.scrollTop;
  const scrollHeight = scroller.scrollHeight;
  const clientHeight = scroller.clientHeight;
  const maxScroll = scrollHeight - clientHeight;
  const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0;
  const totalLines = view.state.doc.lines;

  if (scrollTop <= 1) {
    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      ratio: 0,
      fractionalLine: 1,
      totalLines,
    };
  }
  if (scrollTop >= maxScroll - 2) {
    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      ratio: 1,
      fractionalLine: totalLines,
      totalLines,
    };
  }

  let fractionalLine = 1;
  try {
    const block = view.lineBlockAtHeight(scrollTop);
    const lineObj = view.state.doc.lineAt(block.from);
    const offsetInBlock = scrollTop - block.top;
    const lineRatio =
      block.height > 0
        ? Math.max(0, Math.min(1, offsetInBlock / block.height))
        : 0;
    fractionalLine = lineObj.number + lineRatio;
  } catch {
    fractionalLine = 1 + ratio * (totalLines - 1);
  }

  return {
    scrollTop,
    scrollHeight,
    clientHeight,
    ratio,
    fractionalLine,
    totalLines,
  };
}

function scrollToFractionalLine(targetLine: number, fallbackRatio?: number) {
  if (!view) return;
  const scroller = view.scrollDOM;
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  if (maxScroll <= 0) return;

  if (targetLine <= 1) {
    isProgrammaticScroll = true;
    scroller.scrollTop = 0;
    scheduleUnlock();
    return;
  }

  const totalLines = view.state.doc.lines;
  if (
    targetLine >= totalLines ||
    (fallbackRatio !== undefined && fallbackRatio >= 0.999)
  ) {
    isProgrammaticScroll = true;
    scroller.scrollTop = maxScroll;
    scheduleUnlock();
    return;
  }

  let targetScrollTop = 0;
  try {
    const intLine = Math.max(1, Math.min(totalLines, Math.floor(targetLine)));
    const remainder = targetLine - intLine;
    const lineObj = view.state.doc.line(intLine);
    const block = view.lineBlockAt(lineObj.from);
    targetScrollTop = block.top + remainder * block.height;
  } catch {
    if (fallbackRatio !== undefined) {
      targetScrollTop = fallbackRatio * maxScroll;
    }
  }

  targetScrollTop = Math.max(
    0,
    Math.min(maxScroll, Math.round(targetScrollTop)),
  );
  isProgrammaticScroll = true;
  scroller.scrollTop = targetScrollTop;
  scheduleUnlock();
}

function scrollToRatio(ratio: number) {
  if (!view) return;
  const scroller = view.scrollDOM;
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  if (maxScroll <= 0) return;
  isProgrammaticScroll = true;
  scroller.scrollTop = Math.max(
    0,
    Math.min(maxScroll, Math.round(ratio * maxScroll)),
  );
  scheduleUnlock();
}

function handleScroll() {
  if (isProgrammaticScroll) return;
  const info = getScrollInfo();
  if (info) {
    emit("scroll", info);
  }
}

function handleInteraction() {
  emit("user-interaction");
}

function extractCursorInfo(editorView: EditorView): CursorInfo {
  try {
    const selection = editorView.state.selection.main;
    const line = editorView.state.doc.lineAt(selection.head);
    const selectedChars = Math.abs(selection.to - selection.from);
    return {
      line: line.number,
      column: selection.head - line.from + 1,
      selectedChars,
      totalLines: editorView.state.doc.lines,
    };
  } catch {
    return {
      line: 1,
      column: 1,
      selectedChars: 0,
      totalLines: editorView.state.doc.lines || 1,
    };
  }
}

defineExpose({
  insertText,
  focus,
  jumpToLine,
  wrapSelection,
  toggleTransliteration,
  toggleIastTransliteration: () => toggleTransliteration("iast"),
  toggleHkTransliteration: () => toggleTransliteration("hk"),
  getScrollInfo,
  scrollToFractionalLine,
  scrollToRatio,
  getCursorInfo: () => (view ? extractCursorInfo(view) : null),
  getScrollerElement: () => view?.scrollDOM ?? null,
});

const container = ref<HTMLElement>();
let view: EditorView | null = null;
const vimCompartment = new Compartment();
const livePreviewCompartment = new Compartment();

onMounted(() => {
  if (!container.value) return;

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: "Mod-Alt-d",
          run: () => {
            toggleTransliteration("iast");
            return true;
          },
        },
        {
          key: "Mod-Alt-D",
          run: () => {
            toggleTransliteration("iast");
            return true;
          },
        },
        {
          key: "F4",
          run: () => {
            toggleTransliteration("iast");
            return true;
          },
        },
        {
          key: "Mod-Alt-h",
          run: () => {
            toggleTransliteration("hk");
            return true;
          },
        },
        {
          key: "Mod-Alt-H",
          run: () => {
            toggleTransliteration("hk");
            return true;
          },
        },
        {
          key: "Shift-F4",
          run: () => {
            toggleTransliteration("hk");
            return true;
          },
        },
      ]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      highlightSelectionMatches({
        minSelectionLength: 2,
        wholeWords: true,
      }),
      EditorView.theme({
        "&": {
          height: "100%",
          backgroundColor: "var(--app-bg)",
          color: "var(--app-text)",
        },
        ".cm-scroller": { overflow: "auto", fontFamily: "monospace" },
        ".cm-content": { caretColor: "var(--app-text) !important" },
        ".cm-gutters": {
          backgroundColor: "var(--app-bg-secondary)",
          color: "var(--app-text-muted)",
          borderRight: "1px solid var(--app-border)",
        },
        ".cm-activeLineGutter": { backgroundColor: "var(--app-bg-hover)" },
        ".cm-activeLine": { backgroundColor: "var(--app-bg-hover)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
          backgroundColor:
            "var(--editor-selection-bg, var(--app-bg-active)) !important",
          borderRadius: "3px",
        },
        ".cm-content ::selection": {
          backgroundColor:
            "var(--editor-selection-bg, var(--app-bg-active)) !important",
        },
        ".cm-selectionMatch": {
          backgroundColor:
            "var(--editor-selection-match-bg, rgba(234, 179, 8, 0.15)) !important",
          outline:
            "1px solid var(--editor-selection-match-border, rgba(234, 179, 8, 0.4))",
          borderRadius: "2px",
        },
        ".cm-cursor, &.cm-focused .cm-cursor, .cm-cursorLayer .cm-cursor, .cm-cursor-primary":
          {
            borderLeft: "2.5px solid var(--app-text) !important",
            borderLeftColor: "var(--app-text) !important",
          },
        ".cm-dropCursor": {
          borderLeft: "2.5px solid var(--app-text) !important",
        },
        ".cm-fat-cursor, &.cm-focused .cm-fat-cursor, div.cm-fat-cursor": {
          backgroundColor: "var(--app-text) !important",
          color: "var(--app-bg) !important",
          opacity: "0.85 !important",
        },
      }),

      vimCompartment.of(props.vimMode ? vim() : []),
      livePreviewCompartment.of(props.livePreview ? livePreviewExtension : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit("update:modelValue", update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          emit("cursor-change", extractCursorInfo(update.view));
        }
      }),
      directiveGuidelines,
    ],
  });

  view = new EditorView({
    state,
    parent: container.value,
  });

  emit("cursor-change", extractCursorInfo(view));

  const scroller = view.scrollDOM;
  scroller.addEventListener("scroll", handleScroll, { passive: true });
  scroller.addEventListener("wheel", handleInteraction, { passive: true });
  scroller.addEventListener("pointerdown", handleInteraction, {
    passive: true,
  });
  scroller.addEventListener("touchstart", handleInteraction, { passive: true });
  scroller.addEventListener("keydown", handleInteraction, { passive: true });
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (view && view.state.doc.toString() !== newVal) {
      const currentSelection = view.state.selection.main;
      const targetAnchor = Math.min(currentSelection.anchor, newVal.length);
      const targetHead = Math.min(currentSelection.head, newVal.length);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newVal },
        selection: { anchor: targetAnchor, head: targetHead },
      });
    }
  },
);

watch(
  () => props.vimMode,
  (newVal) => {
    if (view) {
      view.dispatch({
        effects: vimCompartment.reconfigure(newVal ? vim() : []),
      });
    }
  },
);

watch(
  () => props.livePreview,
  (newVal) => {
    if (view) {
      view.dispatch({
        effects: livePreviewCompartment.reconfigure(
          newVal ? livePreviewExtension : [],
        ),
      });
    }
  },
);

onBeforeUnmount(() => {
  if (rafUnlockId !== null) {
    cancelAnimationFrame(rafUnlockId);
    rafUnlockId = null;
  }
  if (view) {
    const scroller = view.scrollDOM;
    scroller.removeEventListener("scroll", handleScroll);
    scroller.removeEventListener("wheel", handleInteraction);
    scroller.removeEventListener("pointerdown", handleInteraction);
    scroller.removeEventListener("touchstart", handleInteraction);
    scroller.removeEventListener("keydown", handleInteraction);
    view.destroy();
    view = null;
  }
});
</script>

<template>
  <div ref="container" class="h-full w-full bg-app-bg text-app-text" style="font-size: var(--editor-font-size, 16px);"></div>
</template>
