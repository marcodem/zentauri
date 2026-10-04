<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { renderMarkdown } from "../lib/markdown";

const props = defineProps<{ source: string }>();

const container = ref<HTMLElement>();
const html = ref("");
let mermaidRunId = 0;
let mermaidDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function runMermaidSafely() {
  const currentRunId = ++mermaidRunId;
  await nextTick();
  if (currentRunId !== mermaidRunId || !container.value) return;

  const mermaidNodes =
    container.value.querySelectorAll<HTMLElement>(".mermaid");
  if (mermaidNodes.length === 0) return;

  try {
    const { default: mermaid } = await import("mermaid");
    const isDark = document.documentElement.classList.contains("dark");
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "strict",
    });

    if (currentRunId === mermaidRunId) {
      await mermaid.run({
        nodes: Array.from(mermaidNodes),
      });
    }
  } catch (e) {
    console.error("Mermaid render failed:", e);
  }
}

function updatePreview() {
  html.value = renderMarkdown(props.source);

  if (mermaidDebounceTimer) {
    clearTimeout(mermaidDebounceTimer);
  }
  mermaidDebounceTimer = setTimeout(() => {
    runMermaidSafely();
  }, 200);
}

const emit = defineEmits<{
  (e: "open-url", url: string): void;
  (e: "open-file", path: string): void;
}>();

function handleContainerClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const anchor = target.closest("a") as HTMLAnchorElement | null;
  if (anchor) {
    const href = anchor.getAttribute("href");
    if (!href) return;

    // In-page hash anchors (e.g. #heading) are allowed
    if (href.startsWith("#")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//") ||
      href.startsWith("www.") ||
      href.startsWith("mailto:")
    ) {
      const fullUrl = href.startsWith("www.")
        ? `https://${href}`
        : href.startsWith("//")
          ? `https:${href}`
          : href;
      emit("open-url", fullUrl);
    } else {
      // Relative file or markdown link
      emit("open-file", href);
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
