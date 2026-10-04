<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import ActivityBar from "./components/ActivityBar.vue";
import Cheatsheet from "./components/Cheatsheet.vue";
import Editor from "./components/Editor.vue";
import FileTree from "./components/FileTree.vue";
import GraphView from "./components/GraphView.vue";
import HelpSystem from "./components/HelpSystem.vue";
import Preview from "./components/Preview.vue";
import SearchPanel from "./components/SearchPanel.vue";
import Settings from "./components/Settings.vue";
import UpdateNotification from "./components/UpdateNotification.vue";
import { autoRepairMarkdown } from "./lib/auto-repair";
import CHEAT_SHEET, { type SyntaxItem } from "./lib/syntax-cheatsheet";
import { convertMarkdownToTypst } from "./lib/typstConverter";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import debounce from "lodash.debounce";

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
  localStorage.setItem(
    "zentauri-workspace-folders",
    JSON.stringify(workspaceRoots.value),
  );
  if (workspaceRoots.value.length > 0) {
    workspaceRoot.value = workspaceRoots.value[0];
    localStorage.setItem("zentauri-workspace", workspaceRoots.value[0]);
  } else {
    workspaceRoot.value = null;
    localStorage.removeItem("zentauri-workspace");
  }
}

function isProtectedSystemPath(dirPath: string): boolean {
  if (!dirPath) return true;
  const norm = dirPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

  // Root paths
  if (norm === "" || norm === "/" || /^[a-z]:\/?$/i.test(norm)) return true;

  // User home directory itself: e.g. /users/username, /home/username
  if (/^\/(users|home)\/[^/]+$/.test(norm)) return true;

  // System directories
  if (
    [
      "/applications",
      "/system",
      "/library",
      "/volumes",
      "/private",
      "/usr",
      "/bin",
      "/etc",
      "/var",
    ].includes(norm)
  ) {
    return true;
  }

  // User special folders: Desktop, Downloads, Documents
  if (/^\/(users|home)\/[^/]+\/(desktop|schreibtisch|downloads)$/i.test(norm)) {
    return true;
  }

  // Windows user special folders
  if (/^[a-z]:\/users\/[^/]+\/(desktop|downloads)$/i.test(norm)) {
    return true;
  }

  return false;
}

function addWorkspaceFolder(folderPath: string) {
  if (!folderPath) return;
  if (isProtectedSystemPath(folderPath)) {
    console.warn(
      "Ignoring protected system folder as workspace root:",
      folderPath,
    );
    return;
  }
  const normalizedNew = folderPath.replace(/\\/g, "/");

  // Check if new folder is already covered by an existing parent folder
  const existingParent = workspaceRoots.value.find((f) => {
    const norm = f.replace(/\\/g, "/");
    return normalizedNew === norm || normalizedNew.startsWith(`${norm}/`);
  });

  if (existingParent) {
    showExplorerView();
    return;
  }

  // Remove any subfolders of the new folder that were previously open separately
  workspaceRoots.value = workspaceRoots.value.filter((f) => {
    const norm = f.replace(/\\/g, "/");
    return !norm.startsWith(`${normalizedNew}/`);
  });

  workspaceRoots.value.push(folderPath);
  saveWorkspaceRoots();
  showExplorerView();
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

  // Close only tabs located inside this specific removed folder
  tabs.value = tabs.value.filter((tab) => {
    if (!tab.path || tab.path.startsWith("untitled://") || tab.isWeb) {
      return true; // Keep untitled and web tabs
    }
    const cleanTabPath = tab.path
      .replace("browser://", "")
      .replace(/\\/g, "/")
      .toLowerCase();

    return !(
      cleanTabPath === normalizedFolder ||
      cleanTabPath.startsWith(`${normalizedFolder}/`)
    );
  });

  if (tabs.value.length === 0) {
    openTab("Untitled Document", `untitled://${Date.now()}`, "");
  } else {
    activeTabIndex.value = Math.min(
      activeTabIndex.value,
      tabs.value.length - 1,
    );
    markdownSource.value = tabs.value[activeTabIndex.value]?.content || "";
  }
  saveTabsState();
}

function handleCloseActiveFolder() {
  if (workspaceRoots.value.length > 0) {
    const currentTab = tabs.value[activeTabIndex.value];
    if (currentTab?.path) {
      const normTab = currentTab.path.replace(/\\/g, "/");
      const matchedFolder = workspaceRoots.value.find((f) => {
        const normF = f.replace(/\\/g, "/");
        return normTab === normF || normTab.startsWith(`${normF}/`);
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
    localStorage.setItem(
      "zentauri-sidebar-width",
      sidebarWidth.value.toString(),
    );
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

type ViewMode = "source" | "split" | "live" | "graph";
const viewMode = ref<ViewMode>(
  (localStorage.getItem("zentauri-view-mode") as ViewMode) || "split",
);

function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
  localStorage.setItem("zentauri-view-mode", mode);
}

const showPreview = computed(() => viewMode.value === "split");
const isLivePreview = computed(() => viewMode.value === "live");

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
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const unlistenFns: (() => void)[] = [];

const handleBeforeUnload = () => {
  if (autoSave) {
    autoSave.cancel();
  }
  handleSaveAll();
  saveTabsState();
};

// Memory
onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
  const savedFoldersStr = localStorage.getItem("zentauri-workspace-folders");
  if (savedFoldersStr) {
    try {
      const parsed = JSON.parse(savedFoldersStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const safeFolders = parsed.filter(
          (f) => typeof f === "string" && !isProtectedSystemPath(f),
        );
        workspaceRoots.value = safeFolders;
        workspaceRoot.value = safeFolders[0] || null;
      }
    } catch (e) {}
  }
  if (workspaceRoots.value.length === 0) {
    const savedWorkspace = localStorage.getItem("zentauri-workspace");
    if (savedWorkspace && !isProtectedSystemPath(savedWorkspace)) {
      workspaceRoots.value = [savedWorkspace];
      workspaceRoot.value = savedWorkspace;
    } else {
      localStorage.removeItem("zentauri-workspace");
    }
  }
  saveWorkspaceRoots();

  const savedTabsStr = localStorage.getItem("zentauri-tabs");
  if (savedTabsStr) {
    try {
      const savedData = JSON.parse(savedTabsStr);
      if (savedData.tabs && savedData.tabs.length > 0) {
        tabs.value = savedData.tabs;
        activeTabIndex.value =
          typeof savedData.activeIndex === "number" ? savedData.activeIndex : 0;
        if (activeTabIndex.value >= tabs.value.length) {
          activeTabIndex.value = 0;
        }
        markdownSource.value = tabs.value[activeTabIndex.value]?.content || "";
      }
    } catch (e) {}
  }

  async function handleIncomingPath(path: string) {
    if (isTauri) {
      try {
        const isDir = await invoke<boolean>("is_directory_path", { path });
        if (isDir) {
          addWorkspaceFolder(path);
          return;
        }
      } catch (e) {
        console.error("is_directory_path check failed:", e);
      }
    }
    await loadFile(path);
  }

  if (isTauri && workspaceRoots.value.length > 0) {
    (async () => {
      const validFolders: string[] = [];
      for (const folder of workspaceRoots.value) {
        try {
          const isDir = await invoke<boolean>("is_directory_path", {
            path: folder,
          });
          if (isDir) {
            validFolders.push(folder);
          }
        } catch {}
      }
      if (validFolders.length !== workspaceRoots.value.length) {
        workspaceRoots.value = validFolders;
        workspaceRoot.value = validFolders[0] || null;
        saveWorkspaceRoots();
      }
    })();
  }

  if (workspaceRoots.value.length === 0 && isTauri) {
    invoke<string | null>("get_app_cwd")
      .then(async (initialCwd) => {
        if (initialCwd && !isProtectedSystemPath(initialCwd)) {
          addWorkspaceFolder(initialCwd);

          const hasOnlyUntitled =
            tabs.value.length === 0 ||
            (tabs.value.length === 1 &&
              tabs.value[0].path &&
              tabs.value[0].path.startsWith("untitled://"));

          if (hasOnlyUntitled) {
            const readmePath = `${initialCwd.replace(/\\/g, "/")}/README.md`;
            try {
              const readmeText = await readTextFile(readmePath);
              tabs.value = [];
              openTab("README.md", readmePath, readmeText);
            } catch (e) {
              // No README.md
            }
          }
        }
      })
      .catch((err) => {
        console.error("Failed to get initial CWD:", err);
      });
  }

  if (tabs.value.length === 0) {
    // Default tab if none
    openTab("Untitled Document", "untitled://1", defaultContent);
  }

  const savedSidebarWidth = localStorage.getItem("zentauri-sidebar-width");
  if (savedSidebarWidth) {
    const w = Number.parseInt(savedSidebarWidth, 10);
    if (!Number.isNaN(w) && w >= 160 && w <= 800) {
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

  window.addEventListener("beforeunload", handleBeforeUnload);

  if (isTauri) {
    listen<string>("open-file-path", (event) => {
      if (event.payload) {
        handleIncomingPath(event.payload);
      }
    })
      .then((unlisten) => {
        unlistenFns.push(unlisten);
      })
      .catch((err) => {
        console.error("Failed to setup open-file-path listener:", err);
      });

    invoke<string[]>("get_pending_open_files")
      .then((paths) => {
        if (paths && paths.length > 0) {
          for (const path of paths) {
            handleIncomingPath(path);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to get pending open files:", err);
      });

    invoke<{ content: string; path: string }>("load_custom_stylesheet")
      .then((res) => {
        if (res?.content) {
          const style = document.createElement("style");
          style.id = "zentauri-custom-style";
          style.textContent = res.content;
          document.head.appendChild(style);
          console.log("Loaded custom stylesheet from:", res.path);
        }
      })
      .catch((err) => {
        console.error("Failed to load custom stylesheet:", err);
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
    })
      .then((unlisten) => {
        unlistenFns.push(unlisten);
      })
      .catch((err) => {
        console.error("Failed to setup Tauri menu event listener:", err);
      });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  if (autoSave) {
    autoSave.cancel();
  }
  saveTabsState();
  for (const fn of unlistenFns) {
    fn();
  }
  unlistenFns.length = 0;
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

// Save a specific tab to file, optionally applying auto-repair
async function saveTabToFile(tab: Tab | null | undefined, runRepair = false) {
  if (!tab || tab.isWeb) return;

  if (runRepair) {
    const repairResult = autoRepairMarkdown(tab.content);
    if (repairResult.didRepair) {
      tab.content = repairResult.repaired;
      if (tabs.value[activeTabIndex.value] === tab) {
        markdownSource.value = repairResult.repaired;
      }
      isAutoRepaired.value = true;
      setTimeout(() => {
        isAutoRepaired.value = false;
      }, 1500);
    }
  }

  if (
    tab.path &&
    !tab.path.startsWith("untitled://") &&
    !tab.path.startsWith("browser://")
  ) {
    isSaving.value = true;
    try {
      await writeTextFile(tab.path, tab.content);
      saveTabsState();
    } catch (err) {
      console.error("Save failed for tab:", tab.path, err);
    } finally {
      setTimeout(() => {
        isSaving.value = false;
      }, 500);
    }
  } else {
    saveTabsState();
  }
}

// Auto-Save: debounced, saves only text (no auto-repair while typing)
let pendingSaveTab: Tab | null = null;

const autoSave = debounce(async () => {
  if (!autoSaveEnabled.value) {
    saveTabsState(); // persist to local state
    return;
  }
  const target = pendingSaveTab || tabs.value[activeTabIndex.value];
  if (target) {
    await saveTabToFile(target, false);
  }
  pendingSaveTab = null;
}, 1000);

async function forceSave(manual = true) {
  const tab = tabs.value[activeTabIndex.value];
  if (tab && !tab.isWeb) {
    if (
      tab.path &&
      !tab.path.startsWith("untitled://") &&
      !tab.path.startsWith("browser://")
    ) {
      await saveTabToFile(tab, manual /* run repair on explicit save */);
    } else if (manual) {
      await handleSaveAs();
    } else {
      saveTabsState();
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
    pendingSaveTab = tab;
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
  const existingIndex = tabs.value.findIndex(
    (t) => t.path === path && !t.isWeb,
  );
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
    url = `https://${url}`;
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

async function closeTab(index: number, event?: Event) {
  if (event) event.stopPropagation();
  const closingTab = tabs.value[index];
  if (closingTab && !closingTab.isWeb) {
    autoSave.cancel();
    if (autoSaveEnabled.value) {
      await saveTabToFile(closingTab, false);
    }
  }

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

async function selectTab(index: number) {
  if (index === activeTabIndex.value) return;

  const currentTab = tabs.value[activeTabIndex.value];
  if (currentTab && !currentTab.isWeb) {
    autoSave.cancel();
    if (autoSaveEnabled.value) {
      await saveTabToFile(currentTab, true);
    } else {
      saveTabsState();
    }
  }

  activeTabIndex.value = index;
  const tab = tabs.value[index];
  if (tab && !tab.isWeb) {
    markdownSource.value = tab.content;
    focusEditor();
  }
  saveTabsState();
}

async function handlePreviewOpenFile(linkPath: string) {
  const cleanLink = linkPath.split(/[?#]/)[0].trim();
  if (!cleanLink) return;

  const activeTab = tabs.value[activeTabIndex.value];
  let fullPath = cleanLink;

  if (
    activeTab?.path &&
    !activeTab.path.startsWith("untitled://") &&
    !activeTab.path.startsWith("browser://")
  ) {
    const lastSlash = Math.max(
      activeTab.path.lastIndexOf("/"),
      activeTab.path.lastIndexOf("\\"),
    );
    const parentDir =
      lastSlash !== -1 ? activeTab.path.substring(0, lastSlash) : "";
    const sep = activeTab.path.includes("\\") ? "\\" : "/";
    if (parentDir && !cleanLink.startsWith("/") && !cleanLink.includes(":")) {
      fullPath = `${parentDir}${sep}${cleanLink}`;
    }
  }

  if (
    !fullPath.endsWith(".md") &&
    !fullPath.endsWith(".markdown") &&
    !fullPath.includes(".")
  ) {
    fullPath += ".md";
  }

  await loadFile(fullPath);
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
      if (target.files?.[0]) {
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
    editorRef.value.insertText(`${text}\n`);
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

async function handleExportPdf() {
  const tab = tabs.value[activeTabIndex.value];
  if (!tab || tab.isWeb) return;

  try {
    const destPath = await save({
      filters: [{ name: "PDF Document", extensions: ["pdf"] }],
      defaultPath: tab.title.replace(/\.md$/i, ".pdf"),
    });

    if (destPath) {
      isSaving.value = true;
      const typstMarkup = convertMarkdownToTypst(tab.content);
      await invoke("export_pdf", { typstMarkup, destinationPath: destPath });
    }
  } catch (err) {
    console.error("Export PDF failed:", err);
    alert(`Failed to export PDF: ${err}`);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <main class="flex flex-col h-screen w-screen overflow-hidden bg-app-bg text-app-text print:h-auto print:w-auto print:overflow-visible print:bg-white print:text-black">
    <Settings class="print:hidden" :isOpen="showSettings" @close="handleSettingsClose" @update="handleSettingsUpdate" />
    <HelpSystem class="print:hidden" :isOpen="showHelpSystem" @close="showHelpSystem = false" @open-url="openExternalUrl" />
    <UpdateNotification class="print:hidden" />
    
    <!-- Toolbar -->
    <header class="flex-none flex items-center px-4 py-2 border-b border-app-border bg-app-bg-secondary select-none print:hidden" data-tauri-drag-region>
      <!-- Auto-Save & Auto-Repair Status -->
      <div class="flex-1 text-center text-sm font-medium text-app-text-muted absolute left-0 right-0 pointer-events-none flex items-center justify-center gap-2">
        <span v-if="isAutoRepaired" class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" title="Auto-Repaired Syntax"></span>
        <span v-else-if="isSaving" class="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        <span v-else class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        {{ isAutoRepaired ? 'Auto-Repaired & Saved' : (isSaving ? 'Saving...' : 'Saved') }}
      </div>
      
      <div class="flex gap-2 z-10 relative ml-auto">
        <button 
          @click="handleExportPdf"
          class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-xs font-semibold rounded transition-colors shadow-xs"
          title="Export as native PDF via Typst"
        >
          Export PDF
        </button>
        <div class="flex items-center bg-app-bg p-0.5 rounded-md border border-app-border">
          <button 
            @click="setViewMode('source')" 
            class="p-1.5 rounded transition-colors"
            :class="viewMode === 'source' ? 'bg-app-bg-secondary text-app-text shadow-xs' : 'text-app-text-muted hover:text-app-text'"
            title="Source Mode (Code Only)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button 
            @click="setViewMode('split')" 
            class="p-1.5 rounded transition-colors"
            :class="viewMode === 'split' ? 'bg-app-bg-secondary text-app-text shadow-xs' : 'text-app-text-muted hover:text-app-text'"
            title="Split Mode (Editor + Preview)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/></svg>
          </button>
          <button 
            @click="setViewMode('graph')" 
            class="p-1.5 rounded transition-colors"
            :class="viewMode === 'graph' ? 'bg-app-bg-secondary text-app-text shadow-xs' : 'text-app-text-muted hover:text-app-text'"
            title="Knowledge Graph"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <!-- Live Preview Mode (WYSIWYG) disabled for now
          <button 
            @click="setViewMode('live')" 
            class="p-1.5 rounded transition-colors"
            :class="viewMode === 'live' ? 'bg-app-bg-secondary text-app-text shadow-xs' : 'text-app-text-muted hover:text-app-text'"
            title="Live Preview Mode (Inline Hybrid Editor)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          -->
        </div>
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
        
        <!-- Graph View -->
        <div v-if="viewMode === 'graph'" class="flex-1 overflow-hidden h-full flex flex-col min-w-0 bg-app-bg">
          <GraphView v-if="workspaceRoot" :folderPath="workspaceRoot" @select="loadFile" />
          <div v-else class="flex-1 flex items-center justify-center text-app-text-muted">
            No Workspace Folder Open
          </div>
        </div>

        <!-- Editor/Preview Split (Editor Left, Preview Right) -->
        <div v-else class="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
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
              <Editor ref="editorRef" v-model="markdownSource" :vimMode="vimMode" :livePreview="isLivePreview" />
            </div>
          </div>


          <!-- Preview Pane (Right) -->
          <div v-show="showPreview" class="flex-1 h-full bg-app-bg min-w-0 print:!block print:w-full print:h-auto print:overflow-visible print:bg-white">
            <Preview :source="markdownSource" @open-url="openExternalUrl" @open-file="handlePreviewOpenFile" />
          </div>
        </div>

      </div>
    </div>
  </main>
</template>