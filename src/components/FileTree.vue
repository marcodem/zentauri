<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import {
  readDir,
  mkdir,
  writeTextFile,
  rename,
  remove,
} from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import FileTreeNode, { type FileEntry } from "./FileTreeNode.vue";
import ContextMenu from "./ContextMenu.vue";

const props = defineProps<{
  rootPath: string | null;
  activePath?: string;
  openTabs?: { id: string; path: string; title: string; content: string }[];
}>();

const emit = defineEmits<{
  (e: "select", path: string): void;
  (e: "open-folder"): void;
  (e: "open-file"): void;
  (e: "print"): void;
  (e: "open-settings"): void;
  (e: "toggle-help"): void;
  (e: "toggle-cheatsheet"): void;
  (e: "close-tab", index: number): void;
  (e: "new-file"): void;
  (e: "new-folder"): void;
  (e: "save-all"): void;
}>();

const rootEntries = ref<FileEntry[]>([]);
const isLoading = ref(false);
const loadError = ref<string | null>(null);

const isOpenEditorsExpanded = ref(true);
const isFolderExpanded = ref(true);
const sortMode = ref<"name-asc" | "name-desc" | "date-desc" | "date-asc">(
  "name-asc",
);
const quickFilter = ref("");

const computedFilteredEntries = computed(() => {
  if (!quickFilter.value.trim()) return rootEntries.value;
  const q = quickFilter.value.toLowerCase().trim();
  return rootEntries.value.filter((e) => e.name.toLowerCase().includes(q));
});

const isTauri =
  typeof window !== "undefined" &&
  (window as any).__TAURI_INTERNALS__ !== undefined;

const loadRoot = async () => {
  if (!props.rootPath) {
    rootEntries.value = [];
    loadError.value = null;
    return;
  }

  isLoading.value = true;
  loadError.value = null;

  if (isTauri) {
    try {
      const rawNodes = await invoke<
        { name: string; path: string; is_directory: boolean }[]
      >("read_workspace_tree", {
        path: props.rootPath,
        sortMode: sortMode.value,
      });
      rootEntries.value = rawNodes.map((n) => ({
        name: n.name,
        path: n.path,
        isDirectory: n.is_directory,
      }));
      isLoading.value = false;
      return;
    } catch (e) {
      console.error("Failed to load workspace root via Rust IPC:", e);
    }
  }

  // Browser Mode or Fallback
  try {
    const entries = await readDir(props.rootPath);
    rootEntries.value = entries
      .map((e) => ({
        name: e.name || "unknown",
        path: `${props.rootPath}/${e.name}`,
        isDirectory: e.isDirectory,
      }))
      .filter(
        (e) =>
          e.isDirectory ||
          e.name.toLowerCase().endsWith(".md") ||
          e.name.toLowerCase().endsWith(".markdown"),
      )
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (fsErr) {
    // Browser mode fallback when direct filesystem access is restricted
    rootEntries.value = [
      {
        name: "01_Welcome.md",
        path: `${props.rootPath}/01_Welcome.md`,
        isDirectory: false,
      },
      {
        name: "02_Sanskrit_Notes.md",
        path: `${props.rootPath}/02_Sanskrit_Notes.md`,
        isDirectory: false,
      },
      {
        name: "Grammatik_Uebungen",
        path: `${props.rootPath}/Grammatik_Uebungen`,
        isDirectory: true,
      },
    ];
    loadError.value = null;
  } finally {
    isLoading.value = false;
  }
};

async function handleMoveConfirm(payload: {
  sourcePath: string;
  targetDirPath: string;
}) {
  try {
    if (isTauri) {
      await invoke("move_file_item", {
        sourcePath: payload.sourcePath,
        targetDirPath: payload.targetDirPath,
      });
    } else {
      await rename(
        payload.sourcePath,
        `${payload.targetDirPath}/${payload.sourcePath.split(/[/\\]/).pop()}`,
      );
    }
    await loadRoot();
  } catch (err) {
    alert(`Fehler beim Verschieben: ${err}`);
  }
}

async function revealActiveFile() {
  if (!props.activePath) return;
  if (isTauri) {
    try {
      await invoke("reveal_in_explorer", { path: props.activePath });
    } catch (err) {
      console.error("Failed to reveal active file:", err);
    }
  } else {
    alert(`Aktive Datei im Browser: ${props.activePath}`);
  }
}

const getRelativeDirectory = (path: string) => {
  if (!props.rootPath) return "";
  // Normalize slashes just in case
  const normalizedRoot = props.rootPath.replace(/\\/g, "/");
  const normalizedPath = path.replace(/\\/g, "/");

  if (normalizedPath.startsWith(normalizedRoot)) {
    const rel = normalizedPath.slice(normalizedRoot.length + 1);
    const parts = rel.split("/");
    parts.pop(); // remove filename
    return parts.join("/");
  }
  return "";
};

defineExpose({ loadRoot, triggerNewRootFile, triggerNewRootFolder });

// Context menu state
const contextTarget = ref<{ node: FileEntry; x: number; y: number } | null>(
  null,
);
const collapseTrigger = ref(0);
const activeCreateRequest = ref<{
  parentPath: string;
  type: "file" | "directory";
} | null>(null);
const activeRenamePath = ref<string | null>(null);

function showContextMenu(node: FileEntry, x: number, y: number) {
  contextTarget.value = { node, x, y };
}

function closeContextMenu() {
  contextTarget.value = null;
}

function collapseAll() {
  collapseTrigger.value++;
}

function triggerNewRootFile() {
  if (!props.rootPath) return;
  if (rootEntries.value.some((e) => e.isNew)) return;
  rootEntries.value.unshift({
    name: "",
    path: "",
    isDirectory: false,
    isNew: true,
    newType: "file",
  });
  isFolderExpanded.value = true;
}

function triggerNewRootFolder() {
  if (!props.rootPath) return;
  if (rootEntries.value.some((e) => e.isNew)) return;
  rootEntries.value.unshift({
    name: "",
    path: "",
    isDirectory: true,
    isNew: true,
    newType: "directory",
  });
  isFolderExpanded.value = true;
}

async function handleRootCreateConfirm(payload: {
  parentPath: string;
  name: string;
  type: "file" | "directory";
}) {
  const parent = payload.parentPath || props.rootPath || "";
  const fullPath = `${parent}/${payload.name}`;
  try {
    if (payload.type === "file") {
      await writeTextFile(
        fullPath,
        "# " + payload.name.replace(/\.md$/, "") + "\n\n",
      );
      emit("select", fullPath);
    } else {
      await mkdir(fullPath);
    }
    await loadRoot();
    activeCreateRequest.value = null;
  } catch (err) {
    alert(`Failed to create: ${err}`);
  }
}

function handleRootCreateCancel() {
  rootEntries.value = rootEntries.value.filter((e) => !e.isNew);
  activeCreateRequest.value = null;
}

async function handleRootRenameConfirm(payload: {
  path: string;
  newName: string;
}) {
  const parentDir = payload.path.substring(0, payload.path.lastIndexOf("/"));
  const newPath = `${parentDir}/${payload.newName}`;
  try {
    await rename(payload.path, newPath);
    activeRenamePath.value = null;
    await loadRoot();
  } catch (err) {
    alert(`Failed to rename: ${err}`);
  }
}

async function handleRootDeleteConfirm(payload: { path: string }) {
  try {
    await remove(payload.path);
    await loadRoot();
  } catch (err) {
    alert(`Failed to delete: ${err}`);
  }
}

// Context menu items
const contextMenuItems = computed(() => {
  if (!contextTarget.value) return [];

  const isDir = contextTarget.value.node.isDirectory;
  return [
    { label: "New File", action: "new-file" },
    { label: "New Folder", action: "new-folder" },
    ...(!isDir ? [{ label: "Duplicate Note", action: "duplicate" }] : []),
    { divider: true },
    { label: "Rename", action: "rename" },
    { label: "Delete", action: "delete" },
    { divider: true },
    ...(!isDir
      ? [{ label: "Copy Markdown Link", action: "copy-md-link" }]
      : []),
    { label: "Reveal in System Finder", action: "reveal" },
    { label: "Copy Full Path", action: "copy-path" },
  ];
});

async function onContextAction(action: string) {
  if (!contextTarget.value) return;

  const node = contextTarget.value.node;
  const parentPath = node.path.substring(0, node.path.lastIndexOf("/"));

  switch (action) {
    case "new-file":
      if (node.isDirectory) {
        activeCreateRequest.value = { parentPath: node.path, type: "file" };
      } else {
        activeCreateRequest.value = { parentPath, type: "file" };
      }
      break;
    case "new-folder":
      if (node.isDirectory) {
        activeCreateRequest.value = {
          parentPath: node.path,
          type: "directory",
        };
      } else {
        activeCreateRequest.value = { parentPath, type: "directory" };
      }
      break;
    case "duplicate":
      try {
        if (isTauri) {
          await invoke("duplicate_file_item", { sourcePath: node.path });
        } else {
          alert(`Duplizieren im Browser-Modus: ${node.name}`);
        }
        await loadRoot();
      } catch (err) {
        alert(`Duplicate failed: ${err}`);
      }
      break;
    case "rename":
      activeRenamePath.value = node.path;
      break;
    case "delete":
      if (confirm(`Are you sure you want to delete "${node.name}"?`)) {
        handleRootDeleteConfirm({ path: node.path });
      }
      break;
    case "copy-md-link":
      {
        const title = node.name.replace(/\.md$/i, "");
        const relDir = getRelativeDirectory(node.path);
        const relPath = relDir ? `${relDir}/${node.name}` : node.name;
        navigator.clipboard.writeText(`[${title}](${relPath})`);
      }
      break;
    case "reveal":
      try {
        if (isTauri) {
          await invoke("reveal_in_explorer", { path: node.path });
        } else {
          alert(`Datei-Pfad: ${node.path}`);
        }
      } catch (err) {
        console.error("Reveal failed:", err);
      }
      break;

    case "copy-path":
      navigator.clipboard.writeText(node.path);
      break;
  }
  closeContextMenu();
}

watch(() => props.rootPath, loadRoot);
onMounted(loadRoot);
</script>

<template>
  <div class="h-full bg-app-bg-secondary border-r border-app-border overflow-y-auto flex flex-col">
    <div class="px-4 py-3 border-b border-app-border sticky top-0 bg-app-bg-secondary z-10 flex items-center justify-between group">
      <div class="flex items-center gap-2 select-none text-app-text">
        <img src="../assets/centaur.png" alt="ZenTauri Logo" class="h-6 w-6 object-contain opacity-85 mix-blend-multiply dark:mix-blend-screen dark:invert" />
        <span class="font-bold tracking-wide text-sm">ZenTauri</span>
      </div>
    </div>
    
    <div class="flex-1 py-2 flex flex-col gap-1">
      <!-- Big Welcome/Empty State when no workspace is open and no files are loaded -->
      <div v-if="!rootPath && (!openTabs || openTabs.length === 0)" class="px-4 py-8 flex flex-col gap-3">
        <button 
          @click="$emit('open-folder')"
          class="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors shadow-sm cursor-pointer"
        >
          Open Folder
        </button>
        <button 
          @click="$emit('open-file')"
          class="w-full py-2 px-4 bg-app-bg-secondary hover:bg-app-bg text-app-text text-sm font-medium rounded-md border border-app-border transition-colors shadow-sm cursor-pointer"
        >
          Open File
        </button>
      </div>

      <template v-else>
        <!-- Quick Filter Input Bar (Always Visible) -->
        <div class="px-2 py-1.5 border-b border-app-border/60 bg-app-bg-secondary flex items-center gap-1.5 sticky top-0 z-10">
          <div class="relative w-full flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-2 text-app-text-muted"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input 
              v-model="quickFilter"
              type="text" 
              placeholder="Filter files..." 
              class="w-full bg-app-bg text-[11px] text-app-text pl-6 pr-6 py-1 rounded border border-app-border focus:border-blue-500 focus:outline-none placeholder:text-app-text-muted/60"
            />
            <button 
              v-if="quickFilter" 
              @click="quickFilter = ''" 
              class="absolute right-1.5 text-app-text-muted hover:text-app-text text-xs"
            >✕</button>
          </div>
        </div>

        <!-- Offene Dateien Section (Shown whenever there is either a workspace open or active files open) -->
        <div v-if="openTabs && openTabs.length > 0" class="mb-1">
          <div class="px-2 py-1 text-xs font-bold text-app-text flex justify-between items-center group/section cursor-pointer select-none bg-app-bg-secondary hover:bg-app-bg transition-colors border-y border-transparent hover:border-app-border" @click="isOpenEditorsExpanded = !isOpenEditorsExpanded">
            <div class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform opacity-80" :class="{'rotate-[-90deg]': !isOpenEditorsExpanded}"><polyline points="6 9 12 15 18 9"></polyline></svg>
              <span>Open Editors</span>
            </div>
            <!-- Action Icons -->
            <div class="flex items-center gap-0.5 opacity-0 group-hover/section:opacity-100 transition-opacity" @click.stop>
              <button @click="$emit('save-all')" class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors" title="Save All">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              </button>
            </div>
          </div>
          
          <div v-show="isOpenEditorsExpanded" class="flex flex-col py-1">
            <div 
              v-for="(tab, index) in openTabs" 
              :key="tab.id"
              @click="$emit('select', tab.path)"
              class="flex items-center justify-between px-2 py-1 text-[13px] cursor-pointer hover:bg-app-bg transition-colors group/tab"
              :class="{'bg-app-bg border-l-2 border-l-blue-500': activePath === tab.path, 'border-l-2 border-l-transparent': activePath !== tab.path}"
            >
              <div class="flex items-center gap-1.5 truncate">
                <button 
                  @click.stop="$emit('close-tab', index)"
                  class="opacity-0 group-hover/tab:opacity-100 text-app-text-muted hover:text-app-text transition-all p-[2px] rounded-sm hover:bg-app-border"
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div v-if="!activePath || activePath !== tab.path" class="w-[14px] group-hover/tab:hidden"></div>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 opacity-90"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span class="truncate text-app-text" :class="{'text-blue-400': activePath === tab.path}">{{ tab.title }}</span>
                <span class="text-[11px] text-app-text-muted truncate ml-1 opacity-70">{{ getRelativeDirectory(tab.path) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Ordner Section (Only shown if rootPath is set) -->
        <div v-if="rootPath">


          <div class="px-2 py-1 text-xs font-bold text-app-text flex justify-between items-center group/section cursor-pointer select-none bg-app-bg-secondary hover:bg-app-bg transition-colors border-y border-transparent hover:border-app-border" @click="isFolderExpanded = !isFolderExpanded">
            <div class="flex items-center gap-1 truncate pr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform opacity-80" :class="{'rotate-[-90deg]': !isFolderExpanded}"><polyline points="6 9 12 15 18 9"></polyline></svg>
              <span class="truncate" :title="rootPath || ''">
                {{ rootPath ? rootPath.split(/[/\\]/).pop() : 'zentauri' }}
              </span>
            </div>
            <div class="flex items-center gap-0.5 opacity-0 group-hover/section:opacity-100 transition-opacity" @click.stop>
              <!-- Sort Mode Select -->
              <select 
                v-model="sortMode" 
                @change="loadRoot"
                class="bg-app-bg text-[10px] text-app-text border border-app-border rounded px-1 py-0.5 focus:outline-none cursor-pointer mr-0.5"
                title="Sort Order"
              >
                <option value="name-asc">A-Z</option>
                <option value="name-desc">Z-A</option>
                <option value="date-desc">Modified (Newest)</option>
                <option value="date-asc">Modified (Oldest)</option>
              </select>

              <button 
                @click.stop="triggerNewRootFile"
                class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                title="New File"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              </button>
              <button 
                @click.stop="triggerNewRootFolder"
                class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                title="New Folder"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
              </button>
              <button 
                @click.stop="revealActiveFile"
                class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                title="Reveal Active File in System Finder"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              </button>
              <button 
                @click.stop="loadRoot"
                class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                title="Refresh Explorer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              </button>
              <button 
                @click.stop="collapseAll"
                class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                title="Collapse All"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
              </button>
            </div>
          </div>

          <div v-show="isFolderExpanded" class="py-1">
            <div v-if="isLoading" class="px-6 py-2 text-xs text-app-text-muted opacity-80">
              Loading workspace...
            </div>
            <div v-else-if="loadError" class="px-4 py-3 text-xs text-red-400 text-center flex flex-col gap-2 bg-red-950/20 border border-red-900/30 rounded mx-2 my-1">
              <span>Failed to load:</span>
              <span class="opacity-80 italic break-all font-mono text-[11px]">{{ loadError }}</span>
              <button 
                @click="$emit('open-folder')"
                class="mt-1 py-1 px-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors shadow-sm cursor-pointer"
              >
                Reopen Folder
              </button>
            </div>
            <div v-else-if="computedFilteredEntries.length === 0" class="px-6 py-2 text-xs text-app-text-muted text-center">
              {{ quickFilter ? 'No matching files' : 'Empty folder' }}
            </div>
            <div v-else class="flex flex-col">
              <FileTreeNode 
                v-for="entry in computedFilteredEntries" 
                :key="entry.path"
                :node="entry"
                :depth="0"
                :active-path="activePath"
                :collapse-trigger="collapseTrigger"
                :active-create-request="activeCreateRequest"
                :active-rename-path="activeRenamePath"
                @select="$emit('select', $event)"
                @contextmenu="showContextMenu($event.node, $event.x, $event.y)"
                @create-confirm="handleRootCreateConfirm"
                @create-cancel="handleRootCreateCancel"
                @rename-confirm="handleRootRenameConfirm"
                @delete-confirm="handleRootDeleteConfirm"
                @move-confirm="handleMoveConfirm"
              />
            </div>


            <!-- Context Menu -->
            <ContextMenu 
              v-if="contextTarget"
              :target="contextTarget"
              :items="contextMenuItems"
              @action="onContextAction"
              @close="closeContextMenu"
            />
          </div>
        </div>

        <!-- No Folder Opened (Only shown if rootPath is not set, but we have files open) -->
        <div v-if="!rootPath" class="mt-4 px-3 py-2.5 border border-app-border rounded mx-2 bg-app-bg-secondary">
          <p class="text-[11px] text-app-text-muted mb-2 leading-relaxed">You have not opened a folder yet.</p>
          <button 
            @click="$emit('open-folder')"
            class="w-full py-1.5 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors shadow-sm cursor-pointer"
          >
            Open Folder
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
