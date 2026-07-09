<script setup lang="ts">
import CHEAT_SHEET from '../lib/syntax-cheatsheet'

const emit = defineEmits<{ (e: 'insert', text: string): void }>()

async function handleClick(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
  emit('insert', text)
}
</script>

<template>
  <div class="w-64 flex-none border-r border-app-border bg-app-bg-secondary overflow-y-auto p-4 text-sm shadow-inner">
    <h2 class="font-bold mb-4 text-app-text">Syntax Reference</h2>
    
    <div v-for="cat in CHEAT_SHEET" :key="cat.id" class="mb-6">
      <h3 class="font-semibold text-app-text-muted mb-2 uppercase text-xs tracking-wider">{{ cat.title }}</h3>
      <ul class="space-y-3">
        <li v-for="item in cat.items" :key="item.label" class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <code 
              @click="handleClick(item.label)"
              class="px-1.5 py-0.5 bg-app-bg hover:bg-app-bg-hover cursor-pointer rounded font-mono text-xs text-app-text select-all transition-colors border border-app-border"
              title="Click to insert and copy"
            >
              {{ item.label }}
            </code>
          </div>
          <span class="text-xs text-app-text-muted">{{ item.desc }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
