<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import { renderMarkdown } from "../lib/markdown";
import mermaid from "mermaid";

const props = defineProps<{ source: string }>();

const container = ref<HTMLElement>();
const html = ref("");

// Initialize Mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains("dark")
    ? "dark"
    : "default",
  securityLevel: "loose",
});

async function updatePreview() {
  html.value = renderMarkdown(props.source);

  await nextTick();
  try {
    const isDark = document.documentElement.classList.contains("dark");
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
    });
    await mermaid.run({
      querySelector: ".mermaid",
    });
  } catch (e) {
    console.error("Mermaid render failed:", e);
  }
}

const emit = defineEmits<{
  (e: "open-url", url: string): void;
}>();

function handleContainerClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const anchor = target.closest("a") as HTMLAnchorElement | null;
  if (anchor) {
    const href = anchor.getAttribute("href");
    if (href) {
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("//") ||
        href.startsWith("www.")
      ) {
        event.preventDefault();
        event.stopPropagation();
        const fullUrl = href.startsWith("www.")
          ? `https://${href}`
          : href.startsWith("//")
            ? `https:${href}`
            : href;
        emit("open-url", fullUrl);
      }
    }
  }
}

watch(
  () => props.source,
  () => {
    updatePreview();
  },
);

onMounted(() => {
  updatePreview();
});
</script>

<template>
  <div 
    class="h-full overflow-y-auto bg-app-bg text-app-text print:h-auto print:overflow-visible print:bg-white print:text-black" 
    style="font-size: var(--editor-font-size, 16px);"
    @click="handleContainerClick"
  >
    <div 
      ref="container" 
      class="vp-doc prose dark:prose-invert max-w-none p-4"
      v-html="html"
    ></div>
  </div>
</template>
