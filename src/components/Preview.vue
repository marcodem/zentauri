<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { renderMarkdown } from '../lib/markdown'
import mermaid from 'mermaid'
import debounce from 'lodash.debounce'

const props = defineProps<{ source: string }>()

const container = ref<HTMLElement>()
const html = ref('')

const mermaidCache = new Map<string, string>()

const renderMermaid = debounce(async () => {
  if (!container.value) return
  const mermaidNodes = container.value.querySelectorAll('.mermaid')
  if (mermaidNodes.length === 0) return

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  mermaid.initialize({ 
    startOnLoad: false, 
    theme: isDark ? 'dark' : 'default',
    suppressErrorRendering: true
  })

  for (let i = 0; i < mermaidNodes.length; i++) {
    const node = mermaidNodes[i]
    if (node.querySelector('svg')) continue

    const source = node.getAttribute('data-mermaid-source') || node.textContent
    if (source) {
      const id = `mermaid-svg-${Date.now()}-${i}`
      try {
        const result = await mermaid.render(id, source)
        mermaidCache.set(source, result.svg)
        if (container.value && container.value.contains(node)) {
          node.innerHTML = result.svg
        }
      } catch (e) {
        if (container.value && container.value.contains(node)) {
          node.innerHTML = `<pre class="text-red-500 text-sm">Mermaid Syntax Error</pre>`
        }
      }
    }
  }
}, 300)

async function updatePreview() {
  html.value = renderMarkdown(props.source)
  
  await nextTick()
  if (container.value) {
    const mermaidNodes = container.value.querySelectorAll('.mermaid')
    if (mermaidNodes.length > 0) {
      let needsRender = false
      for (let i = 0; i < mermaidNodes.length; i++) {
        const node = mermaidNodes[i]
        const source = node.getAttribute('data-mermaid-source') || node.textContent
        if (source && mermaidCache.has(source)) {
          node.innerHTML = mermaidCache.get(source)!
        } else if (source) {
          needsRender = true
        }
      }
      if (needsRender) {
        renderMermaid()
      }
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
    class="h-full overflow-y-auto bg-app-bg text-app-text" 
    style="font-size: var(--editor-font-size, 16px);"
  >
    <div 
      ref="container" 
      class="prose dark:prose-invert max-w-none p-4"
      v-html="html"
    ></div>
  </div>
</template>
