<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { LanguageInfo } from "../lib/language-detector";
import Preview from "./Preview.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    filePath?: string | null;
    content: string;
    langCode?: string;
    availableLanguages?: LanguageInfo[];
    syncMode?: "header" | "percentage" | "off";
  }>(),
  {
    title: "Referenzdokument",
    filePath: null,
    langCode: "de",
    availableLanguages: () => [],
    syncMode: "header",
  },
);

const emit = defineEmits<{
  (
    e: "scroll",
    info: { fractionalLine: number; ratio: number; totalLines: number },
  ): void;
  (e: "user-interaction"): void;
  (e: "change-language", langCode: string): void;
  (e: "choose-file"): void;
  (e: "swap"): void;
  (e: "close"): void;
  (e: "open-url", url: string): void;
  (e: "set-sync-mode", mode: "header" | "percentage" | "off"): void;
}>();

const viewType = ref<"rendered" | "raw">("rendered");
const previewRef = ref<InstanceType<typeof Preview> | null>(null);
const rawTextareaRef = ref<HTMLTextAreaElement | null>(null);

let isProgrammaticScroll = false;
let unlockTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleUnlock() {
  if (unlockTimer) clearTimeout(unlockTimer);
  unlockTimer = setTimeout(() => {
    isProgrammaticScroll = false;
  }, 100);
}

function onPreviewScroll(info: { fractionalLine: number; ratio: number }) {
  if (isProgrammaticScroll) return;
  const lines = props.content.split("\n").length;
  emit("scroll", { ...info, totalLines: lines });
}

function onRawScroll() {
  if (isProgrammaticScroll || !rawTextareaRef.value) return;
  const el = rawTextareaRef.value;
  const maxScroll = el.scrollHeight - el.clientHeight;
  const ratio = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
  const lines = props.content.split("\n");
  const fractionalLine = 1 + ratio * Math.max(1, lines.length - 1);
  emit("scroll", { fractionalLine, ratio, totalLines: lines.length });
}

function onUserInteraction() {
  emit("user-interaction");
}

function scrollToFractionalLine(
  line: number,
  fallbackRatio?: number,
  totalLines?: number,
) {
  if (viewType.value === "rendered" && previewRef.value) {
    previewRef.value.scrollToFractionalLine(line, fallbackRatio, totalLines);
  } else if (viewType.value === "raw" && rawTextareaRef.value) {
    const el = rawTextareaRef.value;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    const linesCount = totalLines || props.content.split("\n").length;
    const ratio =
      linesCount > 1
        ? Math.max(0, Math.min(1, (line - 1) / (linesCount - 1)))
        : 0;
    isProgrammaticScroll = true;
    el.scrollTop = Math.round(ratio * maxScroll);
    scheduleUnlock();
  }
}

function scrollToRatio(ratio: number) {
  if (viewType.value === "rendered" && previewRef.value) {
    previewRef.value.scrollToRatio(ratio);
  } else if (viewType.value === "raw" && rawTextareaRef.value) {
    const el = rawTextareaRef.value;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    isProgrammaticScroll = true;
    el.scrollTop = Math.round(Math.max(0, Math.min(1, ratio)) * maxScroll);
    scheduleUnlock();
  }
}

defineExpose({
  scrollToFractionalLine,
  scrollToRatio,
});
</script>

<template>
  <div class="h-full flex flex-col bg-app-bg border-r border-app-border select-none min-w-0">
    <!-- Header / Reference Navigation Bar -->
    <div class="flex-none flex items-center justify-between px-3 py-1.5 bg-app-bg-secondary border-b border-app-border text-xs gap-2">
      <!-- Left: Title, Language Selector, File Picker -->
      <div class="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto">
        <span class="font-semibold text-app-text flex items-center gap-1.5 shrink-0 truncate max-w-[180px]" :title="filePath || title">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500 shrink-0">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span class="truncate">{{ title }}</span>
        </span>

        <!-- Language Code Badge / Selector -->
        <div v-if="availableLanguages && availableLanguages.length > 0" class="flex items-center shrink-0">
          <select
            :value="langCode"
            @change="emit('change-language', ($event.target as HTMLSelectElement).value)"
            class="bg-app-bg text-app-text text-[11px] font-mono border border-app-border rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
            title="Referenzsprache wechseln"
          >
            <option v-for="l in availableLanguages" :key="l.code" :value="l.code">
              {{ l.label }}
            </option>
          </select>
        </div>
        <span v-else class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-500 shrink-0">
          {{ langCode.toUpperCase() }}
        </span>

        <!-- Choose File Button -->
        <button
          type="button"
          @click="emit('choose-file')"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-app-bg hover:bg-app-bg-hover text-app-text-muted hover:text-app-text border border-app-border text-[11px] transition-colors shrink-0 cursor-pointer"
          title="Andere Referenzdatei wählen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Wählen...</span>
        </button>
      </div>

      <!-- Right: View Toggle, Swap Button, Close Button -->
      <div class="flex items-center gap-1 shrink-0">
        <!-- Rendered vs Raw Toggle -->
        <div class="flex items-center bg-app-bg rounded border border-app-border p-0.5">
          <button
            type="button"
            @click="viewType = 'rendered'"
            class="px-1.5 py-0.5 text-[10px] rounded transition-colors cursor-pointer"
            :class="viewType === 'rendered' ? 'bg-blue-500 text-white font-medium' : 'text-app-text-muted hover:text-app-text'"
            title="Formatierte Vorschau"
          >
            Vorschau
          </button>
          <button
            type="button"
            @click="viewType = 'raw'"
            class="px-1.5 py-0.5 text-[10px] rounded transition-colors cursor-pointer"
            :class="viewType === 'raw' ? 'bg-blue-500 text-white font-medium' : 'text-app-text-muted hover:text-app-text'"
            title="Markdown Quelltext"
          >
            Quelltext
          </button>
        </div>

        <!-- SWAP Button -->
        <button
          type="button"
          @click="emit('swap')"
          class="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-semibold transition-colors cursor-pointer shadow-xs active:scale-95"
          title="Seiten tauschen: Referenz und Editor wechseln (SWAP)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 3 21 8 16 13"/>
            <line x1="21" y1="8" x2="9" y2="8"/>
            <polyline points="8 21 3 16 8 11"/>
            <line x1="3" y1="16" x2="15" y2="16"/>
          </svg>
          <span>SWAP</span>
        </button>

        <!-- Close QA Pane Button -->
        <button
          type="button"
          @click="emit('close')"
          class="w-5 h-5 flex items-center justify-center rounded hover:bg-app-bg-hover text-app-text-muted hover:text-app-text text-sm transition-colors cursor-pointer"
          title="QA-Vergleichsmodus schließen"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 min-h-0 overflow-hidden relative">
      <div v-show="viewType === 'rendered'" class="w-full h-full">
        <Preview
          ref="previewRef"
          :source="content"
          @scroll="onPreviewScroll"
          @user-interaction="onUserInteraction"
          @open-url="url => emit('open-url', url)"
        />
      </div>
      <div v-show="viewType === 'raw'" class="w-full h-full">
        <textarea
          ref="rawTextareaRef"
          readonly
          :value="content"
          @scroll="onRawScroll"
          @mousedown="onUserInteraction"
          placeholder="Kein Referenzinhalt geladen."
          class="w-full h-full p-4 bg-app-bg text-app-text font-mono text-xs leading-relaxed resize-none outline-none select-text border-none overflow-y-auto"
        ></textarea>
      </div>
    </div>
  </div>
</template>
