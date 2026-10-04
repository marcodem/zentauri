<script setup lang="ts">
import { relaunch } from "@tauri-apps/plugin-process";
import type { Update } from "@tauri-apps/plugin-updater";
import { onMounted, onUnmounted, ref, shallowRef, toRaw } from "vue";
import { checkForUpdates, installAppUpdate } from "../lib/updater";

const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__ !== undefined;

const isVisible = ref(false);
const updateVersion = ref("");
const updateBody = ref("");
const activeUpdate = shallowRef<Update | null>(null);
const isInstalling = ref(false);
const installProgress = ref(0);
const installStatus = ref("");
const errorMessage = ref("");

let checkTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;

const DISMISS_KEY = "zentauri_dismissed_update_version";

async function runUpdateCheck() {
  if (!isTauri) return;
  try {
    const result = await checkForUpdates();
    if (result.available && result.update && result.version) {
      // Check if user already dismissed this specific version in this session
      const dismissed = sessionStorage.getItem(DISMISS_KEY);
      if (dismissed === result.version) {
        return;
      }
      activeUpdate.value = result.update;
      updateVersion.value = result.version;
      updateBody.value = result.body || "";
      errorMessage.value = "";
      isVisible.value = true;
    }
  } catch (err) {
    console.warn("Silent background update check error:", err);
  }
}

function dismiss() {
  isVisible.value = false;
  if (updateVersion.value) {
    sessionStorage.setItem(DISMISS_KEY, updateVersion.value);
  }
}

async function handleInstall() {
  if (!activeUpdate.value) return;
  isInstalling.value = true;
  installProgress.value = 0;
  installStatus.value = "Herunterladen...";
  errorMessage.value = "";

  try {
    const rawUpdate = toRaw(activeUpdate.value);
    await installAppUpdate(rawUpdate, (downloaded, total) => {
      if (total && total > 0) {
        installProgress.value = Math.min(
          100,
          Math.round((downloaded / total) * 100),
        );
        installStatus.value = `Herunterladen... ${installProgress.value}%`;
      }
    });
    installStatus.value = "Update installiert! App wird neu gestartet...";
    await relaunch();
  } catch (err: unknown) {
    isInstalling.value = false;
    errorMessage.value = err instanceof Error ? err.message : String(err);
    installStatus.value = "Installation fehlgeschlagen.";
  }
}

onMounted(() => {
  if (!isTauri) return;
  // Startup check after 4 seconds to ensure smooth and instant editor boot
  checkTimer = setTimeout(runUpdateCheck, 4000);
  // Periodic check every 4 hours while running
  intervalTimer = setInterval(runUpdateCheck, 4 * 60 * 60 * 1000);
});

onUnmounted(() => {
  if (checkTimer) clearTimeout(checkTimer);
  if (intervalTimer) clearInterval(intervalTimer);
});
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-4 opacity-0 scale-95"
    enter-to-class="transform translate-y-0 opacity-100 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100 scale-100"
    leave-to-class="transform translate-y-4 opacity-0 scale-95"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-5 right-5 z-50 w-96 rounded-xl border border-amber-600/30 dark:border-amber-400/30 bg-app-bg/95 dark:bg-[#0f1e35]/95 backdrop-blur-md shadow-2xl p-4 text-app-text select-none"
      role="alert"
      aria-live="polite"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h4 class="text-sm font-semibold text-app-text flex items-center gap-1.5">
              Neues Update verfügbar
              <span class="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-mono font-medium text-amber-700 dark:text-amber-300">
                v{{ updateVersion }}
              </span>
            </h4>
            <p class="text-xs text-app-text-muted mt-0.5">
              Eine neue Version von ZenTauri steht bereit.
            </p>
          </div>
        </div>

        <button
          v-if="!isInstalling"
          @click="dismiss"
          class="text-app-text-muted hover:text-app-text p-1 rounded-md transition-colors"
          title="Schließen"
          aria-label="Schließen"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Installation Progress Bar -->
      <div v-if="isInstalling" class="mt-3">
        <div class="flex justify-between text-xs text-app-text-muted mb-1">
          <span>{{ installStatus }}</span>
          <span class="font-mono">{{ installProgress }}%</span>
        </div>
        <div class="w-full bg-app-bg-secondary h-2 rounded-full overflow-hidden border border-app-border">
          <div
            class="bg-amber-600 dark:bg-amber-500 h-full transition-all duration-200"
            :style="{ width: `${installProgress}%` }"
          ></div>
        </div>
      </div>

      <!-- Error message -->
      <div v-else-if="errorMessage" class="mt-2 text-xs text-rose-500">
        {{ errorMessage }}
      </div>

      <!-- Action Buttons -->
      <div v-if="!isInstalling" class="mt-3.5 flex items-center justify-end gap-2 pt-2 border-t border-app-border/50">
        <button
          @click="dismiss"
          class="px-3 py-1.5 text-xs font-medium text-app-text-muted hover:text-app-text rounded-lg hover:bg-app-bg-hover transition-colors"
        >
          Später
        </button>
        <button
          @click="handleInstall"
          class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 transition-colors shadow-sm flex items-center gap-1.5"
        >
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Jetzt aktualisieren
        </button>
      </div>
    </div>
  </Transition>
</template>
