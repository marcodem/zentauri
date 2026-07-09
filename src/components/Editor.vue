<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { vim } from '@replit/codemirror-vim'
import { directiveGuidelines } from '../lib/editor-extensions/directive-guidelines'

const props = defineProps<{ modelValue: string, vimMode?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

function insertText(text: string) {
  if (!view) return
  const selection = view.state.selection.main
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: { anchor: selection.from + text.length },
    scrollIntoView: true
  })
  view.focus()
}

function focus() {
  if (view) {
    view.focus()
  }
}

function jumpToLine(lineNum: number) {
  if (!view) return
  try {
    const line = view.state.doc.line(lineNum)
    view.dispatch({
      selection: { anchor: line.from, head: line.from },
      scrollIntoView: true
    })
    view.focus()
  } catch (e) {
    console.error('Failed to jump to line', e)
  }
}

defineExpose({ insertText, focus, jumpToLine })

const container = ref<HTMLElement>()
let view: EditorView | null = null
const vimCompartment = new Compartment()

onMounted(() => {
  if (!container.value) return

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.theme({
        "&": { height: "100%", backgroundColor: "var(--app-bg)", color: "var(--app-text)" },
        ".cm-scroller": { overflow: "auto", fontFamily: "monospace" },
        ".cm-gutters": { backgroundColor: "var(--app-bg-secondary)", color: "var(--app-text-muted)", borderRight: "1px solid var(--app-border)" },
        ".cm-activeLineGutter": { backgroundColor: "var(--app-bg-hover)" },
        ".cm-activeLine": { backgroundColor: "var(--app-bg-hover)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "var(--app-bg-active)" },
        ".cm-cursor": { borderLeftColor: "var(--app-text)" }
      }),
      vimCompartment.of(props.vimMode ? vim() : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
        }
      }),
      directiveGuidelines
    ]
  })
  
  view = new EditorView({
    state,
    parent: container.value
  })
})

watch(() => props.modelValue, (newVal) => {
  if (view && view.state.doc.toString() !== newVal) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal }
    })
  }
})

watch(() => props.vimMode, (newVal) => {
  if (view) {
    view.dispatch({
      effects: vimCompartment.reconfigure(newVal ? vim() : [])
    })
  }
})

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
    view = null
  }
})
</script>

<template>
  <div ref="container" class="h-full w-full bg-app-bg text-app-text" style="font-size: var(--editor-font-size, 16px);"></div>
</template>
