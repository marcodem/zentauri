<script setup lang="ts">
import { ref } from 'vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
import Cheatsheet from './components/Cheatsheet.vue'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const markdownSource = ref(`# Welcome to Zentauri

This is a minimal Markdown editor based on Tauri and Vue.

::: important[Check it out]
Try the extensive Markdown extensions ported from ZenNotes!
:::

You can use math: $e^{i\\pi} + 1 = 0$

Or Mermaid:
\`\`\`mermaid
graph TD
  A[Tauri] --> B(Vue)
  B --> C{Zentauri}
\`\`\`
`)

const currentFilePath = ref<string | null>(null)
const showPreview = ref(true)
const showCheatsheet = ref(false)

async function handleOpenFile() {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Markdown',
      extensions: ['md', 'markdown']
    }]
  })
  
  if (selected && typeof selected === 'string') {
    currentFilePath.value = selected
    markdownSource.value = await readTextFile(selected)
  }
}

async function handleSaveFile() {
  if (currentFilePath.value) {
    await writeTextFile(currentFilePath.value, markdownSource.value)
  } else {
    const selected = await save({
      filters: [{
        name: 'Markdown',
        extensions: ['md', 'markdown']
      }]
    })
    
    if (selected && typeof selected === 'string') {
      currentFilePath.value = selected
      await writeTextFile(selected, markdownSource.value)
    }
  }
}
</script>

<template>
  <main class="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
    <!-- Toolbar -->
    <header class="flex-none flex items-center px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 select-none" data-tauri-drag-region>
      <div class="flex gap-2 z-10 relative">
        <button 
          @click="showCheatsheet = !showCheatsheet"
          class="px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors border border-transparent dark:border-zinc-700 shadow-sm"
          :class="{'ring-2 ring-zinc-400 dark:ring-zinc-500': showCheatsheet}"
        >
          Cheatsheet
        </button>
        <button 
          @click="handleOpenFile"
          class="px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors border border-transparent dark:border-zinc-700 shadow-sm"
        >
          Open File
        </button>
        <button 
          @click="handleSaveFile"
          class="px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors border border-transparent dark:border-zinc-700 shadow-sm"
        >
          Save
        </button>
      </div>
      <div class="flex-1 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400 absolute left-0 right-0 pointer-events-none">
        {{ currentFilePath ? currentFilePath.split(/[/\\]/).pop() : 'Untitled Document' }}
      </div>
      <div class="flex gap-2 z-10 relative ml-auto">
        <button 
          @click="showPreview = !showPreview"
          class="px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors border border-transparent dark:border-zinc-700 shadow-sm"
          :class="{'ring-2 ring-zinc-400 dark:ring-zinc-500': showPreview}"
        >
          Preview
        </button>
      </div>
    </header>

    <!-- Workspace -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Cheatsheet Pane -->
      <Cheatsheet v-if="showCheatsheet" />

      <!-- Editor Pane -->
      <div class="flex-1 h-full border-r border-zinc-200 dark:border-zinc-800">
        <Editor v-model="markdownSource" />
      </div>
      
      <!-- Preview Pane -->
      <div v-if="showPreview" class="flex-1 h-full bg-zinc-50 dark:bg-zinc-900">
        <Preview :source="markdownSource" />
      </div>
    </div>
  </main>
</template>