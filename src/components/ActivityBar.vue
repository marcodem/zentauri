<script setup lang="ts">
defineProps<{
  activeView: string | null
}>()

defineEmits<{
  (e: 'toggle-view', view: string): void
  (e: 'action', action: string): void
}>()
</script>

<template>
  <div class="w-12 flex-none bg-app-bg-secondary border-r border-app-border flex flex-col items-center py-3 select-none print:hidden z-20">
    <!-- Top Items -->
    <div class="flex flex-col gap-4 w-full items-center flex-1">
      <!-- Explorer -->
      <button 
        @click="$emit('toggle-view', 'explorer')"
        class="relative p-2 rounded-lg transition-colors group flex items-center justify-center w-10 h-10"
        :class="activeView === 'explorer' ? 'text-app-text' : 'text-app-text-muted hover:text-app-text'"
        title="Explorer (Cmd/Ctrl+Shift+E)"
      >
        <div v-if="activeView === 'explorer'" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      </button>

      <!-- Search (Placeholder for future) -->
      <button 
        @click="$emit('toggle-view', 'search')"
        class="relative p-2 rounded-lg transition-colors group flex items-center justify-center w-10 h-10"
        :class="activeView === 'search' ? 'text-app-text' : 'text-app-text-muted hover:text-app-text'"
        title="Search (Cmd/Ctrl+Shift+F)"
      >
        <div v-if="activeView === 'search'" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>

      <!-- Cheatsheet -->
      <button 
        @click="$emit('toggle-view', 'cheatsheet')"
        class="relative p-2 rounded-lg transition-colors group flex items-center justify-center w-10 h-10"
        :class="activeView === 'cheatsheet' ? 'text-app-text' : 'text-app-text-muted hover:text-app-text'"
        title="Markdown Cheatsheet"
      >
        <div v-if="activeView === 'cheatsheet'" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
      </button>
      
      <!-- Manual/Help -->
      <button 
        @click="$emit('toggle-view', 'help')"
        class="relative p-2 rounded-lg transition-colors group flex items-center justify-center w-10 h-10"
        :class="activeView === 'help' ? 'text-app-text' : 'text-app-text-muted hover:text-app-text'"
        title="Hilfe / Manual"
      >
        <div v-if="activeView === 'help'" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <path d="M12 17h.01"></path>
        </svg>
      </button>
    </div>

    <!-- Bottom Items -->
    <div class="flex flex-col gap-4 w-full items-center">
      <!-- Print -->
      <button 
        @click="$emit('action', 'print')"
        class="p-2 rounded-lg text-app-text-muted hover:text-app-text transition-colors flex items-center justify-center w-10 h-10"
        title="Export to PDF / Print"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
      </button>

      <!-- Settings -->
      <button 
        @click="$emit('toggle-view', 'settings')"
        class="relative p-2 rounded-lg transition-colors group flex items-center justify-center w-10 h-10"
        :class="activeView === 'settings' ? 'text-app-text' : 'text-app-text-muted hover:text-app-text'"
        title="Settings"
      >
        <div v-if="activeView === 'settings'" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  </div>
</template>
