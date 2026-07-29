<script setup lang="ts">
import {
  ref,
  watch,
  onMounted,
  computed,
  nextTick,
  onBeforeUnmount,
} from "vue";
import Editor from "./components/Editor.vue";
import Preview from "./components/Preview.vue";
import Cheatsheet from "./components/Cheatsheet.vue";
import FileTree from "./components/FileTree.vue";
import Settings from "./components/Settings.vue";
import HelpSystem from "./components/HelpSystem.vue";
import SearchPanel from "./components/SearchPanel.vue";
import ActivityBar from "./components/ActivityBar.vue";
import { autoRepairMarkdown } from "./lib/auto-repair";
import CHEAT_SHEET, { type SyntaxItem } from "./lib/syntax-cheatsheet";

import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import debounce from "lodash.debounce";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface Tab {
  id: string;
  path: string;
  title: string;
  content: string;
  isWeb?: boolean;
  url?: string;
}

const defaultContent = `# Welcome to Zentauri

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
`;

const tabs = ref<Tab[]>([]);
const activeTabIndex = ref(-1);

const activeTab = computed(() => {
  if (activeTabIndex.value >= 0 && activeTabIndex.value < tabs.value.length) {
    return tabs.value[activeTabIndex.value];
  }
  return null;
});

watch(
  () => activeTab.value?.title,
  (newTitle) => {
    if (newTitle) {
      const nameWithoutExt = newTitle.replace(/\.[^/.]+$/, "");
      document.title = nameWithoutExt;
    } else {
      document.title = "Zentauri";
    }
  },
  { immediate: true },
);

const markdownSource = ref("");
const editorRef = ref<InstanceType<typeof Editor> | null>(null);
const fileTreeRef = ref<InstanceType<typeof FileTree> | null>(null);

const workspaceRoot = ref<string | null>(null);
const workspaceRoots = ref<string[]>([]);
const sidebarWidth = ref(256);
const isResizingSidebar = ref(false);

function saveWorkspaceRoots() {
  localStorage.setItem("zentauri-workspace-folders", JSON.stringify(workspaceRoots.value));
  if (workspaceRoots.value.length > 0) {
    workspaceRoot.value = workspaceRoots.value[0];
    localStorage.setItem("zentauri-workspace", workspaceRoots.value[0]);
  } else {
    workspaceRoot.value = null;
    localStorage.removeItem("zentauri-workspace");
  }
}

function addWorkspaceFolder(folderPath: string) {
  if (!folderPath) return;
  const normalizedNew = folderPath.replace(/\\/g, "/");

  // Check if new folder is already covered by an existing parent folder
  const existingParent = workspaceRoots.value.find((f) => {
    const norm = f.replace(/\\/g, "/");
    return normalizedNew === norm || normalizedNew.startsWith(norm + "/");
  });

  if (existingParent) {
    showExplorerView();
    return;
  }

  // Remove any subfolders of the new folder that were previously open separately
  workspaceRoots.value = workspaceRoots.value.filter((f) => {
    const norm = f.replace(/\\/g, "/");
    return !norm.startsWith(normalizedNew + "/");
  });

  workspaceRoots.value.push(folderPath);
  saveWorkspaceRoots();
  showExplorerView();
}

function cleanupOrphanTabsAndWorkspace() {
  if (workspaceRoots.value.length === 0) {
    tabs.value = [];
    openTab("Untitled Document", `untitled://${Date.now()}`, "");
    saveTabsState();
    return;
  }

  const validTabs = tabs.value.filter((tab) => {
    if (!tab.path || tab.path.startsWith("untitled://") || tab.isWeb) {
      return false;
    }
    const cleanTabPath = tab.path
      .replace("browser://", "")
      .replace(/\\/g, "/")
      .toLowerCase();

    return workspaceRoots.value.some((folder) => {
      const normFolder = folder.replace(/\\/g, "/").toLowerCase();
      return (
        cleanTabPath === normFolder ||
        cleanTabPath.startsWith(normFolder + "/")
      );
    });
  });

  if (validTabs.length === 0) {
    tabs.value = [];
    openTab("Untitled Document", `untitled://${Date.now()}`, "");
  } else {
    tabs.value = validTabs;
    activeTabIndex.value = Math.min(activeTabIndex.value, tabs.value.length - 1);
    markdownSource.value = tabs.value[activeTabIndex.value]?.content || "";
  }
  saveTabsState();
}

async function removeWorkspaceFolder(folderPath: string) {
  if (!folderPath) return;
  const normalizedFolder = folderPath.replace(/\\/g, "/").toLowerCase();

  // Save all tabs before closing folder to prevent data loss
  await handleSaveAll();

  // Remove folder from workspaceRoots
  workspaceRoots.value = workspaceRoots.value.filter(
    (f) => f.replace(/\\/g, "/").toLowerCase() !== normalizedFolder,
  );
  saveWorkspaceRoots();

  // Purge any open tabs that no longer belong to an active workspace folder
  cleanupOrphanTabsAndWorkspace();
}

function handleCloseActiveFolder() {
  if (workspaceRoots.value.length > 0) {
    const currentTab = tabs.value[activeTabIndex.value];
    if (currentTab && currentTab.path) {
      const normTab = currentTab.path.replace(/\\/g, "/");
      const matchedFolder = workspaceRoots.value.find((f) => {
        const normF = f.replace(/\\/g, "/");
        return normTab === normF || normTab.startsWith(normF + "/");
      });
      if (matchedFolder) {
        removeWorkspaceFolder(matchedFolder);
        return;
      }
    }
    removeWorkspaceFolder(workspaceRoots.value[0]);
  }
}

function startSidebarResize(e: MouseEvent) {
  e.preventDefault();
  isResizingSidebar.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;

  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";

  function onMouseMove(moveEvent: MouseEvent) {
    const delta = moveEvent.clientX - startX;
    const newWidth = Math.min(Math.max(160, startWidth + delta), 800);
    sidebarWidth.value = newWidth;
  }

  function onMouseUp() {
    isResizingSidebar.value = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    localStorage.setItem("zentauri-sidebar-width", sidebarWidth.value.toString());
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}
const showPreview = ref(true);
const showCheatsheet = ref(false);
const showSearch = ref(false);
const showExplorer = ref(true);
const showSettings = ref(false);
const showHelpSystem = ref(false);
const vimMode = ref(false);
const isSaving = ref(false);
const isAutoRepaired = ref(false);
const autoSaveEnabled = ref(true);

const quickSnippets = [
  {
    label: "::: grammar-box",
    before: "\n::: grammar-box\n",
    after: "\n:::",
    desc: "Grammar",
    colorClass: "text-amber-500",
  },
  {
    label: "::: important",
    before: "\n::: important\n",
    after: "\n:::",
    desc: "Important",
    colorClass: "text-purple-500",
  },
  {
    label: "::: note-box",
    before: "\n::: note-box\n",
    after: "\n:::",
    desc: "Note",
    colorClass: "text-blue-500",
  },
  {
    label: "《Sanskrit》",
    before: "《",
    after: "》",
    desc: "Sanskrit",
    colorClass: "text-red-500",
  },
  {
    label: ":sig[Signal]",
    before: ":sig[",
    after: "]",
    desc: "Signal",
    colorClass: "text-red-600",
  },
  {
    label: "$Math$",
    before: "$",
    after: "$",
    desc: "Math",
    colorClass: "text-emerald-500",
  },
  {
    label: "|Table|",
    before: "\n| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | ",
    after: " |\n",
    desc: "Table",
    colorClass: "text-app-text-muted",
  },
  {
    label: "```mermaid",
    before: "\n```mermaid\ngraph TD\n  A --> B\n",
    after: "```\n",
    desc: "Mermaid",
    colorClass: "text-cyan-500",
  },
];

function handleSelectSnippet(event: Event) {
  const target = event.target as HTMLSelectElement;
  if (target.value) {
    try {
      const item: SyntaxItem = JSON.parse(target.value);
      handleInsertSnippet(item);
    } catch (e) {
      console.error("Failed to parse selected snippet:", e);
    }
  }
  target.value = "";
}

const activeActivityView = computed(() => {
  if (showSettings.value) return "settings";
  if (showCheatsheet.value) return "cheatsheet";
  if (showSearch.value) return "search";
  if (showExplorer.value) return "explorer";
  return null;
});

function handleActivityToggle(view: string) {
  if (view === "explorer") {
    showExplorer.value = !showExplorer.value;
    showSettings.value = false;
    showCheatsheet.value = false;
    showSearch.value = false;
  } else if (view === "settings") {
    showSettings.value = !showSettings.value;
    showExplorer.value = false;
    showCheatsheet.value = false;
    showSearch.value = false;
  } else if (view === "cheatsheet") {
    showCheatsheet.value = !showCheatsheet.value;
    showExplorer.value = false;
    showSettings.value = false;
    showSearch.value = false;
  } else if (view === "search") {
    showSearch.value = !showSearch.value;
    showExplorer.value = false;
    showSettings.value = false;
    showCheatsheet.value = false;
  } else if (view === "help") {
    showHelpSystem.value = !showHelpSystem.value;
    showCheatsheet.value = false;
    showSettings.value = false;
    showSearch.value = false;
  }
}

function handleActivityAction(action: string) {
  if (action === "print") {
    handlePrint();
  }
}

// Check if running inside Tauri
const isTauri =
  typeof window !== "undefined" &&
  (window as any).__TAURI_INTERNALS__ !== undefined;

// Memory
onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
  const savedFoldersStr = localStorage.getItem("zentauri-workspace-folders");
  if (savedFoldersStr) {
    try {
      const parsed = JSON.parse(savedFoldersStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        workspaceRoots.value = parsed;
        workspaceRoot.value = parsed[0];
      }
    } catch (e) {}
  }
  if (workspaceRoots.value.length === 0) {
    const savedWorkspace = localStorage.getItem("zentauri-workspace");
    if (savedWorkspace) {
      workspaceRoots.value = [savedWorkspace];
      workspaceRoot.value = savedWorkspace;
    }
  }

  const savedTabsStr = localStorage.getItem("zentauri-tabs");
  if (savedTabsStr) {
    try {
      const savedData = JSON.parse(savedTabsStr);
      if (savedData.tabs && savedData.tabs.length > 0) {
        tabs.value = savedData.tabs;
        activeTabIndex.value = savedData.activeIndex;
        markdownSource.value = tabs.value[activeTabIndex.value]?.content || "";
      }
    } catch (e) {}
  } else {
    // Default tab if none
    openTab("Untitled Document", "untitled://1", defaultContent);
  }

  // Purge any orphan tabs that do not belong to active workspace folders
  cleanupOrphanTabsAndWorkspace();

  const savedSidebarWidth = localStorage.getItem("zentauri-sidebar-width");
  if (savedSidebarWidth) {
    const w = parseInt(savedSidebarWidth, 10);
    if (!isNaN(w) && w >= 160 && w <= 800) {
      sidebarWidth.value = w;
    }
  }

  const settingsStr = localStorage.getItem("zentauri-settings");
  if (settingsStr) {
    try {
      const s = JSON.parse(settingsStr);
      if (s.autoSave !== undefined) autoSaveEnabled.value = s.autoSave;
    } catch (e) {}
  }

  if (isTauri) {
    listen<string>("open-file-path", (event) => {
      if (event.payload) {
        loadFile(event.payload);
      }
    }).catch((err) => {
      console.error("Failed to setup open-file-path listener:", err);
    });

    invoke<string[]>("get_pending_open_files")
      .then((paths) => {
        if (paths && paths.length > 0) {
          for (const path of paths) {
            loadFile(path);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to get pending open files:", err);
      });

    listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "new_file":
          handleNewFile();
          break;
        case "new_folder":
          handleNewFolder();
          break;
        case "open_file":
          handleOpenFile();
          break;
        case "open_folder":
          handleOpenFolder();
          break;
        case "close_folder":
          handleCloseActiveFolder();
          break;
        case "save":
          forceSave();
          break;
        case "save_as":
          handleSaveAs();
          break;
        case "print":
          handlePrint();
          break;
      }
    }).catch((err) => {
      console.error("Failed to setup Tauri menu event listener:", err);
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    forceSave();
  } else if ((e.metaKey || e.ctrlKey) && e.key === "p") {
    e.preventDefault();
    handlePrint();
  }
}

const saveTabsState = () => {
  localStorage.setItem(
    "zentauri-tabs",
    JSON.stringify({
      tabs: tabs.value,
      activeIndex: activeTabIndex.value,
    }),
  );
};

// Auto-Save
const autoSave = debounce(async () => {
  if (!autoSaveEnabled.value) {
    saveTabsState(); // just save to memory
    return;
  }
  await forceSave();
}, 1000);

async function forceSave() {
  const tab = tabs.value[activeTabIndex.value];
  if (tab && !tab.isWeb) {
    const repairResult = autoRepairMarkdown(tab.content);
    if (repairResult.didRepair) {
      tab.content = repairResult.repaired;
      markdownSource.value = repairResult.repaired;
      isAutoRepaired.value = true;
      setTimeout(() => {
        isAutoRepaired.value = false;
      }, 1500);
    }

    if (tab.path && !tab.path.startsWith("untitled://")) {
      isSaving.value = true;
      try {
        await writeTextFile(tab.path, tab.content);
        saveTabsState();
      } catch (err) {
        console.error("Auto-save failed", err);
      } finally {
        setTimeout(() => {
          isSaving.value = false;
        }, 500);
      }
    } else {
      // If untitled, do Save As
      await handleSaveAs();
    }
  }
}

async function handleSaveAll() {
  isSaving.value = true;
  try {
    for (const tab of tabs.value) {
      if (tab.path && !tab.path.startsWith("untitled://") && !tab.isWeb) {
        await writeTextFile(tab.path, tab.content);
      }
    }
    saveTabsState();
  } catch (err) {
    console.error("Save all failed", err);
  } finally {
    setTimeout(() => {
      isSaving.value = false;
    }, 500);
  }
}

async function handleSaveAs() {
  const tab = tabs.value[activeTabIndex.value];
  if (!tab || tab.isWeb) return;

  const newPath = await save({
    filters: [
      { name: "Markdown", extensions: ["md", "markdown"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (newPath) {
    isSaving.value = true;
    try {
      await writeTextFile(newPath, tab.content);
      tab.path = newPath;
      tab.title = newPath.split(/[/\\]/).pop() || "Unknown";
      saveTabsState();
    } catch (err) {
      console.error("Save As failed", err);
      alert(`Failed to save: ${err}`);
    } finally {
      setTimeout(() => {
        isSaving.value = false;
      }, 500);
    }
  }
}

watch(markdownSource, (newVal) => {
  const tab = tabs.value[activeTabIndex.value];
  if (tab && !tab.isWeb && tab.content !== newVal) {
    tab.content = newVal;
    autoSave();
  }
});

// Tab Management
function focusEditor() {
  // Use setTimeout to ensure CodeMirror has completed its view.dispatch and DOM updates
  setTimeout(() => {
    // 1. Vue ref method (calls view.focus() on CodeMirror)
    if (editorRef.value && typeof editorRef.value.focus === "function") {
      editorRef.value.focus();
      return;
    }

    // 2. Fallback: Direct DOM focus
    const cmContent = document.querySelector(".cm-content") as HTMLElement;
    if (cmContent) {
      cmContent.focus();
    }
  }, 50);
}

function openTab(title: string, path: string, content: string) {
  const existingIndex = tabs.value.findIndex((t) => t.path === path && !t.isWeb);
  if (existingIndex >= 0) {
    activeTabIndex.value = existingIndex;
    markdownSource.value = tabs.value[existingIndex].content;
  } else {
    tabs.value.push({
      id: Date.now().toString(),
      path,
      title,
      content,
      isWeb: false,
    });
    activeTabIndex.value = tabs.value.length - 1;
    markdownSource.value = content;
  }
  saveTabsState();
  focusEditor();
}

async function openExternalUrl(rawUrl: string) {
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  try {
    if (isTauri) {
      await tauriOpenUrl(url);
    } else {
      window.open(url, "_blank");
    }
  } catch (err) {
    console.error("Failed to open external URL in system browser:", err);
    window.open(url, "_blank");
  }
}

function closeTab(index: number, event?: Event) {
  if (event) event.stopPropagation();
  tabs.value.splice(index, 1);
  if (tabs.value.length === 0) {
    openTab("Untitled Document", `untitled://${Date.now()}`, "");
  } else {
    if (activeTabIndex.value >= tabs.value.length) {
      activeTabIndex.value = tabs.value.length - 1;
    }
    const currentTab = tabs.value[activeTabIndex.value];
    if (currentTab && !currentTab.isWeb) {
      markdownSource.value = currentTab.content;
      focusEditor();
    }
  }
  saveTabsState();
}

function ensureWorkspaceForFile(filePath: string) {
  if (!filePath || filePath.startsWith("untitled://")) {
    return;
  }

  let cleanPath = filePath;
  if (cleanPath.startsWith("browser://")) {
    cleanPath = cleanPath.replace("browser://", "");
  }

  const lastSlashIndex = Math.max(
    cleanPath.lastIndexOf("/"),
    cleanPath.lastIndexOf("\\"),
  );

  if (lastSlashIndex <= 0) {
    return;
  }

  const parentDir = cleanPath.substring(0, lastSlashIndex);
  const normalizedParent = parentDir.replace(/\\/g, "/");

  const isCovered = workspaceRoots.value.some((folder) => {
    const norm = folder.replace(/\\/g, "/");
    return (
      normalizedParent === norm || normalizedParent.startsWith(norm + "/")
    );
  });

  if (!isCovered) {
    addWorkspaceFolder(parentDir);
  }
}

function selectTab(index: number) {
  activeTabIndex.value = index;
  const tab = tabs.value[index];
  if (tab && !tab.isWeb) {
    markdownSource.value = tab.content;
    ensureWorkspaceForFile(tab.path);
    focusEditor();
  }
  saveTabsState();
}

function showExplorerView() {
  showExplorer.value = true;
  showSettings.value = false;
  showCheatsheet.value = false;
  showSearch.value = false;
}

async function handleOpenFile() {
  if (!isTauri) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt";
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        const text = await file.text();
        openTab(file.name, `browser://${file.name}`, text);
        showExplorerView();
      }
    };
    input.click();
    return;
  }

  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Markdown", extensions: ["md", "markdown"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (selected && typeof selected === "string") {
      await loadFile(selected);
    }
  } catch (err) {
    console.error("Failed to open file via Tauri dialog:", err);
  }
}

async function handleOpenFolder() {
  if (!isTauri) {
    // Try HTML5 Directory Picker API or Fallback
    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        addWorkspaceFolder(dirHandle.name);
        showExplorerView();
        return;
      } catch (err) {
        // User cancelled or not supported
      }
    }

    const promptPath = window.prompt(
      "Geben Sie einen Workspace-Pfad oder Namen ein:",
      workspaceRoots.value[0] || "Zentauri-Workspace",
    );
    if (promptPath) {
      addWorkspaceFolder(promptPath);
      showExplorerView();
    }
    return;
  }

  try {
    const selected = await open({
      directory: true,
      multiple: false,
    });

    if (selected && typeof selected === "string") {
      addWorkspaceFolder(selected);
      showExplorerView();
    }
  } catch (err) {
    console.error("Failed to open folder via Tauri dialog:", err);
  }
}

async function loadFile(path: string) {
  ensureWorkspaceForFile(path);

  const existingIndex = tabs.value.findIndex(
    (t) => t.path === path || t.id === path,
  );
  if (existingIndex >= 0) {
    selectTab(existingIndex);
    showExplorerView();
    return;
  }

  if (path.startsWith("untitled://")) {
    return;
  }

  try {
    const text = await readTextFile(path);
    const title = path.split(/[/\\]/).pop() || "Unknown";
    openTab(title, path, text);
    showExplorerView();
    focusEditor();
  } catch (err) {
    console.error("Failed to load file", err);
  }
}

async function handleNewFile() {
  if (workspaceRoot.value && fileTreeRef.value) {
    showExplorerView();
    nextTick(() => {
      fileTreeRef.value?.triggerNewRootFile();
    });
  } else {
    openTab("Untitled Document", `untitled://${Date.now()}`, "");
  }
}

async function handleNewFolder() {
  if (workspaceRoot.value && fileTreeRef.value) {
    showExplorerView();
    nextTick(() => {
      fileTreeRef.value?.triggerNewRootFolder();
    });
  }
}

function handleSettingsUpdate(settings: any) {
  if (settings.autoSave !== undefined)
    autoSaveEnabled.value = settings.autoSave;
  if (settings.vimMode !== undefined) vimMode.value = settings.vimMode;
  if (settings.showCheatsheet !== undefined)
    showCheatsheet.value = settings.showCheatsheet;
}

function handleSettingsClose() {
  showSettings.value = false;
}

function handleInsertFromCheatsheet(text: string) {
  if (editorRef.value) {
    editorRef.value.insertText(text + "\n");
  }
}

function handleInsertSnippet(item: SyntaxItem) {
  if (editorRef.value) {
    editorRef.value.wrapSelection(item.before, item.after);
  }
}

function handleJumpToLine(lineNum: number) {
  if (editorRef.value) {
    editorRef.value.jumpToLine(lineNum);
  }
}

function handlePrint() {
  window.print();
}
</script>

<template>
  <main class="flex flex-col h-screen w-screen overflow-hidden bg-app-bg text-app-text print:h-auto print:w-auto print:overflow-visible print:bg-white print:text-black">
    <Settings class="print:hidden" :isOpen="showSettings" @close="handleSettingsClose" @update="handleSettingsUpdate" />
    <HelpSystem class="print:hidden" :isOpen="showHelpSystem" @close="showHelpSystem = false" @open-url="openExternalUrl" />
    
    <!-- Toolbar -->
    <header class="flex-none flex items-center px-4 py-2 border-b border-app-border bg-app-bg-secondary select-none print:hidden" data-tauri-drag-region>
      <!-- Auto-Save & Auto-Repair Status -->
      <div class="flex-1 text-center text-sm font-medium text-app-text-muted absolute left-0 right-0 pointer-events-none flex items-center justify-center gap-2">
        <span v-if="isAutoRepaired" class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" title="Auto-Repaired Syntax"></span>
        <span v-else-if="isSaving" class="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        <span v-else class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        {{ isAutoRepaired ? 'Auto-Repaired & Saved' : (isSaving ? 'Saving...' : 'Saved') }}
      </div>
      
      <div class="flex gap-1 z-10 relative ml-auto">

        <button 
          @click="showPreview = !showPreview"
          class="px-2 py-1.5 text-sm font-medium rounded-md hover:bg-app-bg transition-colors border border-transparent shadow-sm flex items-center justify-center text-app-text-muted hover:text-app-text"
          :class="{'ring-2 ring-blue-500 text-blue-500': showPreview}"
          title="Toggle Preview"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="12" y1="3" x2="12" y2="21"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- Workspace -->
    <div class="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
      <!-- Activity Bar -->
      <ActivityBar 
        :activeView="activeActivityView"
        @toggle-view="handleActivityToggle"
        @action="handleActivityAction"
      />

      <!-- File Tree Sidebar -->
      <div 
        v-show="showExplorer" 
        class="flex-none border-r border-app-border print:hidden h-full"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <FileTree 
          ref="fileTreeRef"
          :rootPath="workspaceRoot" 
          :rootPaths="workspaceRoots"
          :activePath="tabs[activeTabIndex]?.path" 
          :openTabs="tabs"
          @select="loadFile" 
          @open-folder="handleOpenFolder"
          @open-file="handleOpenFile"
          @remove-folder="removeWorkspaceFolder"
          @close-tab="closeTab"
          @save-all="handleSaveAll"
        />
      </div>

      <!-- Cheatsheet Sidebar -->
      <div 
        v-show="showCheatsheet" 
        class="flex-none border-r border-app-border print:hidden h-full"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <Cheatsheet @insertSnippet="handleInsertSnippet" @insert="handleInsertFromCheatsheet" class="h-full" />
      </div>

      <!-- Search Sidebar -->
      <div 
        v-show="showSearch" 
        class="flex-none border-r border-app-border print:hidden h-full"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <SearchPanel 
          :fileContent="tabs[activeTabIndex]?.content || ''" 
          @jump-to-line="handleJumpToLine" 
          class="h-full" 
        />
      </div>

      <!-- Resizable Boundary Handle -->
      <div
        v-if="showExplorer || showCheatsheet || showSearch"
        @mousedown="startSidebarResize"
        @dblclick="sidebarWidth = 256"
        class="w-1.5 -ml-1.5 flex-none bg-transparent hover:bg-blue-500/50 active:bg-blue-600 cursor-col-resize select-none transition-colors h-full z-30"
        title="Drag to resize sidebar (Double-click to reset)"
      ></div>

      <!-- Main Workspace Area -->
      <div class="flex-1 flex flex-col min-w-0 bg-app-bg relative print:block print:overflow-visible print:h-auto">
        <!-- Tab Bar -->
        <div class="flex-none flex items-center overflow-x-auto border-b border-app-border bg-app-bg-secondary print:hidden">
          <div 
            v-for="(tab, index) in tabs" 
            :key="tab.id"
            @click="selectTab(index)"
            class="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-app-border transition-colors whitespace-nowrap"
            :class="[
              activeTabIndex === index 
                ? 'bg-app-bg text-app-text border-t-2 border-t-blue-500' 
                : 'bg-app-bg-secondary text-app-text-muted hover:bg-app-bg border-t-2 border-t-transparent'
            ]"
          >
            <span>{{ tab.title }}</span>
            <button 
              @click="closeTab(index, $event)" 
              class="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-app-border text-app-text-muted hover:text-app-text transition-colors"
            >
              ×
            </button>
          </div>
        </div>
        
        <!-- Editor/Preview Split (Editor Left, Preview Right) -->
        <div class="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
          <!-- Editor Pane (Left) -->
          <div class="flex-1 h-full min-w-0 flex flex-col border-r border-app-border print:hidden">
            <!-- Quick Snippet Toolbar (Dynamic Dropdown populated directly from Syntax Reference CHEAT_SHEET) -->
            <div class="flex-none flex items-center justify-between gap-2 px-3 py-1.5 bg-app-bg-secondary border-b border-app-border text-xs select-none">
              <div class="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto">
                <span class="text-app-text-muted font-medium shrink-0">Snippets:</span>

                <!-- Always Visible Dynamic Dropdown Select (All Syntax Reference Items grouped by category) -->
                <div class="flex items-center shrink-0 min-w-[200px] max-w-[280px]">
                  <select 
                    @change="handleSelectSnippet" 
                    class="w-full bg-app-bg text-app-text text-xs border border-app-border rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-mono shadow-xs"
                  >
                    <option value="" disabled selected>-- Select Syntax Snippet --</option>
                    <optgroup v-for="cat in CHEAT_SHEET" :key="cat.id" :label="cat.title">
                      <option 
                        v-for="item in cat.items" 
                        :key="item.label" 
                        :value="JSON.stringify(item)"
                      >
                        {{ item.label }} ({{ item.desc }})
                      </option>
                    </optgroup>
                  </select>
                </div>

                <!-- Extra Wide View: Inline Horizontal Quick Buttons -->
                <div class="hidden xl:flex items-center gap-1.5 overflow-x-auto">
                  <button 
                    v-for="s in quickSnippets" 
                    :key="s.label"
                    @click="handleInsertSnippet({ label: s.label, before: s.before, after: s.after, desc: s.desc })" 
                    class="px-2 py-0.5 rounded bg-app-bg hover:bg-app-bg-hover border border-app-border font-mono transition-colors whitespace-nowrap shrink-0"
                    :class="s.colorClass"
                  >
                    {{ s.label }}
                  </button>
                </div>
              </div>
            </div>




            <!-- CodeMirror Editor -->
            <div class="flex-1 h-full min-w-0 overflow-hidden">
              <Editor ref="editorRef" v-model="markdownSource" :vimMode="vimMode" />
            </div>
          </div>

          <!-- Preview Pane (Right) -->
          <div v-show="showPreview" class="flex-1 h-full bg-app-bg min-w-0 print:!block print:w-full print:h-auto print:overflow-visible print:bg-white">
            <Preview :source="markdownSource" @open-url="openExternalUrl" />
          </div>
        </div>

      </div>
    </div>
  </main>
</template>