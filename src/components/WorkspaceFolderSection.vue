<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
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
  folderPath: string;
  activePath?: string;
  quickFilter?: string;
}>();

const emit = defineEmits<{
  (e: "select", path: string): void;
  (e: "remove-folder", folderPath: string): void;
}>();

const rootEntries = ref<FileEntry[]>([]);
const isLoading = ref(false);
const loadError = ref<string | null>(null);
const isFolderExpanded = ref(true);
const sortMode = ref<"name-asc" | "name-desc" | "date-desc" | "date-asc">(
  "name-asc",
);
const collapseTrigger = ref(0);

const activeCreateRequest = ref<{
  parentPath: string;
  type: "file" | "directory";
} | null>(null);
const activeRenamePath = ref<string | null>(null);
const contextTarget = ref<{ node: FileEntry; x: number; y: number } | null>(
  null,
);

const isTauri =
  typeof window !== "undefined" &&
  (window as any).__TAURI_INTERNALS__ !== undefined;

const folderName = computed(() => {
  if (!props.folderPath) return "FOLDER";
  const normalized = props.folderPath.replace(/\\/g, "/");
  const name = normalized.split("/").filter(Boolean).pop() || props.folderPath;
  return name.toUpperCase();
});

const computedFilteredEntries = computed(() => {
  if (!props.quickFilter || !props.quickFilter.trim()) return rootEntries.value;
  const q = props.quickFilter.toLowerCase().trim();
  return rootEntries.value.filter((e) => e.name.toLowerCase().includes(q));
});

const loadRoot = async () => {
  if (!props.folderPath) {
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
        path: props.folderPath,
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
      console.error("Failed to load workspace folder via Rust IPC:", e);
    }
  }

  // Browser Mode Fallback
  try {
    const entries = await readDir(props.folderPath);
    rootEntries.value = entries
      .map((e) => ({
        name: e.name || "unknown",
        path: `${props.folderPath}/${e.name}`,
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
    rootEntries.value = [
      {
        name: "01_Notes.md",
        path: `${props.folderPath}/01_Notes.md`,
        isDirectory: false,
      },
    ];
    loadError.value = null;
  } finally {
    isLoading.value = false;
  }
};

function triggerNewRootFile() {
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

async function revealFolderInExplorer() {
  if (isTauri) {
    try {
      await invoke("reveal_in_explorer", { path: props.folderPath });
    } catch (err) {
      console.error("Failed to reveal folder:", err);
    }
  } else {
    alert(`Folder path: ${props.folderPath}`);
  }
}

function collapseAll() {
  collapseTrigger.value++;
}

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
    alert(`Failed to move item: ${err}`);
  }
}

async function handleRootCreateConfirm(payload: {
  parentPath: string;
  name: string;
  type: "file" | "directory";
}) {
  const parent = payload.parentPath || props.folderPath || "";
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

function showContextMenu(node: FileEntry, x: number, y: number) {
  contextTarget.value = { node, x, y };
}

function closeContextMenu() {
  contextTarget.value = null;
}

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
      activeCreateRequest.value = {
        parentPath: node.isDirectory ? node.path : parentPath,
        type: "file",
      };
      break;
    case "new-folder":
      activeCreateRequest.value = {
        parentPath: node.isDirectory ? node.path : parentPath,
        type: "directory",
      };
      break;
    case "duplicate":
      try {
        if (isTauri) {
          await invoke("duplicate_file_item", { sourcePath: node.path });
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
      if (confirm(`Delete "${node.name}"?`)) {
        handleRootDeleteConfirm({ path: node.path });
      }
      break;
    case "reveal":
      try {
        if (isTauri) {
          await invoke("reveal_in_explorer", { path: node.path });
        }
      } catch (err) {}
      break;
    case "copy-path":
      navigator.clipboard.writeText(node.path);
      break;
  }
  closeContextMenu();
}

watch(() => props.folderPath, loadRoot);
onMounted(loadRoot);

defineExpose({ triggerNewRootFile, triggerNewRootFolder, loadRoot });
</script>

<template>
  <div class="mb-1">
    <!-- Folder Querbalken (Section Header) -->
    <div 
      class="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-app-text-muted flex justify-between items-center group/section cursor-pointer select-none bg-app-bg-secondary hover:bg-app-bg transition-colors border-y border-app-border" 
      @click="isFolderExpanded = !isFolderExpanded"
      :title="`Workspace: ${folderPath}`"
    >
      <div class="flex items-center gap-1.5 truncate pr-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transition-transform opacity-80" :class="{'rotate-[-90deg]': !isFolderExpanded}">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400 fill-amber-400/20 shrink-0">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="truncate font-bold tracking-wider text-xs text-app-text">
          {{ folderName }}
        </span>
      </div>

      <!-- Action Icons on Hover -->
      <div class="flex items-center gap-0.5 opacity-0 group-hover/section:opacity-100 transition-opacity" @click.stop>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
        </button>
        <button 
          @click.stop="triggerNewRootFolder"
          class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
          title="New Folder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
        </button>
        <button 
          @click.stop="revealFolderInExplorer"
          class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
          title="Reveal Folder in System Finder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
        </button>
        <button 
          @click.stop="loadRoot"
          class="p-1 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
          title="Refresh Folder"
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
        <button 
          @click.stop="$emit('remove-folder', folderPath)"
          class="p-1 hover:bg-red-500/20 rounded-md text-app-text-muted hover:text-red-400 transition-colors ml-0.5"
          title="Remove Folder from Workspace"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>

    <!-- Tree Content -->
    <div v-show="isFolderExpanded" class="py-1">
      <div v-if="isLoading" class="px-6 py-2 text-xs text-app-text-muted opacity-80">
        Loading workspace folder...
      </div>
      <div v-else-if="loadError" class="px-4 py-2 text-xs text-red-400 italic">
        Failed to load folder
      </div>
      <div v-else-if="computedFilteredEntries.length === 0" class="px-6 py-2 text-xs text-app-text-muted text-center italic opacity-70">
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
</template>
