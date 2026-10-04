<script setup lang="ts">
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { adjustContainerNesting } from "../lib/auto-repair";
import { directiveGuidelines } from "../lib/editor-extensions/directive-guidelines";
import { livePreviewExtension } from "../lib/editor-extensions/live-preview";

const props = defineProps<{
  modelValue: string;
  vimMode?: boolean;
  livePreview?: boolean;
}>();
const emit = defineEmits<(e: "update:modelValue", value: string) => void>();

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

defineExpose({ insertText, focus, jumpToLine, wrapSelection });

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
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
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
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
          { backgroundColor: "var(--app-bg-active)" },
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
      }),
      directiveGuidelines,
    ],
  });

  view = new EditorView({
    state,
    parent: container.value,
  });
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
  if (view) {
    view.destroy();
    view = null;
  }
});
</script>

<template>
  <div ref="container" class="h-full w-full bg-app-bg text-app-text" style="font-size: var(--editor-font-size, 16px);"></div>
</template>
