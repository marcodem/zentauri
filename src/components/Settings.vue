<script setup lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Update } from "@tauri-apps/plugin-updater";
import { computed, onMounted, ref, shallowRef, toRaw, watch } from "vue";
import { renderMarkdown } from "../lib/markdown";
import { checkForUpdates, installAppUpdate } from "../lib/updater";

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "update", settings: Record<string, unknown>): void;
}>();

const currentTheme = ref("system");
const fontSize = ref(16);
const autoSave = ref(true);
const vimMode = ref(false);

const appVersion = ref(
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.1.10",
);
const buildNumber = ref(
  typeof __BUILD_NUMBER__ !== "undefined" ? __BUILD_NUMBER__ : "dev",
);

onMounted(async () => {
  const settingsStr = localStorage.getItem("zentauri-settings");
  if (settingsStr) {
    try {
      const s = JSON.parse(settingsStr);
      if (s.theme) currentTheme.value = s.theme;
      if (s.fontSize) fontSize.value = s.fontSize;
      if (s.autoSave !== undefined) autoSave.value = s.autoSave;
      if (s.vimMode !== undefined) vimMode.value = s.vimMode;
    } catch (e) {}
  }
  applySettings();

  try {
    const v = await getVersion();
    if (v) appVersion.value = v;
  } catch (e) {}
});

watch([currentTheme, fontSize, autoSave, vimMode], () => {
  const s = {
    theme: currentTheme.value,
    fontSize: fontSize.value,
    autoSave: autoSave.value,
    vimMode: vimMode.value,
  };
  localStorage.setItem("zentauri-settings", JSON.stringify(s));
  applySettings();
});

function applySettings() {
  const html = document.documentElement;
  html.setAttribute("data-theme", currentTheme.value);
  html.style.setProperty("--editor-font-size", `${fontSize.value}px`);

  const s = {
    theme: currentTheme.value,
    fontSize: fontSize.value,
    autoSave: autoSave.value,
    vimMode: vimMode.value,
  };
  emit("update", s);
}

const updateState = ref<
  "idle" | "checking" | "available" | "up-to-date" | "downloading" | "error"
>("idle");
const updateMessage = ref("");
const updateBody = ref("");
const showSettingsNotes = ref(true);
const activeUpdate = shallowRef<Update | null>(null);

const renderedSettingsNotes = computed(() => {
  if (!updateBody.value) return "";
  return renderMarkdown(updateBody.value, { markdownExtensionsEnabled: false });
});

async function checkUpdates() {
  updateState.value = "checking";
  updateMessage.value = "Checking for updates...";
  activeUpdate.value = null;
  updateBody.value = "";

  const result = await checkForUpdates();
  if (result.error) {
    updateState.value = "error";
    updateMessage.value = `Update check failed: ${result.error}`;
  } else if (result.available && result.update) {
    updateState.value = "available";
    activeUpdate.value = result.update;
    updateBody.value = result.body || "";
    updateMessage.value = `New version v${result.version} is available!`;
  } else {
    updateState.value = "up-to-date";
    updateMessage.value = "ZenTauri is up to date.";
  }
}

async function installUpdate() {
  if (!activeUpdate.value) return;
  updateState.value = "downloading";
  updateMessage.value = "Downloading update...";
  try {
    const rawUpdate = toRaw(activeUpdate.value);
    await installAppUpdate(rawUpdate, (downloaded, total) => {
      if (total && total > 0) {
        const pct = Math.round((downloaded / total) * 100);
        updateMessage.value = `Downloading update... ${pct}%`;
      }
    });
    updateMessage.value = "Update installed! Restarting app...";
    await relaunch();
  } catch (err: unknown) {
    updateState.value = "error";
    updateMessage.value = `Installation failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-app-bg border border-app-border rounded-xl shadow-2xl w-[440px] overflow-hidden flex flex-col">
      <div class="px-4 py-3 border-b border-app-border flex justify-between items-center bg-app-bg-secondary">
        <h2 class="font-semibold text-app-text">Settings</h2>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text text-xl leading-none">&times;</button>
      </div>
      
      <div class="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
        <!-- Theme -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-app-text">Theme</label>
          <select 
            id="theme" 
            v-model="currentTheme"
            class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-app-border bg-app-bg text-app-text focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="gruvbox">Gruvbox</option>
            <option value="solarized">Solarized Light</option>
            <option value="solarized-dark">Solarized Dark</option>
            <option value="catppuccin">Catppuccin (Mocha)</option>
            <option value="tokyonight">Tokyo Night</option>
            <option value="nord">Nord</option>
            <option value="dracula">Dracula</option>
          </select>
        </div>
        
        <!-- Font Size -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-app-text flex justify-between">
            <span>Font Size</span>
            <span>{{ fontSize }}px</span>
          </label>
          <input type="range" v-model="fontSize" min="12" max="24" step="1" class="w-full h-2 bg-app-bg-secondary rounded-lg appearance-none cursor-pointer">
        </div>

        <!-- Auto-Save -->
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-app-text">Auto-Save</label>
          <input type="checkbox" v-model="autoSave" class="w-5 h-5 text-blue-600 bg-app-bg border-app-border rounded cursor-pointer focus:ring-blue-500">
        </div>

        <!-- Vim Mode -->
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-app-text">Vim Mode</label>
          <input type="checkbox" v-model="vimMode" class="w-5 h-5 text-blue-600 bg-app-bg border-app-border rounded cursor-pointer focus:ring-blue-500">
        </div>

        <!-- About ZenTauri & Software Updates -->
        <div class="pt-5 border-t border-app-border flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-lg shadow-sm">
                Z
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-app-text">ZenTauri</span>
                <span class="text-xs text-app-text-muted">
                  Version {{ appVersion }} <span class="font-mono text-[11px] opacity-75">({{ buildNumber }})</span>
                </span>
              </div>
            </div>
            
            <button 
              @click="checkUpdates" 
              :disabled="updateState === 'checking' || updateState === 'downloading'"
              class="px-3 py-1.5 bg-app-bg-secondary hover:bg-app-border border border-app-border text-app-text text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {{ updateState === 'checking' ? 'Checking...' : updateState === 'downloading' ? 'Downloading...' : 'Check for Updates' }}
            </button>
          </div>

          <div v-if="updateMessage" :class="['text-xs p-2.5 rounded-md', updateState === 'available' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : updateState === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-app-bg-secondary text-app-text-muted border border-app-border']">
            {{ updateMessage }}
          </div>

          <!-- Release Notes in Settings -->
          <div
            v-if="updateState === 'available' && updateBody && updateBody.trim()"
            class="flex flex-col gap-1.5"
          >
            <button
              type="button"
              @click="showSettingsNotes = !showSettingsNotes"
              class="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>Release Notes</span>
              <span class="text-[11px] opacity-80">{{ showSettingsNotes ? 'Ausblenden' : 'Anzeigen' }}</span>
            </button>
            <div
              v-if="showSettingsNotes"
              class="max-h-40 overflow-y-auto p-2.5 rounded-md bg-app-bg-secondary border border-app-border text-xs text-app-text leading-relaxed select-text release-notes-content"
              v-html="renderedSettingsNotes"
            ></div>
          </div>

          <button
            v-if="updateState === 'available' && activeUpdate"
            @click="installUpdate"
            class="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold rounded-md transition-colors shadow-sm"
          >
            Download & Install Update
          </button>

          <p class="text-[11px] text-app-text-muted leading-relaxed">
            Fast, extensible Markdown editor powered by Tauri and Vue 3.
          </p>
        </div>
      </div>
      
      <div class="px-4 py-3 border-t border-app-border bg-app-bg-secondary text-right">
        <button @click="$emit('close')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.release-notes-content :deep(h1),
.release-notes-content :deep(h2),
.release-notes-content :deep(h3),
.release-notes-content :deep(h4) {
  font-weight: 600;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
  color: var(--app-text, inherit);
}
.release-notes-content :deep(h1) { font-size: 0.95rem; }
.release-notes-content :deep(h2) { font-size: 0.875rem; }
.release-notes-content :deep(h3) { font-size: 0.8rem; }
.release-notes-content :deep(ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}
.release-notes-content :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}
.release-notes-content :deep(li) {
  margin: 0.125rem 0;
}
.release-notes-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  padding: 0.1rem 0.25rem;
  border-radius: 0.25rem;
  background-color: rgba(125, 125, 125, 0.15);
}
.release-notes-content :deep(p) {
  margin: 0.25rem 0;
}
.release-notes-content :deep(a) {
  color: #b45309;
  text-decoration: underline;
}
:root.dark .release-notes-content :deep(a),
.dark .release-notes-content :deep(a) {
  color: #eab308;
}
</style>
