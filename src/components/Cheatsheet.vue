<script setup lang="ts">
import CHEAT_SHEET from '../lib/syntax-cheatsheet'

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}
</script>

<template>
  <div class="w-64 flex-none border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-y-auto p-4 text-sm shadow-inner">
    <h2 class="font-bold mb-4 text-zinc-800 dark:text-zinc-200">Syntax Reference</h2>
    
    <div v-for="cat in CHEAT_SHEET" :key="cat.id" class="mb-6">
      <h3 class="font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase text-xs tracking-wider">{{ cat.title }}</h3>
      <ul class="space-y-3">
        <li v-for="item in cat.items" :key="item.label" class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <code 
              @click="copyToClipboard(item.label)"
              class="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 select-all transition-colors"
              title="Click to copy"
            >
              {{ item.label }}
            </code>
          </div>
          <span class="text-xs text-zinc-500 dark:text-zinc-400">{{ item.desc }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
