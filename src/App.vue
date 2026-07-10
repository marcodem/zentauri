<script setup lang="ts">
import { ref, watch, onMounted, computed, nextTick, onBeforeUnmount } from 'vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
import Cheatsheet from './components/Cheatsheet.vue'
import FileTree from './components/FileTree.vue'
import Settings from './components/Settings.vue'
import HelpSystem from './components/HelpSystem.vue'
import SearchPanel from './components/SearchPanel.vue'
import ActivityBar from './components/ActivityBar.vue'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs'
import debounce from 'lodash.debounce'
import { listen } from '@tauri-apps/api/event'

interface Tab {
  id: string
  path: string
  title: string
  content: string
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
`

const tabs = ref<Tab[]>([])
const activeTabIndex = ref(-1)

const markdownSource = ref('')
const editorRef = ref<InstanceType<typeof Editor> | null>(null)
const fileTreeRef = ref<InstanceType<typeof FileTree> | null>(null)

const workspaceRoot = ref<string | null>(null)
const showPreview = ref(true)
const showCheatsheet = ref(false)
const showSearch = ref(false)
const showExplorer = ref(true)
const showSettings = ref(false)
const showHelpSystem = ref(false)
const vimMode = ref(false)
const isSaving = ref(false)
const autoSaveEnabled = ref(true)

const activeActivityView = computed(() => {
  if (showSettings.value) return 'settings'
  if (showCheatsheet.value) return 'cheatsheet'
  if (showSearch.value) return 'search'
  if (showExplorer.value) return 'explorer'
  return null
})

function handleActivityToggle(view: string) {
  if (view === 'explorer') {
    showExplorer.value = !showExplorer.value
    showSettings.value = false
    showCheatsheet.value = false
    showSearch.value = false
  } else if (view === 'settings') {
    showSettings.value = !showSettings.value
    showExplorer.value = false
    showCheatsheet.value = false
    showSearch.value = false
  } else if (view === 'cheatsheet') {
    showCheatsheet.value = !showCheatsheet.value
    showExplorer.value = false
    showSettings.value = false
    showSearch.value = false
  } else if (view === 'search') {
    showSearch.value = !showSearch.value
    showExplorer.value = false
    showSettings.value = false
    showCheatsheet.value = false
  } else if (view === 'help') {
    showHelpSystem.value = !showHelpSystem.value
    showCheatsheet.value = false
    showSettings.value = false
    showSearch.value = false
  }
}

function handleActivityAction(action: string) {
  if (action === 'print') {
    handlePrint()
  }
}

// Memory
onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  const savedWorkspace = localStorage.getItem('zentauri-workspace')
  if (savedWorkspace) workspaceRoot.value = savedWorkspace
  
  const savedTabsStr = localStorage.getItem('zentauri-tabs')
  if (savedTabsStr) {
    try {
      const savedData = JSON.parse(savedTabsStr)
      if (savedData.tabs && savedData.tabs.length > 0) {
        tabs.value = savedData.tabs
        activeTabIndex.value = savedData.activeIndex
        markdownSource.value = tabs.value[activeTabIndex.value]?.content || ''
      }
    } catch(e) {}
  } else {
    // Default tab if none
    openTab('Untitled Document', 'untitled://1', defaultContent)
  }

  const settingsStr = localStorage.getItem('zentauri-settings')
  if (settingsStr) {
    try {
      const s = JSON.parse(settingsStr)
      if (s.autoSave !== undefined) autoSaveEnabled.value = s.autoSave
    } catch(e) {}
  }

  listen<string>('menu-event', (event) => {
    switch (event.payload) {
      case 'new_file': handleNewFile(); break;
      case 'new_folder': handleNewFolder(); break;
      case 'open_file': handleOpenFile(); break;
      case 'open_folder': handleOpenFolder(); break;
      case 'save': forceSave(); break;
      case 'save_as': handleSaveAs(); break;
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    forceSave()
  }
}

const saveTabsState = () => {
  localStorage.setItem('zentauri-tabs', JSON.stringify({
    tabs: tabs.value,
    activeIndex: activeTabIndex.value
  }))
}

// Auto-Save
const autoSave = debounce(async () => {
  if (!autoSaveEnabled.value) {
    saveTabsState() // just save to memory
    return
  }
  await forceSave()
}, 1000)

async function forceSave() {
  const tab = tabs.value[activeTabIndex.value]
  if (tab && tab.path && !tab.path.startsWith('untitled://')) {
    isSaving.value = true
    try {
      await writeTextFile(tab.path, tab.content)
      saveTabsState()
    } catch (err) {
      console.error('Auto-save failed', err)
    } finally {
      setTimeout(() => { isSaving.value = false }, 500)
    }
  } else {
    // If untitled, do Save As
    await handleSaveAs()
  }
}

async function handleSaveAll() {
  isSaving.value = true
  try {
    for (const tab of tabs.value) {
      if (tab.path && !tab.path.startsWith('untitled://')) {
        await writeTextFile(tab.path, tab.content)
      }
    }
    saveTabsState()
  } catch (err) {
    console.error('Save all failed', err)
  } finally {
    setTimeout(() => { isSaving.value = false }, 500)
  }
}

async function handleSaveAs() {
  const tab = tabs.value[activeTabIndex.value]
  if (!tab) return

  const newPath = await save({
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (newPath) {
    isSaving.value = true
    try {
      await writeTextFile(newPath, tab.content)
      tab.path = newPath
      tab.title = newPath.split(/[/\\]/).pop() || 'Unknown'
      saveTabsState()
    } catch (err) {
      console.error('Save As failed', err)
      alert(`Fehler beim Speichern: ${err}`)
    } finally {
      setTimeout(() => { isSaving.value = false }, 500)
    }
  }
}

watch(markdownSource, (newVal) => {
  const tab = tabs.value[activeTabIndex.value]
  if (tab && tab.content !== newVal) {
    tab.content = newVal
    autoSave()
  }
})

// Tab Management
function focusEditor() {
  // Use setTimeout to ensure CodeMirror has completed its view.dispatch and DOM updates
  setTimeout(() => {
    // 1. Vue ref method (calls view.focus() on CodeMirror)
    if (editorRef.value && typeof editorRef.value.focus === 'function') {
      editorRef.value.focus()
      return
    }
    
    // 2. Fallback: Direct DOM focus
    const cmContent = document.querySelector('.cm-content') as HTMLElement
    if (cmContent) {
      cmContent.focus()
    }
  }, 50)
}

function openTab(title: string, path: string, content: string) {
  const existingIndex = tabs.value.findIndex(t => t.path === path)
  if (existingIndex >= 0) {
    activeTabIndex.value = existingIndex
    markdownSource.value = tabs.value[existingIndex].content
  } else {
    tabs.value.push({
      id: Date.now().toString(),
      path,
      title,
      content
    })
    activeTabIndex.value = tabs.value.length - 1
    markdownSource.value = content
  }
  saveTabsState()
  focusEditor()
}

function closeTab(index: number, event?: Event) {
  if (event) event.stopPropagation()
  tabs.value.splice(index, 1)
  if (tabs.value.length === 0) {
    openTab('Untitled Document', `untitled://${Date.now()}`, '')
  } else if (activeTabIndex.value >= tabs.value.length) {
    activeTabIndex.value = tabs.value.length - 1
    markdownSource.value = tabs.value[activeTabIndex.value].content
  } else if (activeTabIndex.value === index) {
    markdownSource.value = tabs.value[activeTabIndex.value].content
  }
  saveTabsState()
  focusEditor()
}

function selectTab(index: number) {
  activeTabIndex.value = index
  markdownSource.value = tabs.value[index].content
  saveTabsState()
  focusEditor()
}

async function handleOpenFile() {
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  
  if (selected && typeof selected === 'string') {
    await loadFile(selected)
  }
}

async function handleOpenFolder() {
  const selected = await open({
    directory: true,
    multiple: false
  })
  
  if (selected && typeof selected === 'string') {
    workspaceRoot.value = selected
    showExplorer.value = true
    localStorage.setItem('zentauri-workspace', selected)
  }
}

async function loadFile(path: string) {
  const existingIndex = tabs.value.findIndex(t => t.path === path || t.id === path)
  if (existingIndex >= 0) {
    selectTab(existingIndex)
    return
  }

  if (path.startsWith('untitled://')) {
    return
  }

  try {
    const text = await readTextFile(path)
    const title = path.split(/[/\\]/).pop() || 'Unknown'
    openTab(title, path, text)
    focusEditor()
  } catch (err) {
    console.error('Failed to load file', err)
  }
}

async function handleNewFile() {
  if (!workspaceRoot.value) return
  const name = prompt('Dateiname (z.B. neue_datei.md):', 'neue_datei.md')
  if (!name) return
  try {
    await writeTextFile(`${workspaceRoot.value}/${name}`, '# Neuer Titel\n\n')
    if (fileTreeRef.value) await fileTreeRef.value.loadRoot()
  } catch (err) {
    alert(`Fehler beim Erstellen der Datei: ${err}`)
  }
}

async function handleNewFolder() {
  if (!workspaceRoot.value) return
  const name = prompt('Ordnername:', 'neuer_ordner')
  if (!name) return
  try {
    await mkdir(`${workspaceRoot.value}/${name}`)
    if (fileTreeRef.value) await fileTreeRef.value.loadRoot()
  } catch (err) {
    alert(`Fehler beim Erstellen des Ordners: ${err}`)
  }
}

function handleSettingsUpdate(settings: any) {
  if (settings.autoSave !== undefined) autoSaveEnabled.value = settings.autoSave
  if (settings.vimMode !== undefined) vimMode.value = settings.vimMode
  if (settings.showCheatsheet !== undefined) showCheatsheet.value = settings.showCheatsheet
}

function handleSettingsClose() {
  showSettings.value = false
}

function handleInsertFromCheatsheet(text: string) {
  if (editorRef.value) {
    editorRef.value.insertText(text + '\n')
  }
}

function handleJumpToLine(lineNum: number) {
  if (editorRef.value) {
    editorRef.value.jumpToLine(lineNum)
  }
}

function handlePrint() {
  window.print()
}
</script>

<template>
  <main class="flex flex-col h-screen w-screen overflow-hidden bg-app-bg text-app-text print:h-auto print:w-auto print:overflow-visible print:bg-white print:text-black">
    <Settings class="print:hidden" :isOpen="showSettings" @close="handleSettingsClose" @update="handleSettingsUpdate" />
    <HelpSystem class="print:hidden" :isOpen="showHelpSystem" @close="showHelpSystem = false" />
    
    <!-- Toolbar -->
    <header class="flex-none flex items-center px-4 py-2 border-b border-app-border bg-app-bg-secondary select-none print:hidden" data-tauri-drag-region>
      <!-- Auto-Save Status -->
      <div class="flex-1 text-center text-sm font-medium text-app-text-muted absolute left-0 right-0 pointer-events-none flex items-center justify-center gap-2">
        <span v-if="isSaving" class="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        <span v-else class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        {{ isSaving ? 'Saving...' : 'Saved' }}
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
      <div v-show="showExplorer" class="w-64 flex-none border-r border-app-border print:hidden">
        <FileTree 
          ref="fileTreeRef"
          :rootPath="workspaceRoot" 
          :activePath="tabs[activeTabIndex]?.path" 
          :openTabs="tabs"
          @select="loadFile" 
          @open-folder="handleOpenFolder"
          @open-file="handleOpenFile"
          @close-tab="closeTab"
          @save-all="handleSaveAll"
        />
      </div>

      <!-- Cheatsheet Sidebar -->
      <div v-show="showCheatsheet" class="flex-none print:hidden h-full">
        <Cheatsheet @insert="handleInsertFromCheatsheet" class="h-full" />
      </div>

      <!-- Search Sidebar -->
      <div v-show="showSearch" class="flex-none print:hidden h-full">
        <SearchPanel 
          :fileContent="tabs[activeTabIndex]?.content || ''" 
          @jump-to-line="handleJumpToLine" 
          class="h-full" 
        />
      </div>

      <!-- Main Editor Area -->
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
        
        <!-- Editor/Preview Split -->
        <div class="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
          <!-- Editor Pane -->
          <div class="flex-1 h-full border-r border-app-border min-w-0 print:hidden">
            <Editor ref="editorRef" v-model="markdownSource" :vimMode="vimMode" />
          </div>
          
          <!-- Preview Pane -->
          <div v-show="showPreview" class="flex-1 h-full bg-app-bg min-w-0 print:!block print:w-full print:h-auto print:overflow-visible print:bg-white">
            <Preview :source="markdownSource" />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>