<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

interface MenuItem {
  label?: string
  action?: string
  disabled?: boolean
  divider?: boolean
}

interface ContextTarget {
  node: { name: string; path: string; isDirectory: boolean }
  x: number
  y: number
}

const props = defineProps<{
  target: ContextTarget | null
  items: MenuItem[]
  onAction: (action: string) => void
  onClose: () => void
}>()

const menuRef = ref<HTMLDivElement>()

function handleClick(action: string) {
  props.onAction(action)
  props.onClose()
}

function handleContextMenu(e: Event) {
  e.preventDefault()
  e.stopPropagation()
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    props.onClose()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
  document.addEventListener('contextmenu', handleClickOutside, true)
  positionMenu()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
  document.removeEventListener('contextmenu', handleClickOutside, true)
})

watch(() => props.target, () => {
  nextTick(() => {
    positionMenu()
  })
}, { immediate: true })

function positionMenu() {
  if (!menuRef.value || !props.target) return
  
  const rect = menuRef.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  
  let x = props.target.x
  let y = props.target.y
  
  if (x + rect.width > vw) {
    x = Math.max(0, vw - rect.width)
  }
  if (y + rect.height > vh) {
    y = Math.max(0, vh - rect.height)
  }
  
  menuRef.value.style.left = `${x}px`
  menuRef.value.style.top = `${y}px`
}
</script>

<template>
  <div
    ref="menuRef"
    class="fixed z-[1000] bg-app-bg-secondary border border-app-border rounded-md shadow-lg min-w-[180px] py-1"
  >
    <template v-for="(item, index) in items" :key="index">
      <hr v-if="item.divider" class="my-1 border-app-border" />
      <button
        v-else
        @click="handleClick(item.action!)"
        :disabled="item.disabled"
        class="w-full px-3 py-1.5 text-left text-sm text-app-text hover:bg-app-bg transition-colors flex items-center gap-2"
        :class="{ 'opacity-50 cursor-not-allowed': item.disabled }"
      >
        <span>{{ item.label }}</span>
      </button>
    </template>
  </div>
</template>