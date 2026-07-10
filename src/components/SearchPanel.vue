<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  fileContent: string
}>()

const emit = defineEmits<{
  (e: 'jump-to-line', lineNum: number): void
}>()

const searchQuery = ref('')
const caseSensitive = ref(false)

interface SearchMatch {
  lineNum: number
  text: string
  beforeMatch: string
  matchText: string
  afterMatch: string
}

const matches = computed<SearchMatch[]>(() => {
  const query = searchQuery.value
  if (!query) return []
  
  const lines = props.fileContent.split('\n')
  const results: SearchMatch[] = []
  
  const lowerQuery = query.toLowerCase()
  
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]
    let index = -1
    
    if (caseSensitive.value) {
      index = lineText.indexOf(query)
    } else {
      index = lineText.toLowerCase().indexOf(lowerQuery)
    }
    
    if (index !== -1) {
      const matchText = lineText.substring(index, index + query.length)
      const beforeMatch = lineText.substring(0, index)
      const afterMatch = lineText.substring(index + query.length)
      
      results.push({
        lineNum: i + 1,
        text: lineText,
        beforeMatch,
        matchText,
        afterMatch
      })
      
      if (results.length >= 100) {
        break // Cap at 100 matches
      }
    }
  }
  
  return results
})

function handleMatchClick(lineNum: number) {
  emit('jump-to-line', lineNum)
}
</script>

<template>
  <div class="w-64 flex-none border-r border-app-border bg-app-bg-secondary overflow-hidden p-4 text-sm shadow-inner flex flex-col h-full">
    <h2 class="font-bold mb-4 text-app-text flex-none">Search in File</h2>
    
    <!-- Inputs -->
    <div class="flex flex-col gap-2 mb-4 flex-none">
      <input 
        v-model="searchQuery"
        type="text"
        placeholder="Search..."
        class="w-full px-3 py-1.5 bg-app-bg border border-app-border rounded-md text-app-text focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div class="flex items-center gap-2">
        <input 
          id="caseSensitive"
          type="checkbox" 
          v-model="caseSensitive"
          class="w-4 h-4 text-blue-600 bg-app-bg border-app-border rounded cursor-pointer focus:ring-blue-500"
        />
        <label for="caseSensitive" class="text-xs text-app-text-muted select-none cursor-pointer">Case Sensitive</label>
      </div>
    </div>
    
    <!-- Results Info -->
    <div class="mb-3 text-xs text-app-text-muted flex-none">
      <span v-if="searchQuery">
        {{ matches.length === 100 ? '100+ matches' : `${matches.length} matches` }}
      </span>
      <span v-else>
        Enter search term...
      </span>
    </div>

    <!-- Match List -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <ul class="space-y-2 pr-1">
        <li 
          v-for="match in matches" 
          :key="match.lineNum"
          @click="handleMatchClick(match.lineNum)"
          class="p-2 bg-app-bg hover:bg-app-bg-hover rounded border border-app-border cursor-pointer transition-colors"
        >
          <div class="flex justify-between items-center mb-1 text-[10px] text-app-text-muted font-mono">
            <span>Line {{ match.lineNum }}</span>
          </div>
          <p class="text-xs break-all font-mono line-clamp-2 text-app-text">
            <span>{{ match.beforeMatch }}</span>
            <mark class="bg-blue-500/25 text-app-text rounded px-0.5">{{ match.matchText }}</mark>
            <span>{{ match.afterMatch }}</span>
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>
