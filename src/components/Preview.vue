<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { renderMarkdown } from '../lib/markdown'
import mermaid from 'mermaid'

const props = defineProps<{ source: string }>()

const container = ref<HTMLElement>()
const html = ref('')

async function updatePreview() {
  html.value = renderMarkdown(props.source)
  
  await nextTick()
  if (container.value) {
    const mermaidNodes = container.value.querySelectorAll('.mermaid')
    if (mermaidNodes.length > 0) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' })
      mermaidNodes.forEach((node, i) => {
        const source = node.getAttribute('data-mermaid-source')
        if (source) {
          const id = `mermaid-svg-${Date.now()}-${i}`
          mermaid.render(id, source).then((result) => {
            node.innerHTML = result.svg
          }).catch((err) => {
            node.innerHTML = `<pre class="text-red-500 text-sm">Mermaid Syntax Error</pre>`
          })
        }
      })
    }
  }
}

watch(() => props.source, () => {
  updatePreview()
})

onMounted(() => {
  updatePreview()
})
</script>

<template>
  <div 
    ref="container" 
    class="prose prose-zinc dark:prose-invert max-w-none p-4 h-full overflow-auto"
    v-html="html"
  ></div>
</template>
