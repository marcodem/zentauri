<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { readDir, mkdir, writeTextFile, rename, remove } from '@tauri-apps/plugin-fs'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isNew?: boolean
  newType?: 'file' | 'directory'
}

const props = defineProps<{
  node: FileEntry
  depth: number
  activePath?: string
  collapseTrigger?: number
  activeCreateRequest?: { parentPath: string; type: 'file' | 'directory' } | null
  activeRenamePath?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'contextmenu', payload: { node: FileEntry; x: number; y: number }): void
  (e: 'create-confirm', payload: { parentPath: string, name: string, type: 'file' | 'directory' }): void
  (e: 'create-cancel'): void
  (e: 'rename-confirm', payload: { path: string, newName: string }): void
  (e: 'delete-confirm', payload: { path: string }): void
}>()

const isOpen = ref(false)
const children = ref<FileEntry[]>([])
const isLoading = ref(false)
const nodeRef = ref<HTMLElement>()

const isEditing = ref(false)
const editName = ref('')
const inputRef = ref<HTMLInputElement>()

const isMarkdown = computed(() => {
  return props.node.name.toLowerCase().endsWith('.md') || props.node.name.toLowerCase().endsWith('.markdown')
})

const fileIconType = computed(() => {
  if (props.node.isNew) {
    return props.node.newType === 'directory' ? 'directory' : 'markdown'
  }
  if (props.node.isDirectory) return 'directory'
  const name = props.node.name.toLowerCase()
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown'
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif') || name.endsWith('.webp')) return 'image'
  if (name.endsWith('.json') || name.endsWith('.toml') || name.endsWith('.yaml') || name.endsWith('.yml')) return 'config'
  return 'default'
})

const ensureOpen = async () => {
  if (!props.node.isDirectory) return
  if (isOpen.value) return
  
  isOpen.value = true
  
  if (children.value.length === 0) {
    isLoading.value = true
    try {
      const entries = await readDir(props.node.path)
      children.value = entries
        .map(e => ({
          name: e.name || 'unknown',
          path: `${props.node.path}/${e.name}`,
          isDirectory: e.isDirectory
        }))
        .filter(e => e.isDirectory || e.name.toLowerCase().endsWith('.md') || e.name.toLowerCase().endsWith('.markdown'))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
    } catch (e) {
      console.error('Failed to read dir', e)
    } finally {
      isLoading.value = false
    }
  }
}

const toggleDir = async () => {
  if (isOpen.value) {
    isOpen.value = false
  } else {
    await ensureOpen()
  }
}

const onClick = () => {
  if (isEditing.value || props.node.isNew) return
  if (props.node.isDirectory) {
    toggleDir()
  } else {
    emit('select', props.node.path)
  }
}

const onContextMenu = (e: MouseEvent) => {
  if (isEditing.value || props.node.isNew) return
  e.preventDefault()
  e.stopPropagation()
  emit('contextmenu', { node: props.node, x: e.clientX, y: e.clientY })
}

const onKeyDown = (e: KeyboardEvent) => {
  if (isEditing.value || props.node.isNew) return
  if (e.key === 'ArrowRight' && props.node.isDirectory && !isOpen.value) {
    toggleDir()
  } else if (e.key === 'ArrowLeft' && props.node.isDirectory && isOpen.value) {
    isOpen.value = false
  } else if (e.key === 'Enter' && !props.node.isDirectory) {
    emit('select', props.node.path)
  }
}

// Watchers
watch(() => props.collapseTrigger, () => {
  if (props.node.isDirectory) {
    isOpen.value = false
  }
})

watch(() => props.activeRenamePath, (newVal) => {
  if (newVal === props.node.path) {
    isEditing.value = true
    editName.value = props.node.name
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus()
        const dotIndex = props.node.name.lastIndexOf('.')
        if (dotIndex > 0 && !props.node.isDirectory) {
          inputRef.value.setSelectionRange(0, dotIndex)
        } else {
          inputRef.value.select()
        }
      }
    })
  } else {
    isEditing.value = false
  }
})

watch(() => props.activeCreateRequest, (newVal) => {
  if (newVal && newVal.parentPath === props.node.path) {
    ensureOpen().then(() => {
      if (!children.value.some(c => c.isNew)) {
        children.value.unshift({
          name: '',
          path: props.node.path, // parent path
          isDirectory: newVal.type === 'directory',
          isNew: true,
          newType: newVal.type
        })
      }
    })
  }
})

watch(() => props.activePath, (newVal) => {
  if (newVal && props.node.isDirectory) {
    const normalizedNode = props.node.path.replace(/\\/g, '/')
    const normalizedActive = newVal.replace(/\\/g, '/')
    if (normalizedActive.startsWith(normalizedNode + '/')) {
      ensureOpen()
    }
  }
  
  if (newVal === props.node.path) {
    nextTick(() => {
      nodeRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      nodeRef.value?.focus()
    })
  }
}, { immediate: true })

onMounted(() => {
  if (props.node.isNew) {
    editName.value = props.node.newType === 'file' ? 'new_file.md' : 'new_folder'
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus()
        if (props.node.newType === 'file') {
          inputRef.value.setSelectionRange(0, 8) // "new_file" length
        } else {
          inputRef.value.select()
        }
      }
    })
  }
})

async function submitEdit() {
  const trimmed = editName.value.trim()
  if (!trimmed) {
    cancelEdit()
    return
  }
  
  if (props.node.isNew) {
    emit('create-confirm', {
      parentPath: props.node.path,
      name: trimmed,
      type: props.node.newType!
    })
  } else {
    if (trimmed !== props.node.name) {
      emit('rename-confirm', {
        path: props.node.path,
        newName: trimmed
      })
    } else {
      isEditing.value = false
    }
  }
}

function cancelEdit() {
  if (props.node.isNew) {
    emit('create-cancel')
  } else {
    isEditing.value = false
  }
}

// Child node handlers
async function handleChildCreateConfirm(payload: { parentPath: string, name: string, type: 'file' | 'directory' }) {
  const fullPath = `${payload.parentPath}/${payload.name}`
  try {
    if (payload.type === 'file') {
      await writeTextFile(fullPath, '# ' + payload.name.replace(/\.md$/, '') + '\n\n')
      emit('select', fullPath)
    } else {
      await mkdir(fullPath)
    }
    await refresh()
  } catch (err) {
    alert(`Fehler beim Erstellen: ${err}`)
  }
}

function handleChildCreateCancel() {
  children.value = children.value.filter(c => !c.isNew)
}

async function handleChildRenameConfirm(payload: { path: string, newName: string }) {
  const parentDir = payload.path.substring(0, payload.path.lastIndexOf('/'))
  const newPath = `${parentDir}/${payload.newName}`
  try {
    await rename(payload.path, newPath)
    await refresh()
  } catch (err) {
    alert(`Fehler beim Umbenennen: ${err}`)
  }
}

async function handleChildDeleteConfirm(payload: { path: string }) {
  try {
    await remove(payload.path)
    await refresh()
  } catch (err) {
    alert(`Fehler beim Löschen: ${err}`)
  }
}

async function refresh() {
  if (!props.node.isDirectory) return
  try {
    const entries = await readDir(props.node.path)
    children.value = entries
      .map(e => ({
        name: e.name || 'unknown',
        path: `${props.node.path}/${e.name}`,
        isDirectory: e.isDirectory
      }))
      .filter(e => e.isDirectory || e.name.toLowerCase().endsWith('.md') || e.name.toLowerCase().endsWith('.markdown'))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
  } catch (e) {
    console.error('Failed to read dir', e)
  }
}
</script>

<template>
  <div ref="nodeRef" @contextmenu="onContextMenu" @keydown="onKeyDown" tabindex="0" class="outline-none">
    <div 
      class="flex items-center py-1.5 px-2 cursor-pointer hover:bg-app-bg-hover transition-colors rounded-md mx-1 my-0.5"
      :class="{ 'bg-app-bg-active text-blue-500 font-medium': activePath === node.path }"
      :style="{ paddingLeft: (depth * 1 + 0.25) + 'rem' }"
      @click="onClick"
    >
      <!-- Icon -->
      <span class="mr-2 flex items-center justify-center shrink-0" :class="{ 'text-app-text-muted opacity-70': activePath !== node.path }">
        <template v-if="node.isDirectory">
          <!-- Chevron -->
          <svg 
            class="w-3 h-3 transition-transform duration-200 mr-1.5"
            :class="{ 'rotate-90': isOpen }"
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <!-- Folder Icon -->
          <svg v-if="isOpen" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>
            <path d="M2 10h20"></path>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </template>
        <template v-else>
          <div class="w-[18px] mr-1.5 inline-block"></div>
          <!-- Markdown Icon -->
          <svg v-if="fileIconType === 'markdown'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
          <!-- PDF Icon -->
          <svg v-else-if="fileIconType === 'pdf'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
            <path d="M14 2v4a1 1 0 0 0 1 1h4"/>
            <path d="M9 13v-3h2.5a1.5 1.5 0 0 1 0 3H9Z"/>
            <path d="m13 10 3 3"/>
          </svg>
          <!-- Image Icon -->
          <svg v-else-if="fileIconType === 'image'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
          <!-- Config Icon -->
          <svg v-else-if="fileIconType === 'config'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <!-- Default Document Icon -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </template>
      </span>
      
      <!-- Label or Input -->
      <input 
        v-if="isEditing || node.isNew"
        ref="inputRef"
        v-model="editName"
        @keydown.enter="submitEdit"
        @keydown.esc="cancelEdit"
        @blur="submitEdit"
        @click.stop
        class="text-sm px-1 py-0.5 bg-app-bg border border-blue-500 rounded text-app-text focus:outline-none w-full"
      />
      <span v-else class="text-sm truncate select-none text-app-text" :class="{ 'text-app-text-muted': !isMarkdown && !node.isDirectory }">
        {{ node.name }}
      </span>
    </div>
    
    <!-- Children -->
    <div v-if="node.isDirectory && isOpen">
      <div v-if="isLoading" class="text-xs text-app-text-muted py-1 opacity-80" :style="{ paddingLeft: ((depth + 1) * 1 + 0.5) + 'rem' }">
        Lade...
      </div>
      <FileTreeNode 
        v-for="child in children" 
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :active-path="activePath"
        :collapse-trigger="collapseTrigger"
        :active-create-request="activeCreateRequest"
        :active-rename-path="activeRenamePath"
        @select="$emit('select', $event)"
        @contextmenu="$emit('contextmenu', $event)"
        @create-confirm="handleChildCreateConfirm"
        @create-cancel="handleChildCreateCancel"
        @rename-confirm="$emit('rename-confirm', $event)"
        @delete-confirm="$emit('delete-confirm', $event)"
      />
    </div>
  </div>
</template>