<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { renderMarkdown } from '../lib/markdown'

const props = defineProps<{ source: string }>()

const container = ref<HTMLElement>()
const html = ref('')

function updatePreview() {
  html.value = renderMarkdown(props.source)
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
