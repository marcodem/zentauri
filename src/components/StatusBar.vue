<script setup lang="ts">
import { computed } from "vue";
import type { CursorInfo } from "./Editor.vue";

const props = withDefaults(
  defineProps<{
    cursorInfo?: CursorInfo;
    wordCount?: number;
    charCount?: number;
    readTime?: number;
    encoding?: string;
    eol?: string;
    indentation?: string;
    vimMode?: boolean;
    syncScroll?: boolean;
    syncMode?: "header" | "percentage" | "off";
    viewMode?: string;
    workspaceName?: string | null;
    activeFilePath?: string | null;
    saveStatus?: {
      text: string;
      dotClass: string;
      title: string;
    };
  }>(),
  {
    cursorInfo: () => ({ line: 1, column: 1, selectedChars: 0, totalLines: 1 }),
    wordCount: 0,
    charCount: 0,
    readTime: 1,
    encoding: "UTF-8",
    eol: "LF",
    indentation: "Spaces: 2",
    vimMode: false,
    syncScroll: true,
    syncMode: "header",
    viewMode: "split",
    workspaceName: null,
    activeFilePath: null,
    saveStatus: () => ({
      text: "Saved",
      dotClass: "bg-emerald-500",
      title: "Saved",
    }),
  },
);

defineEmits<(e: "jump-to-line") => void>();

const cursorDisplay = computed(() => {
  const base = `Ln ${props.cursorInfo.line}, Col ${props.cursorInfo.column}`;
  if (props.cursorInfo.selectedChars > 0) {
    return `${base} (${props.cursorInfo.selectedChars} selected)`;
  }
  return base;
});
</script>

<template>
  <footer
    class="flex-none h-[22px] bg-app-bg-secondary border-t border-app-border flex items-center justify-between px-2.5 text-[11px] font-sans select-none text-app-text-muted print:hidden z-20"
    data-tauri-drag-region
  >
    <!-- Left Section: Workspace & Status -->
    <div class="flex items-center gap-2 min-w-0">
      <!-- Workspace Badge -->
      <div 
        class="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-app-text-muted hover:text-app-text hover:bg-app-bg-hover transition-colors truncate cursor-default"
        :title="workspaceName ? `Workspace Folder: ${workspaceName}` : 'No Workspace Open'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-80">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="truncate font-medium">{{ workspaceName || 'ZenTauri' }}</span>
      </div>

      <!-- Save Indicator Dot & Text -->
      <div 
        class="hidden sm:flex items-center gap-1.5 px-1.5 py-0.5 rounded text-app-text-muted cursor-default"
        :title="saveStatus.title"
      >
        <span class="w-1.5 h-1.5 rounded-full inline-block shrink-0 shadow-xs" :class="saveStatus.dotClass"></span>
        <span class="truncate">{{ saveStatus.text }}</span>
      </div>
    </div>

    <!-- Right Section: Editor Info (VS Code Standard) -->
    <div class="flex items-center gap-1 font-mono shrink-0">
      <!-- Cursor Position (Ln, Col) & Selection -->
      <button
        type="button"
        @click="$emit('jump-to-line')"
        class="px-1.5 py-0.5 rounded hover:bg-app-bg-hover hover:text-app-text transition-colors cursor-pointer tabular-nums flex items-center gap-1"
        :title="`Line ${cursorInfo.line}, Column ${cursorInfo.column} (Click to Go to Line)`"
      >
        <span>{{ cursorDisplay }}</span>
      </button>

      <!-- Document Stats (Words & Chars) -->
      <div
        class="hidden sm:flex items-center px-1.5 py-0.5 rounded hover:bg-app-bg-hover hover:text-app-text transition-colors cursor-default tabular-nums"
        :title="`${wordCount.toLocaleString()} words, ${charCount.toLocaleString()} characters (estimated ${readTime} min read)`"
      >
        <span>{{ wordCount.toLocaleString() }} words</span>
      </div>

      <!-- Indentation Spaces -->
      <div
        class="hidden md:flex items-center px-1.5 py-0.5 rounded hover:bg-app-bg-hover hover:text-app-text transition-colors cursor-default"
        title="Indentation: 2 spaces"
      >
        <span>{{ indentation }}</span>
      </div>

      <!-- Encoding -->
      <div
        class="hidden md:flex items-center px-1.5 py-0.5 rounded hover:bg-app-bg-hover hover:text-app-text transition-colors cursor-default"
        title="File Encoding: UTF-8"
      >
        <span>{{ encoding }}</span>
      </div>

      <!-- Line Endings (LF) -->
      <div
        class="hidden lg:flex items-center px-1.5 py-0.5 rounded hover:bg-app-bg-hover hover:text-app-text transition-colors cursor-default"
        title="End of Line: LF (Unix/macOS)"
      >
        <span>{{ eol }}</span>
      </div>

      <!-- Vim Mode Indicator (Display only) -->
      <span
        v-if="vimMode"
        class="px-1.5 py-0.5 rounded font-mono font-semibold text-[10px] bg-blue-500/15 text-blue-500 dark:text-blue-400 select-none cursor-default"
        title="Vim-Modus aktiv"
      >
        VIM
      </span>

      <!-- Sync Scroll Indicator (in Split or QA mode, display only) -->
      <span
        v-if="viewMode === 'split' || viewMode === 'qa-2col' || viewMode === 'qa-3col'"
        class="px-1.5 py-0.5 rounded flex items-center gap-1 cursor-default select-none"
        :class="syncMode !== 'off' ? 'text-amber-500 dark:text-amber-400 font-medium' : 'text-app-text-muted/60'"
        :title="syncScroll && syncMode !== 'off' ? 'Scroll Synchronization: Active' : 'Scroll Synchronization: Paused'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span class="text-[10px] hidden xl:inline">{{ syncMode === 'header' ? 'Sync: Header' : syncMode === 'percentage' ? 'Sync: Pct' : 'Async' }}</span>
      </span>
    </div>
  </footer>
</template>
