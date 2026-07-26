<script setup lang="ts">
import { ref, watch, onMounted } from "vue";

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "update", settings: any): void;
}>();

const currentTheme = ref("system");
const fontSize = ref(16);
const autoSave = ref(true);
const vimMode = ref(false);

onMounted(() => {
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

import { checkForUpdates, installAppUpdate } from "../lib/updater";

const updateState = ref<
  "idle" | "checking" | "available" | "up-to-date" | "downloading" | "error"
>("idle");
const updateMessage = ref("");
const activeUpdate = ref<any>(null);

async function checkUpdates() {
  updateState.value = "checking";
  updateMessage.value = "Checking for updates...";
  activeUpdate.value = null;

  const result = await checkForUpdates();
  if (result.error) {
    updateState.value = "error";
    updateMessage.value = `Update check failed: ${result.error}`;
  } else if (result.available && result.update) {
    updateState.value = "available";
    activeUpdate.value = result.update;
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
    await installAppUpdate(activeUpdate.value, (downloaded, total) => {
      if (total && total > 0) {
        const pct = Math.round((downloaded / total) * 100);
        updateMessage.value = `Downloading update... ${pct}%`;
      }
    });
    updateMessage.value = "Update installed! Restarting app...";
  } catch (err: any) {
    updateState.value = "error";
    updateMessage.value = `Installation failed: ${err?.message || String(err)}`;
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-app-bg border border-app-border rounded-xl shadow-2xl w-[400px] overflow-hidden flex flex-col">
      <div class="px-4 py-3 border-b border-app-border flex justify-between items-center bg-app-bg-secondary">
        <h2 class="font-semibold text-app-text">Settings</h2>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text text-xl leading-none">&times;</button>
      </div>
      
      <div class="p-6 flex flex-col gap-6">
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

        <!-- Software Updates -->
        <div class="pt-4 border-t border-app-border flex flex-col gap-2">
          <label class="text-sm font-medium text-app-text">Software Updates</label>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-app-text-muted">ZenTauri</span>
            <button 
              @click="checkUpdates" 
              :disabled="updateState === 'checking' || updateState === 'downloading'"
              class="px-3 py-1.5 bg-app-bg-secondary hover:bg-app-border border border-app-border text-app-text text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {{ updateState === 'checking' ? 'Checking...' : updateState === 'downloading' ? 'Downloading...' : 'Check for Updates' }}
            </button>
          </div>

          <div v-if="updateMessage" :class="['text-xs mt-1 p-2 rounded', updateState === 'available' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : updateState === 'error' ? 'bg-red-500/10 text-red-500' : 'text-app-text-muted']">
            {{ updateMessage }}
          </div>

          <button
            v-if="updateState === 'available' && activeUpdate"
            @click="installUpdate"
            class="mt-1 w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold rounded-md transition-colors"
          >
            Download & Install Update
          </button>
        </div>
      </div>
      
      <div class="px-4 py-3 border-t border-app-border bg-app-bg-secondary text-right">
        <button @click="$emit('close')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">Close</button>
      </div>
    </div>
  </div>
</template>
