<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import ActivityBar from "./components/ActivityBar.vue";
import Cheatsheet from "./components/Cheatsheet.vue";
import Editor, { type CursorInfo } from "./components/Editor.vue";
import FileTree from "./components/FileTree.vue";
import Preview from "./components/Preview.vue";
import SearchPanel from "./components/SearchPanel.vue";
import StatusBar from "./components/StatusBar.vue";
import UpdateNotification from "./components/UpdateNotification.vue";

import Settings from "./components/Settings.vue";
const HelpSystem = defineAsyncComponent(
  () => import("./components/HelpSystem.vue"),
);
import ContextMenu from "./components/ContextMenu.vue";
import QaReferencePane from "./components/QaReferencePane.vue";
import { autoRepairMarkdown } from "./lib/auto-repair";
import { extractHeadings, interpolateTargetLine } from "./lib/heading-sync";
import {
  type LanguageInfo,
  detectLanguageFromPath,
  detectWorkspaceLanguages,
  findCorrespondingFilePath,
} from "./lib/language-detector";
import CHEAT_SHEET, { type SyntaxItem } from "./lib/syntax-cheatsheet";
import { convertMarkdownToTypst } from "./lib/typstConverter";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import debounce from "lodash.debounce";

// Check if running inside Tauri
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const unlistenFns: (() => void)[] = [];

interface Tab {
  id: string;
  path: string;
  title: string;
  content: string;
  isWeb?: boolean;
  url?: string;
  isDirty?: boolean;
}

const defaultContent = `# Welcome to Zentauri

This is a minimal Markdown editor based on Tauri and Vue.

::: important[Check it out]
Try the extensive Markdown extensions ported from ZenNotes!
:::

## 📝 Scholarly Features Demo

Zentauri supports academic footnotes[^1] as well as named citations[^ref].

Definition Lists
: Definition lists allow clean structuring of technical glossaries.
IAST
: International Alphabet of Sanskrit Transliteration.

You can use math: $e^{i\\pi} + 1 = 0$

Or Mermaid:
\`\`\`mermaid
graph TD
  A[Tauri] --> B(Vue)
  B --> C{Zentauri}
\`\`\`

[^1]: This is a standard footnote rendered at the bottom of the document.
[^ref]: Footnotes include bidirectional anchor navigation back to the text citation.
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
const previewRef = ref<InstanceType<typeof Preview> | null>(null);
const fileTreeRef = ref<InstanceType<typeof FileTree> | null>(null);

const cursorInfo = ref<CursorInfo>({
  line: 1,
  column: 1,
  selectedChars: 0,
  totalLines: 1,
});

function onCursorChange(info: CursorInfo) {
  cursorInfo.value = info;
}

const wordCount = computed(() => {
  const text = markdownSource.value || "";
  return text.trim() ? text.trim().match(/\S+/g)?.length || 0 : 0;
});

const charCount = computed(() => {
  return (markdownSource.value || "").length;
});

const readTime = computed(() => {
  return Math.max(1, Math.ceil(wordCount.value / 200));
});

const currentWorkspaceName = computed(() => {
  if (!workspaceRoot.value) return null;
  const parts = workspaceRoot.value.split(/[/\\]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
});

function handleJumpToLinePrompt() {
  const maxLines = cursorInfo.value.totalLines || 1;
  const input = prompt(
    `Go to Line (1 - ${maxLines}):`,
    String(cursorInfo.value.line),
  );
  if (input !== null) {
    const target = Number.parseInt(input.trim(), 10);
    if (!Number.isNaN(target) && editorRef.value) {
      editorRef.value.jumpToLine(target);
    }
  }
}

function getInitialSidebarWidth(): number {
  if (typeof window === "undefined") return 256;
  const saved = localStorage.getItem("zentauri-sidebar-width");
  if (saved) {
    const w = Number.parseInt(saved, 10);
    if (!Number.isNaN(w)) {
      return Math.min(Math.max(160, w), 480);
    }
  }
  return 256;
}

const workspaceRoot = ref<string | null>(null);
const workspaceRoots = ref<string[]>([]);
const sidebarWidth = ref(getInitialSidebarWidth());
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

watch(
  workspaceRoots,
  (newRoots) => {
    if (isTauri) {
      invoke("watch_workspaces", { paths: newRoots }).catch((err) => {
        console.warn("Failed to watch workspaces:", err);
      });
    }
  },
  { deep: true, immediate: true },
);

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

  // Save all tabs before closing folder to prevent data loss only if autoSave is enabled
  if (autoSaveEnabled.value) {
    await handleSaveAll();
  }

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
    const newWidth = Math.min(Math.max(160, startWidth + delta), 480);
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

type ViewMode = "source" | "split" | "live" | "qa-2col" | "qa-3col";
const rawStoredMode = localStorage.getItem("zentauri-view-mode");
const viewMode = ref<ViewMode>(
  ["source", "split", "live", "qa-2col", "qa-3col"].includes(
    rawStoredMode as any,
  )
    ? (rawStoredMode as ViewMode)
    : "split",
);

function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
  localStorage.setItem("zentauri-view-mode", mode);
  if (isQaMode.value) {
    autoLoadReferenceForActiveTab();
  }
}

const isQaMode = computed(
  () => viewMode.value === "qa-2col" || viewMode.value === "qa-3col",
);
const showQaReference = computed(() => isQaMode.value);
const showPreview = computed(
  () => viewMode.value === "split" || viewMode.value === "qa-3col",
);
const isLivePreview = computed(() => viewMode.value === "live");

// QA Reference Document State & Multi-Language Navigation
const qaReferenceRef = ref<InstanceType<typeof QaReferencePane> | null>(null);
const qaReferencePath = ref<string | null>(null);
const qaReferenceContent = ref<string>("");
const qaReferenceTitle = ref<string>("Referenzdokument");
const qaReferenceLang = ref<string>("de");
const availableLanguages = ref<LanguageInfo[]>([]);
const knownWorkspaceFilePaths = ref<string[]>([]);

const showCheatsheet = ref(false);
const showSearch = ref(false);
const showExplorer = ref(true);
const showSettings = ref(false);
const showHelpSystem = ref(false);
const vimMode = ref(false);
const isSaving = ref(false);
const isAutoRepaired = ref(false);
const isPdfExported = ref(false);
const autoSaveEnabled = ref(true);
const pdfPaper = ref<"a4" | "us-letter">("a4");

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const saveShortcut = isMac ? "⌘S" : "Ctrl+S";
const pdfShortcut = isMac ? "⌘P" : "Ctrl+P";

type SyncMode = "header" | "percentage" | "off";
const syncMode = ref<SyncMode>("header");
const syncScroll = computed(() => syncMode.value !== "off");

const initialSettingsStr = localStorage.getItem("zentauri-settings");
if (initialSettingsStr) {
  try {
    const parsedSettings = JSON.parse(initialSettingsStr);
    if (parsedSettings.syncMode !== undefined) {
      syncMode.value = parsedSettings.syncMode;
    } else if (parsedSettings.syncScroll === false) {
      syncMode.value = "off";
    }
    if (parsedSettings.vimMode !== undefined) {
      vimMode.value = parsedSettings.vimMode;
    }
  } catch {}
}

function saveSyncSettings() {
  const currentSettings = localStorage.getItem("zentauri-settings");
  let s: Record<string, unknown> = {};
  if (currentSettings) {
    try {
      s = JSON.parse(currentSettings);
    } catch {}
  }
  localStorage.setItem(
    "zentauri-settings",
    JSON.stringify({
      ...s,
      syncMode: syncMode.value,
      syncScroll: syncScroll.value,
    }),
  );
}

function setSyncMode(mode: SyncMode) {
  syncMode.value = mode;
  saveSyncSettings();
}

function cycleSyncMode() {
  if (syncMode.value === "header") {
    syncMode.value = "percentage";
  } else if (syncMode.value === "percentage") {
    syncMode.value = "off";
  } else {
    syncMode.value = "header";
  }
  saveSyncSettings();
}

function toggleSyncScroll() {
  cycleSyncMode();
}

async function scanWorkspaceForLanguages() {
  if (!workspaceRoot.value) {
    const tabPaths = tabs.value
      .map((t) => t.path)
      .filter((p) => p && !p.startsWith("untitled://"));
    knownWorkspaceFilePaths.value = tabPaths;
    availableLanguages.value = detectWorkspaceLanguages(tabPaths);
    return;
  }

  if (isTauri) {
    try {
      const nodes: any = await invoke("search_workspace", {
        path: workspaceRoot.value,
        query: ".md",
      });
      if (Array.isArray(nodes) && nodes.length > 0) {
        const paths = nodes.map((n: any) => n.path).filter(Boolean);
        knownWorkspaceFilePaths.value = paths;
        availableLanguages.value = detectWorkspaceLanguages(paths);
        return;
      }
    } catch (err) {
      console.warn("Failed to search workspace files for languages:", err);
    }
  }

  const tabPaths = tabs.value
    .map((t) => t.path)
    .filter((p) => p && !p.startsWith("untitled://"));
  knownWorkspaceFilePaths.value = tabPaths;
  availableLanguages.value = detectWorkspaceLanguages(tabPaths);
}

async function loadReferenceFile(path: string) {
  qaReferencePath.value = path;
  const filename = path.replace(/\\/g, "/").split("/").pop() || "Referenz";
  qaReferenceTitle.value = filename;

  const langInfo = detectLanguageFromPath(path);
  if (langInfo) {
    qaReferenceLang.value = langInfo.langCode;
  }

  const openTab = tabs.value.find((t) => t.path === path);
  if (openTab) {
    qaReferenceContent.value = openTab.content;
    return;
  }

  if (isTauri) {
    try {
      const content = await readTextFile(path);
      qaReferenceContent.value = content;
    } catch (err) {
      console.warn("Failed to read reference file:", err);
    }
  }
}

async function autoLoadReferenceForActiveTab() {
  const currentPath = activeTab.value?.path;
  await scanWorkspaceForLanguages();

  if (!currentPath || currentPath.startsWith("untitled://")) {
    if (!qaReferenceContent.value) {
      qaReferenceTitle.value = "Referenz (Wählen...)";
      qaReferenceContent.value =
        "# Referenzdokument\n\nWählen Sie eine Referenzdatei oder Sprache zur Gegenüberstellung.";
    }
    return;
  }

  const targetRef = findCorrespondingFilePath(
    currentPath,
    qaReferenceLang.value,
    knownWorkspaceFilePaths.value,
  );

  if (targetRef) {
    await loadReferenceFile(targetRef);
  } else if (!qaReferenceContent.value) {
    qaReferenceTitle.value = "Referenz (Wählen...)";
    qaReferenceContent.value = `# Keine korrespondierende ${qaReferenceLang.value.toUpperCase()}-Datei gefunden\n\nFür \`${activeTab.value?.title}\` wurde im Pfad \`${qaReferenceLang.value}/\` kein automatisches Gegenstück gefunden. Bitte wählen Sie eine Referenzdatei über "Wählen...".`;
  }
}

async function handleChooseReferenceFile() {
  if (isTauri) {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      });
      if (selected && typeof selected === "string") {
        await loadReferenceFile(selected);
      }
    } catch (err) {
      console.error("Choose reference file failed:", err);
    }
  } else {
    const otherTabs = tabs.value.filter(
      (_, idx) => idx !== activeTabIndex.value,
    );
    if (otherTabs.length > 0) {
      const chosen = otherTabs[0];
      qaReferencePath.value = chosen.path;
      qaReferenceTitle.value = chosen.title;
      qaReferenceContent.value = chosen.content;
    }
  }
}

async function handleChangeReferenceLanguage(langCode: string) {
  qaReferenceLang.value = langCode;
  const currentPath = activeTab.value?.path;
  if (currentPath && !currentPath.startsWith("untitled://")) {
    const targetRef = findCorrespondingFilePath(
      currentPath,
      langCode,
      knownWorkspaceFilePaths.value,
    );
    if (targetRef) {
      await loadReferenceFile(targetRef);
    }
  }
}

function handleSwapDocuments() {
  if (!qaReferenceContent.value) return;

  const oldEditorPath = activeTab.value?.path || `untitled://${Date.now()}`;
  const oldEditorTitle = activeTab.value?.title || "Dokument";
  const oldEditorContent = markdownSource.value;

  const newEditorPath = qaReferencePath.value || `untitled://${Date.now()}`;
  const newEditorTitle = qaReferenceTitle.value || "Dokument";
  const newEditorContent = qaReferenceContent.value;

  qaReferencePath.value = oldEditorPath;
  qaReferenceTitle.value = oldEditorTitle;
  qaReferenceContent.value = oldEditorContent;
  const refLang = detectLanguageFromPath(oldEditorPath);
  if (refLang) {
    qaReferenceLang.value = refLang.langCode;
  }

  if (activeTab.value) {
    activeTab.value.path = newEditorPath;
    activeTab.value.title = newEditorTitle;
    activeTab.value.content = newEditorContent;
  }
  markdownSource.value = newEditorContent;
  saveTabsState();
}

let activeScroller: "editor" | "preview" | "reference" | null = null;
let syncSource: "editor" | "preview" | "reference" | null = null;
let syncResetTimer: ReturnType<typeof setTimeout> | null = null;
let editorSyncRaf: number | null = null;
let previewSyncRaf: number | null = null;
let refSyncRaf: number | null = null;

function onEditorUserInteraction() {
  activeScroller = "editor";
}

function onPreviewUserInteraction() {
  activeScroller = "preview";
}

function onReferenceUserInteraction() {
  activeScroller = "reference";
}

function onEditorScroll(info: {
  fractionalLine: number;
  ratio: number;
  totalLines: number;
}) {
  if (syncMode.value === "off") return;
  if (syncSource === "preview" || syncSource === "reference") return;

  activeScroller = "editor";
  syncSource = "editor";

  if (editorSyncRaf !== null) {
    cancelAnimationFrame(editorSyncRaf);
  }

  editorSyncRaf = requestAnimationFrame(() => {
    editorSyncRaf = null;

    // 1. Sync Reference Pane (if QA mode active)
    if (
      showQaReference.value &&
      qaReferenceRef.value &&
      qaReferenceContent.value
    ) {
      if (syncMode.value === "header") {
        const editorHeadings = extractHeadings(markdownSource.value);
        const refHeadings = extractHeadings(qaReferenceContent.value);
        const totalRefLines = qaReferenceContent.value.split("\n").length;
        const targetRefLine = interpolateTargetLine(
          info.fractionalLine,
          editorHeadings,
          refHeadings,
          info.totalLines,
          totalRefLines,
        );
        qaReferenceRef.value.scrollToFractionalLine(
          targetRefLine,
          info.ratio,
          totalRefLines,
        );
      } else {
        qaReferenceRef.value.scrollToRatio(info.ratio);
      }
    }

    // 2. Sync Preview Pane (if present)
    if (showPreview.value && previewRef.value) {
      previewRef.value.scrollToFractionalLine(
        info.fractionalLine,
        info.ratio,
        info.totalLines,
      );
    }

    if (syncResetTimer) clearTimeout(syncResetTimer);
    syncResetTimer = setTimeout(() => {
      syncSource = null;
    }, 60);
  });
}

function onPreviewScroll(info: {
  fractionalLine: number;
  ratio: number;
}) {
  if (syncMode.value === "off" || !showPreview.value) return;
  if (syncSource === "editor" || syncSource === "reference") return;

  activeScroller = "preview";
  syncSource = "preview";

  if (previewSyncRaf !== null) {
    cancelAnimationFrame(previewSyncRaf);
  }

  previewSyncRaf = requestAnimationFrame(() => {
    previewSyncRaf = null;
    if (editorRef.value) {
      editorRef.value.scrollToFractionalLine(info.fractionalLine, info.ratio);
    }
    if (syncResetTimer) clearTimeout(syncResetTimer);
    syncResetTimer = setTimeout(() => {
      syncSource = null;
    }, 60);
  });
}

function onReferenceScroll(info: {
  fractionalLine: number;
  ratio: number;
  totalLines: number;
}) {
  if (syncMode.value === "off" || !showQaReference.value) return;
  if (syncSource === "editor" || syncSource === "preview") return;

  activeScroller = "reference";
  syncSource = "reference";

  if (refSyncRaf !== null) {
    cancelAnimationFrame(refSyncRaf);
  }

  refSyncRaf = requestAnimationFrame(() => {
    refSyncRaf = null;

    if (editorRef.value) {
      if (syncMode.value === "header" && qaReferenceContent.value) {
        const refHeadings = extractHeadings(qaReferenceContent.value);
        const editorHeadings = extractHeadings(markdownSource.value);
        const totalEditorLines = (markdownSource.value || "").split(
          "\n",
        ).length;
        const targetEditorLine = interpolateTargetLine(
          info.fractionalLine,
          refHeadings,
          editorHeadings,
          info.totalLines,
          totalEditorLines,
        );
        editorRef.value.scrollToFractionalLine(targetEditorLine, info.ratio);
      } else {
        editorRef.value.scrollToRatio(info.ratio);
      }
    }

    if (syncResetTimer) clearTimeout(syncResetTimer);
    syncResetTimer = setTimeout(() => {
      syncSource = null;
    }, 60);
  });
}

function toggleVimMode() {
  vimMode.value = !vimMode.value;
  const currentSettings = localStorage.getItem("zentauri-settings");
  let s: Record<string, unknown> = {};
  if (currentSettings) {
    try {
      s = JSON.parse(currentSettings);
    } catch {}
  }
  localStorage.setItem(
    "zentauri-settings",
    JSON.stringify({ ...s, vimMode: vimMode.value }),
  );
}

const saveStatus = computed(() => {
  if (isPdfExported.value) {
    return {
      text: "PDF Exported",
      dotClass: "w-2.5 h-2.5 bg-blue-500 animate-pulse",
      title: "PDF successfully exported",
    };
  }
  if (isAutoRepaired.value) {
    return {
      text: "Auto-Repaired & Saved",
      dotClass: "w-2.5 h-2.5 bg-amber-400 animate-bounce",
      title: "Syntax auto-repaired and saved",
    };
  }
  if (isSaving.value) {
    return {
      text: "Saving...",
      dotClass: "w-2 h-2 bg-amber-500 animate-pulse",
      title: "Saving changes to disk...",
    };
  }
  if (!autoSaveEnabled.value) {
    if (activeTab.value?.isDirty) {
      return {
        text: "Unsaved (Auto-Save Off)",
        dotClass: "w-2 h-2 bg-amber-500",
        title: "Unsaved changes. Press Cmd/Ctrl+S or click Save.",
      };
    }
    return {
      text: "Saved (Auto-Save Off)",
      dotClass: "w-2 h-2 bg-slate-400 dark:bg-slate-500",
      title: "All changes saved to disk. Auto-Save is disabled.",
    };
  }
  return {
    text: "Saved",
    dotClass: "w-2 h-2 bg-emerald-500",
    title: "All changes automatically saved to disk",
  };
});

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
  } else if (action === "export-pdf") {
    handleExportPdf();
  }
}

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
        tabs.value = savedData.tabs.map((t: Tab) => ({
          ...t,
          isDirty: t.isDirty ?? false,
        }));
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
    if (!Number.isNaN(w)) {
      sidebarWidth.value = Math.min(Math.max(160, w), 480);
    }
  }

  const settingsStr = localStorage.getItem("zentauri-settings");
  if (settingsStr) {
    try {
      const s = JSON.parse(settingsStr);
      if (s.autoSave !== undefined) autoSaveEnabled.value = s.autoSave;
      if (s.pdfPaper) pdfPaper.value = s.pdfPaper;
      if (s.vimMode !== undefined) vimMode.value = s.vimMode;
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

    const debouncedFsRefresh = debounce(() => {
      fileTreeRef.value?.triggerWorkspaceRefresh();
    }, 300);

    listen<{ kind: string; paths: string[] }>("workspace-fs-changed", () => {
      debouncedFsRefresh();
    })
      .then((unlisten) => {
        unlistenFns.push(unlisten);
      })
      .catch((err) => {
        console.error("Failed to setup workspace-fs-changed listener:", err);
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
  if (editorSyncRaf !== null) cancelAnimationFrame(editorSyncRaf);
  if (previewSyncRaf !== null) cancelAnimationFrame(previewSyncRaf);
  if (syncResetTimer) clearTimeout(syncResetTimer);
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
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
    e.preventDefault();
    if (e.shiftKey) {
      handlePrint();
    } else {
      handleExportPdf();
    }
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
    e.preventDefault();
    handleJumpToLinePrompt();
  } else if (
    ((e.metaKey || e.ctrlKey) &&
      e.altKey &&
      (e.code === "KeyD" || e.key.toLowerCase() === "d")) ||
    (e.key === "F4" && !e.shiftKey)
  ) {
    e.preventDefault();
    editorRef.value?.toggleTransliteration("iast");
  } else if (
    ((e.metaKey || e.ctrlKey) &&
      e.altKey &&
      (e.code === "KeyH" || e.key.toLowerCase() === "h")) ||
    (e.key === "F4" && e.shiftKey)
  ) {
    e.preventDefault();
    editorRef.value?.toggleTransliteration("hk");
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
      tab.isDirty = false;
      saveTabsState();
    } catch (err) {
      console.error("Save failed for tab:", tab.path, err);
    } finally {
      setTimeout(() => {
        isSaving.value = false;
      }, 500);
    }
  } else {
    tab.isDirty = false;
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
        tab.isDirty = false;
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

function handleBeforeUnload() {
  if (autoSave) {
    autoSave.cancel();
  }
  if (autoSaveEnabled.value) {
    handleSaveAll();
  }
  saveTabsState();
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
      tab.isDirty = false;
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
    tab.isDirty = true;
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

function scrollToActiveTab() {
  nextTick(() => {
    const activeEl = document.querySelector(".tab-item-active") as HTMLElement;
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  });
}

function openTab(title: string, path: string, content: string) {
  const existingIndex = tabs.value.findIndex(
    (t) => t.path === path && !t.isWeb,
  );
  if (existingIndex >= 0) {
    activeTabIndex.value = existingIndex;
    markdownSource.value = tabs.value[existingIndex].content;
  } else {
    // If only an untouched default/untitled tab exists and we are opening a real file, replace it
    const hasOnlyUntouchedDefault =
      !path.startsWith("untitled://") &&
      tabs.value.length === 1 &&
      tabs.value[0].path.startsWith("untitled://") &&
      (tabs.value[0].content === defaultContent ||
        tabs.value[0].content === "");

    if (hasOnlyUntouchedDefault) {
      tabs.value = [
        {
          id: Date.now().toString(),
          path,
          title,
          content,
          isWeb: false,
          isDirty: false,
        },
      ];
      activeTabIndex.value = 0;
      markdownSource.value = content;
    } else {
      tabs.value.push({
        id: Date.now().toString(),
        path,
        title,
        content,
        isWeb: false,
        isDirty: false,
      });
      activeTabIndex.value = tabs.value.length - 1;
      markdownSource.value = content;
    }
  }
  saveTabsState();
  focusEditor();
  scrollToActiveTab();
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

async function closeTab(index: number, event?: Event): Promise<boolean> {
  if (event) event.stopPropagation();
  const closingTab = tabs.value[index];
  if (!closingTab) return true;

  if (!closingTab.isWeb) {
    autoSave.cancel();
    if (autoSaveEnabled.value) {
      await saveTabToFile(closingTab, false);
    } else if (closingTab.isDirty) {
      let decision = "Don't Save";
      if (isTauri) {
        try {
          const res = await message(
            `"${closingTab.title}" has unsaved changes.\nDo you want to save before closing?`,
            {
              title: "Unsaved Changes",
              kind: "warning",
              buttons: { yes: "Save", no: "Don't Save", cancel: "Cancel" },
            },
          );
          decision = res;
        } catch {
          const ok = window.confirm(
            `Save changes to "${closingTab.title}" before closing?`,
          );
          decision = ok ? "Save" : "Don't Save";
        }
      } else if (
        typeof window !== "undefined" &&
        typeof window.confirm === "function"
      ) {
        const ok = window.confirm(
          `Save changes to "${closingTab.title}" before closing?`,
        );
        decision = ok ? "Save" : "Don't Save";
      }

      if (decision === "Cancel") {
        return false;
      }
      if (decision === "Save") {
        await saveTabToFile(closingTab, false);
      }
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
  return true;
}

const tabContextMenuTarget = ref<{
  node: { name: string; path: string; isDirectory: boolean };
  x: number;
  y: number;
  index: number;
} | null>(null);

function handleTabContextMenu(index: number, e: MouseEvent) {
  e.preventDefault();
  const tab = tabs.value[index];
  if (!tab) return;
  tabContextMenuTarget.value = {
    node: {
      name: tab.title,
      path: tab.path,
      isDirectory: false,
    },
    x: e.clientX,
    y: e.clientY,
    index,
  };
}

const tabContextMenuItems = computed(() => {
  if (!tabContextMenuTarget.value) return [];
  const idx = tabContextMenuTarget.value.index;
  const tab = tabs.value[idx];
  const isRealFile = Boolean(
    tab?.path && !tab.path.startsWith("untitled://") && !tab.isWeb,
  );

  return [
    { label: "Close Tab", action: "close" },
    {
      label: "Close Other Tabs",
      action: "close-others",
      disabled: tabs.value.length <= 1,
    },
    {
      label: "Close Tabs to the Right",
      action: "close-right",
      disabled: idx >= tabs.value.length - 1,
    },
    { divider: true },
    {
      label: "Copy Path",
      action: "copy-path",
      disabled: !isRealFile,
    },
    {
      label: "Reveal in System Finder",
      action: "reveal",
      disabled: !isRealFile || !isTauri,
    },
  ];
});

async function handleTabContextMenuAction(action: string) {
  if (!tabContextMenuTarget.value) return;
  const idx = tabContextMenuTarget.value.index;
  const tab = tabs.value[idx];
  tabContextMenuTarget.value = null;

  switch (action) {
    case "close":
      await closeTab(idx);
      break;
    case "close-others": {
      for (let i = tabs.value.length - 1; i >= 0; i--) {
        if (i === idx) continue;
        const closed = await closeTab(i);
        if (!closed) break;
      }
      break;
    }
    case "close-right": {
      for (let i = tabs.value.length - 1; i > idx; i--) {
        const closed = await closeTab(i);
        if (!closed) break;
      }
      break;
    }
    case "copy-path":
      if (tab?.path) {
        try {
          await navigator.clipboard.writeText(tab.path);
        } catch (err) {
          console.error("Failed to copy path:", err);
        }
      }
      break;
    case "reveal":
      if (tab?.path && isTauri) {
        try {
          await invoke("reveal_in_explorer", { path: tab.path });
        } catch (err) {
          console.error("Failed to reveal file in finder:", err);
        }
      }
      break;
  }
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
  scrollToActiveTab();
  if (isQaMode.value) {
    autoLoadReferenceForActiveTab();
  }
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
  if (settings.pdfPaper !== undefined) pdfPaper.value = settings.pdfPaper;
  if (settings.syncMode !== undefined) {
    syncMode.value = settings.syncMode;
  } else if (settings.syncScroll !== undefined) {
    syncMode.value = settings.syncScroll
      ? syncMode.value === "off"
        ? "header"
        : syncMode.value
      : "off";
  }
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
      const typstMarkup = convertMarkdownToTypst(tab.content, {
        paper: pdfPaper.value,
      });
      await invoke("export_pdf", { typstMarkup, destinationPath: destPath });
      isPdfExported.value = true;
      setTimeout(() => {
        isPdfExported.value = false;
      }, 2500);
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
    <header class="flex-none flex items-center px-4 py-2 border-b border-app-border bg-app-bg-secondary select-none print:hidden relative z-30" data-tauri-drag-region>
      <!-- Auto-Save, Auto-Repair & Export Status -->
      <div class="flex-1 text-center text-sm font-medium text-app-text-muted absolute left-0 right-0 pointer-events-none flex items-center justify-center gap-2">
        <span class="inline-block rounded-full" :class="saveStatus.dotClass" :title="saveStatus.title"></span>
        <span>{{ saveStatus.text }}</span>
      </div>
      
      <!-- Unified View Mode & Representation Action Toolbar -->
      <div class="flex items-center bg-app-bg p-0.5 rounded-md border border-app-border shadow-xs z-10 relative ml-auto gap-0.5">

        <!-- Source Mode Button -->
        <div class="relative group/tooltip inline-flex items-center">
          <button 
            @click="setViewMode('source')" 
            class="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer bg-app-bg"
            :class="viewMode === 'source' ? 'text-blue-500 dark:text-blue-400 font-semibold shadow-xs ring-1 ring-blue-500/30' : 'text-app-text-muted hover:text-app-text hover:bg-app-bg-hover'"
            title="Source Code Editor"
            aria-label="Source Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
          </button>

          <!-- Balloon Tooltip -->
          <div class="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 translate-y-1 group-hover/tooltip:translate-y-0 transition-all duration-150 delay-0 group-hover/tooltip:delay-150 z-50 flex flex-col items-center whitespace-nowrap">
            <div class="w-2 h-2 -mb-1 rotate-45 bg-[#18181b] dark:bg-[#0f1e35] border-t border-l border-slate-700/60 dark:border-slate-600/60"></div>
            <div class="px-2 py-1 text-[11px] font-medium rounded shadow-xl bg-[#18181b] text-slate-100 dark:bg-[#0f1e35] dark:text-[#e8e0d3] border border-slate-700/60 dark:border-slate-600/60 leading-tight">
              Source Mode
            </div>
          </div>
        </div>

        <!-- Split Mode Button -->
        <div class="relative group/tooltip inline-flex items-center">
          <button 
            @click="setViewMode('split')" 
            class="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer bg-app-bg"
            :class="viewMode === 'split' ? 'text-blue-500 dark:text-blue-400 font-semibold shadow-xs ring-1 ring-blue-500/30' : 'text-app-text-muted hover:text-app-text hover:bg-app-bg-hover'"
            title="Split Mode (Editor + Preview)"
            aria-label="Split Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M12 3v18"/>
            </svg>
          </button>

          <!-- Balloon Tooltip -->
          <div class="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 translate-y-1 group-hover/tooltip:translate-y-0 transition-all duration-150 delay-0 group-hover/tooltip:delay-150 z-50 flex flex-col items-center whitespace-nowrap">
            <div class="w-2 h-2 -mb-1 rotate-45 bg-[#18181b] dark:bg-[#0f1e35] border-t border-l border-slate-700/60 dark:border-slate-600/60"></div>
            <div class="px-2 py-1 text-[11px] font-medium rounded shadow-xl bg-[#18181b] text-slate-100 dark:bg-[#0f1e35] dark:text-[#e8e0d3] border border-slate-700/60 dark:border-slate-600/60 leading-tight">
              Split Mode (Editor + Preview)
            </div>
          </div>
        </div>

        <!-- 2-Col QA Comparison Button -->
        <div class="relative group/tooltip inline-flex items-center">
          <button 
            @click="setViewMode('qa-2col')" 
            class="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer bg-app-bg"
            :class="viewMode === 'qa-2col' ? 'text-blue-500 dark:text-blue-400 font-semibold shadow-xs ring-1 ring-blue-500/30' : 'text-app-text-muted hover:text-app-text hover:bg-app-bg-hover'"
            title="2-Col QA Vergleich (Referenz + Editor)"
            aria-label="2-Col QA Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M12 3v18"/>
              <path d="m8 10 2 2-2 2"/>
              <path d="m16 10-2 2 2 2"/>
            </svg>
          </button>

          <!-- Balloon Tooltip -->
          <div class="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 translate-y-1 group-hover/tooltip:translate-y-0 transition-all duration-150 delay-0 group-hover/tooltip:delay-150 z-50 flex flex-col items-center whitespace-nowrap">
            <div class="w-2 h-2 -mb-1 rotate-45 bg-[#18181b] dark:bg-[#0f1e35] border-t border-l border-slate-700/60 dark:border-slate-600/60"></div>
            <div class="px-2 py-1 text-[11px] font-medium rounded shadow-xl bg-[#18181b] text-slate-100 dark:bg-[#0f1e35] dark:text-[#e8e0d3] border border-slate-700/60 dark:border-slate-600/60 leading-tight">
              2-Col QA Vergleich
            </div>
          </div>
        </div>

        <!-- 3-Col QA Comparison Button -->
        <div class="relative group/tooltip inline-flex items-center">
          <button 
            @click="setViewMode('qa-3col')" 
            class="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer bg-app-bg"
            :class="viewMode === 'qa-3col' ? 'text-blue-500 dark:text-blue-400 font-semibold shadow-xs ring-1 ring-blue-500/30' : 'text-app-text-muted hover:text-app-text hover:bg-app-bg-hover'"
            title="3-Col QA Vergleich (Referenz + Editor + Vorschau)"
            aria-label="3-Col QA Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
              <path d="M15 3v18"/>
            </svg>
          </button>

          <!-- Balloon Tooltip -->
          <div class="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 translate-y-1 group-hover/tooltip:translate-y-0 transition-all duration-150 delay-0 group-hover/tooltip:delay-150 z-50 flex flex-col items-center whitespace-nowrap">
            <div class="w-2 h-2 -mb-1 rotate-45 bg-[#18181b] dark:bg-[#0f1e35] border-t border-l border-slate-700/60 dark:border-slate-600/60"></div>
            <div class="px-2 py-1 text-[11px] font-medium rounded shadow-xl bg-[#18181b] text-slate-100 dark:bg-[#0f1e35] dark:text-[#e8e0d3] border border-slate-700/60 dark:border-slate-600/60 leading-tight">
              3-Col QA (Ref + Edit + Prev)
            </div>
          </div>
        </div>

        <!-- Sync Scroll Mode Button (visible in Split, QA 2-Col or QA 3-Col) -->
        <template v-if="viewMode === 'split' || isQaMode">
          <div class="w-[1px] h-3.5 bg-app-border mx-0.5"></div>

          <div class="relative group/tooltip inline-flex items-center">
            <button
              @click="cycleSyncMode"
              class="h-7 px-1.5 flex items-center justify-center gap-1 rounded transition-colors cursor-pointer bg-app-bg"
              :class="syncMode !== 'off' ? 'text-amber-500 dark:text-amber-400 font-semibold shadow-xs ring-1 ring-amber-500/30' : 'text-app-text-muted hover:text-app-text hover:bg-app-bg-hover'"
              :title="`Scroll-Sync: ${syncMode === 'header' ? 'Header Matching' : syncMode === 'percentage' ? 'Percentage' : 'Aus'}`"
              aria-label="Scroll-Synchronisation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span class="text-[10px] font-mono font-bold leading-none uppercase">
                {{ syncMode === 'header' ? 'H' : syncMode === 'percentage' ? '%' : 'Off' }}
              </span>
            </button>

            <!-- Balloon Tooltip -->
            <div class="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 translate-y-1 group-hover/tooltip:translate-y-0 transition-all duration-150 delay-0 group-hover/tooltip:delay-150 z-50 flex flex-col items-center whitespace-nowrap">
              <div class="w-2 h-2 -mb-1 rotate-45 bg-[#18181b] dark:bg-[#0f1e35] border-t border-l border-slate-700/60 dark:border-slate-600/60"></div>
              <div class="px-2 py-1 text-[11px] font-medium rounded shadow-xl bg-[#18181b] text-slate-100 dark:bg-[#0f1e35] dark:text-[#e8e0d3] border border-slate-700/60 dark:border-slate-600/60 leading-tight">
                {{ syncMode === 'header' ? 'Sync: Header-Matching' : syncMode === 'percentage' ? 'Sync: Prozentual' : 'Sync: Deaktiviert' }} (Klicken zum Umschalten)
              </div>
            </div>
          </div>
        </template>

        <!-- SWAP Button (visible in QA mode) -->
        <template v-if="isQaMode">
          <div class="w-[1px] h-3.5 bg-app-border mx-0.5"></div>

          <div class="relative group/tooltip inline-flex items-center">
            <button
              @click="handleSwapDocuments"
              class="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer bg-app-bg text-amber-500 hover:text-amber-400 hover:bg-app-bg-hover active:scale-95"
              title="Dokumente tauschen: Referenz ⇄ Editor (SWAP)"
              aria-label="Dokumente tauschen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 3 21 8 16 13"/>
                <line x1="21" y1="8" x2="9" y2="8"/>
                <polyline points="8 21 3 16 8 11"/>
                <line x1="3" y1="16" x2="15" y2="16"/>
              </svg>
            </button>

            <!-- Balloon Tooltip -->
            <div class="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 translate-y-1 group-hover/tooltip:translate-y-0 transition-all duration-150 delay-0 group-hover/tooltip:delay-150 z-50 flex flex-col items-center whitespace-nowrap">
              <div class="w-2 h-2 -mb-1 rotate-45 bg-[#18181b] dark:bg-[#0f1e35] border-t border-l border-slate-700/60 dark:border-slate-600/60"></div>
              <div class="px-2 py-1 text-[11px] font-medium rounded shadow-xl bg-[#18181b] text-slate-100 dark:bg-[#0f1e35] dark:text-[#e8e0d3] border border-slate-700/60 dark:border-slate-600/60 leading-tight">
                Seiten tauschen: Referenz ⇄ Editor (SWAP)
              </div>
            </div>
          </div>
        </template>

        <!-- Divider -->
        <div class="w-[1px] h-3.5 bg-app-border mx-0.5"></div>

        <!-- Vim Mode Toggle Button -->
        <div class="relative group/tooltip inline-flex items-center">
          <button
            @click="toggleVimMode"
            class="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer bg-app-bg"
            :class="vimMode ? 'text-blue-500 dark:text-blue-400 font-bold shadow-xs ring-1 ring-blue-500/30' : 'text-app-text-muted hover:text-app-text hover:bg-app-bg-hover'"
            :title="vimMode ? 'Vim-Modus: Aktiv' : 'Vim-Modus: Inaktiv'"
            aria-label="Vim Mode"
          >
            <span class="font-mono font-bold text-xs select-none leading-none">V</span>
          </button>

          <!-- Balloon Tooltip -->
          <div class="pointer-events-none absolute top-full mt-2 right-0 opacity-0 group-hover/tooltip:opacity-100 translate-y-1 group-hover/tooltip:translate-y-0 transition-all duration-150 delay-0 group-hover/tooltip:delay-150 z-50 flex flex-col items-end whitespace-nowrap">
            <div class="w-2 h-2 -mb-1 mr-2.5 rotate-45 bg-[#18181b] dark:bg-[#0f1e35] border-t border-l border-slate-700/60 dark:border-slate-600/60"></div>
            <div class="px-2 py-1 text-[11px] font-medium rounded shadow-xl bg-[#18181b] text-slate-100 dark:bg-[#0f1e35] dark:text-[#e8e0d3] border border-slate-700/60 dark:border-slate-600/60 leading-tight">
              {{ vimMode ? 'Vim-Modus: Aktiv' : 'Vim-Modus: Inaktiv' }}
            </div>
          </div>
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
        class="flex-none border-r border-app-border print:hidden h-full overflow-hidden max-w-[480px] min-w-[160px]"
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
        class="flex-none border-r border-app-border print:hidden h-full max-w-[480px] min-w-[160px]"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <Cheatsheet @insertSnippet="handleInsertSnippet" @insert="handleInsertFromCheatsheet" class="h-full" />
      </div>

      <!-- Search Sidebar -->
      <div 
        v-show="showSearch" 
        class="flex-none border-r border-app-border print:hidden h-full max-w-[480px] min-w-[160px]"
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
            @contextmenu="handleTabContextMenu(index, $event)"
            class="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-app-border transition-colors whitespace-nowrap"
            :class="[
              activeTabIndex === index 
                ? 'bg-app-bg text-app-text border-t-2 border-t-blue-500 tab-item-active' 
                : 'bg-app-bg-secondary text-app-text-muted hover:bg-app-bg border-t-2 border-t-transparent'
            ]"
          >
            <span>{{ tab.title }}</span>
            <span 
              v-if="tab.isDirty" 
              class="w-2 h-2 rounded-full bg-amber-500 shrink-0" 
              title="Unsaved changes"
            ></span>
            <button 
              @click="closeTab(index, $event)" 
              class="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-app-border text-app-text-muted hover:text-app-text transition-colors"
            >
              ×
            </button>
          </div>
        </div>
        
        <!-- Editor/Preview/QA Split Container -->
        <div class="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
          <!-- QA Reference Pane (Left, visible in QA Mode) -->
          <div v-if="showQaReference" class="flex-1 h-full min-w-0 print:hidden">
            <QaReferencePane
              ref="qaReferenceRef"
              :title="qaReferenceTitle"
              :filePath="qaReferencePath"
              :content="qaReferenceContent"
              :langCode="qaReferenceLang"
              :availableLanguages="availableLanguages"
              :syncMode="syncMode"
              @scroll="onReferenceScroll"
              @user-interaction="onReferenceUserInteraction"
              @change-language="handleChangeReferenceLanguage"
              @choose-file="handleChooseReferenceFile"
              @swap="handleSwapDocuments"
              @close="setViewMode('split')"
              @open-url="openExternalUrl"
              @set-sync-mode="setSyncMode"
            />
          </div>

          <!-- Editor Pane (Center/Left) -->
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

              <!-- Transliteration Toggle Buttons (IAST ⇄ Devanagari & HK ⇄ Devanagari) -->
              <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                <button
                  type="button"
                  @click="editorRef?.toggleTransliteration('iast')"
                  title="IAST ⇄ Devanagari Umschalter (Cmd+Alt+D / F4)"
                  class="flex items-center gap-1 px-2 py-0.5 rounded bg-app-bg hover:bg-app-bg-hover border border-app-border text-xs font-mono transition-colors whitespace-nowrap cursor-pointer shadow-xs active:scale-95 text-app-text"
                >
                  <span class="text-blue-500 font-semibold">IAST</span>
                  <span class="text-app-text-muted">⇄</span>
                  <span class="text-[#b22222] font-bold">देव</span>
                  <span class="hidden xl:inline text-[10px] text-app-text-muted opacity-80">(⌥⌘D)</span>
                </button>
                <button
                  type="button"
                  @click="editorRef?.toggleTransliteration('hk')"
                  title="Harvard-Kyoto ⇄ Devanagari Umschalter (Cmd+Alt+H / Shift+F4)"
                  class="flex items-center gap-1 px-2 py-0.5 rounded bg-app-bg hover:bg-app-bg-hover border border-app-border text-xs font-mono transition-colors whitespace-nowrap cursor-pointer shadow-xs active:scale-95 text-app-text"
                >
                  <span class="text-emerald-500 font-semibold">HK</span>
                  <span class="text-app-text-muted">⇄</span>
                  <span class="text-[#b22222] font-bold">देव</span>
                  <span class="hidden xl:inline text-[10px] text-app-text-muted opacity-80">(⌥⌘H)</span>
                </button>
              </div>
            </div>

            <!-- CodeMirror Editor -->
            <div class="flex-1 h-full min-w-0 overflow-hidden">
              <Editor
                ref="editorRef"
                v-model="markdownSource"
                :vimMode="vimMode"
                :livePreview="isLivePreview"
                @scroll="onEditorScroll"
                @user-interaction="onEditorUserInteraction"
                @cursor-change="onCursorChange"
              />
            </div>
          </div>


          <!-- Preview Pane (Right) -->
          <div v-show="showPreview" class="flex-1 h-full bg-app-bg min-w-0 print:!block print:w-full print:h-auto print:overflow-visible print:bg-white">
            <Preview
              ref="previewRef"
              :source="markdownSource"
              @scroll="onPreviewScroll"
              @user-interaction="onPreviewUserInteraction"
              @open-url="openExternalUrl"
              @open-file="handlePreviewOpenFile"
            />
          </div>
        </div>

      </div>
    </div>

    <!-- Status Bar -->
    <StatusBar
      :cursorInfo="cursorInfo"
      :wordCount="wordCount"
      :charCount="charCount"
      :readTime="readTime"
      :vimMode="vimMode"
      :syncScroll="syncScroll"
      :syncMode="syncMode"
      :viewMode="viewMode"
      :workspaceName="currentWorkspaceName"
      :activeFilePath="tabs[activeTabIndex]?.path"
      :saveStatus="saveStatus"
      @jump-to-line="handleJumpToLinePrompt"
    />

    <!-- Tab Bar Context Menu -->
    <ContextMenu 
      v-if="tabContextMenuTarget"
      :target="tabContextMenuTarget"
      :items="tabContextMenuItems"
      @action="handleTabContextMenuAction"
      @close="tabContextMenuTarget = null"
    />
  </main>
</template>