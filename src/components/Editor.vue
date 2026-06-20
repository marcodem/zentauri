<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const container = ref<HTMLElement>()
let view: EditorView | null = null

onMounted(() => {
  if (!container.value) return

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.theme({
        "&": { height: "100%", backgroundColor: "transparent" },
        ".cm-scroller": { overflow: "auto", fontFamily: "monospace" }
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
        }
      })
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

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
    view = null
  }
})
</script>

<template>
  <div ref="container" class="h-full w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"></div>
</template>
