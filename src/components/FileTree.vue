<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { readDir, mkdir, writeTextFile, rename, remove } from '@tauri-apps/plugin-fs'
import FileTreeNode, { type FileEntry } from './FileTreeNode.vue'
import ContextMenu from './ContextMenu.vue'

const props = defineProps<{
  rootPath: string | null
  activePath?: string
  openTabs?: { id: string, path: string, title: string, content: string }[]
}>()

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'open-folder'): void
  (e: 'open-file'): void
  (e: 'print'): void
  (e: 'open-settings'): void
  (e: 'toggle-help'): void
  (e: 'toggle-cheatsheet'): void
  (e: 'close-tab', index: number): void
  (e: 'new-file'): void
  (e: 'new-folder'): void
  (e: 'save-all'): void
}>()

const rootEntries = ref<FileEntry[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

const isOpenEditorsExpanded = ref(true)
const isFolderExpanded = ref(true)

const loadRoot = async () => {
  if (!props.rootPath) {
    rootEntries.value = []
    loadError.value = null
    return
  }
  
  isLoading.value = true
  loadError.value = null
  try {
    const entries = await readDir(props.rootPath)
    rootEntries.value = entries
      .map(e => ({
        name: e.name || 'unknown',
        path: `${props.rootPath}/${e.name}`,
        isDirectory: e.isDirectory
      }))
      .filter(e => e.isDirectory || e.name.toLowerCase().endsWith('.md') || e.name.toLowerCase().endsWith('.markdown'))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
  } catch (e) {
    console.error('Failed to load workspace root', e)
    loadError.value = String(e)
    rootEntries.value = []
  } finally {
    isLoading.value = false
  }
}

const getRelativeDirectory = (path: string) => {
  if (!props.rootPath) return ''
  // Normalize slashes just in case
  const normalizedRoot = props.rootPath.replace(/\\/g, '/')
  const normalizedPath = path.replace(/\\/g, '/')
  
  if (normalizedPath.startsWith(normalizedRoot)) {
    const rel = normalizedPath.slice(normalizedRoot.length + 1)
    const parts = rel.split('/')
    parts.pop() // remove filename
    return parts.join('/')
  }
  return ''
}

defineExpose({ loadRoot })

// Context menu state
const contextTarget = ref<{ node: FileEntry; x: number; y: number } | null>(null)
const collapseTrigger = ref(0)
const activeCreateRequest = ref<{ parentPath: string; type: 'file' | 'directory' } | null>(null)
const activeRenamePath = ref<string | null>(null)

function showContextMenu(node: FileEntry, x: number, y: number) {
  contextTarget.value = { node, x, y }
}

function closeContextMenu() {
  contextTarget.value = null
}

function collapseAll() {
  collapseTrigger.value++
}

function triggerNewRootFile() {
  if (!props.rootPath) return
  if (rootEntries.value.some(e => e.isNew)) return
  rootEntries.value.unshift({
    name: '',
    path: '',
    isDirectory: false,
    isNew: true,
    newType: 'file'
  })
  isFolderExpanded.value = true
}

function triggerNewRootFolder() {
  if (!props.rootPath) return
  if (rootEntries.value.some(e => e.isNew)) return
  rootEntries.value.unshift({
    name: '',
    path: '',
    isDirectory: true,
    isNew: true,
    newType: 'directory'
  })
  isFolderExpanded.value = true
}

async function handleRootCreateConfirm(payload: { parentPath: string, name: string, type: 'file' | 'directory' }) {
  const parent = payload.parentPath || props.rootPath || ''
  const fullPath = `${parent}/${payload.name}`
  try {
    if (payload.type === 'file') {
      await writeTextFile(fullPath, '# ' + payload.name.replace(/\.md$/, '') + '\n\n')
      emit('select', fullPath)
    } else {
      await mkdir(fullPath)
    }
    await loadRoot()
    activeCreateRequest.value = null
  } catch (err) {
    alert(`Fehler beim Erstellen: ${err}`)
  }
}

function handleRootCreateCancel() {
  rootEntries.value = rootEntries.value.filter(e => !e.isNew)
  activeCreateRequest.value = null
}

async function handleRootRenameConfirm(payload: { path: string, newName: string }) {
  const parentDir = payload.path.substring(0, payload.path.lastIndexOf('/'))
  const newPath = `${parentDir}/${payload.newName}`
  try {
    await rename(payload.path, newPath)
    activeRenamePath.value = null
    await loadRoot()
  } catch (err) {
    alert(`Fehler beim Umbenennen: ${err}`)
  }
}

async function handleRootDeleteConfirm(payload: { path: string }) {
  try {
    await remove(payload.path)
    await loadRoot()
  } catch (err) {
    alert(`Fehler beim Löschen: ${err}`)
  }
}

// Context menu items
const contextMenuItems = computed(() => {
  if (!contextTarget.value) return []
  
  return [
    { label: 'Neue Datei', action: 'new-file' },
    { label: 'Neuer Ordner', action: 'new-folder' },
    { divider: true },
    { label: 'Umbenennen', action: 'rename' },
    { label: 'Löschen', action: 'delete' },
    { divider: true },
    { label: 'Pfad kopieren', action: 'copy-path' },
  ]
})

function onContextAction(action: string) {
  if (!contextTarget.value) return
  
  const node = contextTarget.value.node
  const parentPath = node.path.substring(0, node.path.lastIndexOf('/'))
  
  switch (action) {
    case 'new-file':
      if (node.isDirectory) {
        activeCreateRequest.value = { parentPath: node.path, type: 'file' }
      } else {
        activeCreateRequest.value = { parentPath, type: 'file' }
      }
      break
    case 'new-folder':
      if (node.isDirectory) {
        activeCreateRequest.value = { parentPath: node.path, type: 'directory' }
      } else {
        activeCreateRequest.value = { parentPath, type: 'directory' }
      }
      break
    case 'rename':
      activeRenamePath.value = node.path
      break
    case 'delete':
      if (confirm(`"${node.name}" wirklich löschen?`)) {
        handleRootDeleteConfirm({ path: node.path })
      }
      break
    case 'copy-path':
      navigator.clipboard.writeText(node.path)
      break
  }
  closeContextMenu()
}

watch(() => props.rootPath, loadRoot)
onMounted(loadRoot)
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
          Ordner öffnen
        </button>
        <button 
          @click="$emit('open-file')"
          class="w-full py-2 px-4 bg-app-bg-secondary hover:bg-app-bg text-app-text text-sm font-medium rounded-md border border-app-border transition-colors shadow-sm cursor-pointer"
        >
          Datei öffnen
        </button>
      </div>

      <template v-else>
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
                  title="Schließen"
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
              Lade Arbeitsbereich...
            </div>
            <div v-else-if="loadError" class="px-4 py-3 text-xs text-red-400 text-center flex flex-col gap-2 bg-red-950/20 border border-red-900/30 rounded mx-2 my-1">
              <span>Fehler beim Laden:</span>
              <span class="opacity-80 italic break-all font-mono text-[11px]">{{ loadError }}</span>
              <button 
                @click="$emit('open-folder')"
                class="mt-1 py-1 px-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors shadow-sm cursor-pointer"
              >
                Ordner erneut öffnen
              </button>
            </div>
            <div v-else-if="rootEntries.length === 0" class="px-6 py-2 text-xs text-app-text-muted text-center">
              Leerer Ordner
            </div>
            <div v-else class="flex flex-col">
              <FileTreeNode 
                v-for="entry in rootEntries" 
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
          <p class="text-[11px] text-app-text-muted mb-2 leading-relaxed">Sie haben noch keinen Ordner geöffnet.</p>
          <button 
            @click="$emit('open-folder')"
            class="w-full py-1.5 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors shadow-sm cursor-pointer"
          >
            Ordner öffnen
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
