<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderMarkdown } from "../lib/markdown";

export interface ScrollInfo {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  ratio: number;
  fractionalLine: number;
}

const props = defineProps<{ source: string }>();

const scrollContainer = ref<HTMLElement | null>(null);
const container = ref<HTMLElement | null>(null);
const html = ref("");
let mermaidRunId = 0;
let mermaidDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isProgrammaticScroll = false;
let rafUnlockId: number | null = null;

function scheduleUnlock() {
  if (rafUnlockId !== null) {
    cancelAnimationFrame(rafUnlockId);
  }
  rafUnlockId = requestAnimationFrame(() => {
    isProgrammaticScroll = false;
    rafUnlockId = null;
  });
}

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
  html.value = renderMarkdown(props.source, { sourceLines: true });

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
  (e: "scroll", info: ScrollInfo): void;
  (e: "user-interaction"): void;
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

function getSourceElements(): { el: HTMLElement; line: number }[] {
  if (!container.value) return [];
  const nodes =
    container.value.querySelectorAll<HTMLElement>("[data-source-line]");
  const result: { el: HTMLElement; line: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const lineStr = el.getAttribute("data-source-line");
    if (!lineStr) continue;
    const line = Number.parseInt(lineStr, 10);
    if (!Number.isNaN(line) && line > 0) {
      result.push({ el, line });
    }
  }
  return result;
}

function getScrollInfo(): ScrollInfo | null {
  if (!scrollContainer.value || !container.value) return null;
  const scroller = scrollContainer.value;
  const scrollTop = scroller.scrollTop;
  const scrollHeight = scroller.scrollHeight;
  const clientHeight = scroller.clientHeight;
  const maxScroll = scrollHeight - clientHeight;
  const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0;

  if (scrollTop <= 1) {
    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      ratio: 0,
      fractionalLine: 1,
    };
  }
  if (scrollTop >= maxScroll - 2) {
    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      ratio: 1,
      fractionalLine: 999999,
    };
  }

  const items = getSourceElements();
  if (items.length === 0) {
    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      ratio,
      fractionalLine: 1,
    };
  }

  const containerRect = container.value.getBoundingClientRect();
  let prevItem: { line: number; top: number } | null = null;
  let nextItem: { line: number; top: number } | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const top = item.el.getBoundingClientRect().top - containerRect.top;
    if (top <= scrollTop) {
      prevItem = { line: item.line, top };
    } else {
      nextItem = { line: item.line, top };
      break;
    }
  }

  let fractionalLine = 1;
  if (!prevItem && nextItem) {
    const progress = nextItem.top > 0 ? scrollTop / nextItem.top : 0;
    fractionalLine = 1 + progress * (nextItem.line - 1);
  } else if (prevItem && !nextItem) {
    fractionalLine = prevItem.line;
  } else if (prevItem && nextItem) {
    const distance = nextItem.top - prevItem.top;
    const progress = distance > 0 ? (scrollTop - prevItem.top) / distance : 0;
    fractionalLine = prevItem.line + progress * (nextItem.line - prevItem.line);
  }

  return {
    scrollTop,
    scrollHeight,
    clientHeight,
    ratio,
    fractionalLine: Math.max(1, fractionalLine),
  };
}

function scrollToFractionalLine(
  targetLine: number,
  fallbackRatio?: number,
  totalLines?: number,
) {
  if (!scrollContainer.value || !container.value) return;
  const scroller = scrollContainer.value;
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  if (maxScroll <= 0) return;

  if (targetLine <= 1) {
    isProgrammaticScroll = true;
    scroller.scrollTop = 0;
    scheduleUnlock();
    return;
  }
  if (
    (totalLines && targetLine >= totalLines) ||
    (fallbackRatio !== undefined && fallbackRatio >= 0.999)
  ) {
    isProgrammaticScroll = true;
    scroller.scrollTop = maxScroll;
    scheduleUnlock();
    return;
  }

  const items = getSourceElements();
  if (items.length === 0) {
    if (fallbackRatio !== undefined) {
      isProgrammaticScroll = true;
      scroller.scrollTop = Math.round(fallbackRatio * maxScroll);
      scheduleUnlock();
    }
    return;
  }

  let prevItem: { line: number; el: HTMLElement } | null = null;
  let nextItem: { line: number; el: HTMLElement } | null = null;

  let low = 0;
  let high = items.length - 1;
  let bestIdx = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (items[mid].line <= targetLine) {
      bestIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestIdx >= 0) {
    prevItem = items[bestIdx];
  }
  if (bestIdx + 1 < items.length) {
    nextItem = items[bestIdx + 1];
  }

  const containerRect = container.value.getBoundingClientRect();
  let targetScrollTop = 0;

  if (!prevItem && nextItem) {
    const nextTop = nextItem.el.getBoundingClientRect().top - containerRect.top;
    const progress =
      nextItem.line > 1 ? (targetLine - 1) / (nextItem.line - 1) : 0;
    targetScrollTop = progress * nextTop;
  } else if (prevItem && !nextItem) {
    const prevTop = prevItem.el.getBoundingClientRect().top - containerRect.top;
    if (totalLines && totalLines > prevItem.line) {
      const progress =
        (targetLine - prevItem.line) / (totalLines - prevItem.line);
      targetScrollTop = prevTop + progress * (maxScroll - prevTop);
    } else {
      targetScrollTop = prevTop;
    }
  } else if (prevItem && nextItem) {
    const prevTop = prevItem.el.getBoundingClientRect().top - containerRect.top;
    const nextTop = nextItem.el.getBoundingClientRect().top - containerRect.top;
    const lineSpan = nextItem.line - prevItem.line;
    const progress = lineSpan > 0 ? (targetLine - prevItem.line) / lineSpan : 0;
    targetScrollTop = prevTop + progress * (nextTop - prevTop);
  } else if (fallbackRatio !== undefined) {
    targetScrollTop = fallbackRatio * maxScroll;
  }

  targetScrollTop = Math.max(
    0,
    Math.min(maxScroll, Math.round(targetScrollTop)),
  );
  isProgrammaticScroll = true;
  scroller.scrollTop = targetScrollTop;
  scheduleUnlock();
}

function scrollToRatio(ratio: number) {
  if (!scrollContainer.value) return;
  const scroller = scrollContainer.value;
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  if (maxScroll <= 0) return;
  isProgrammaticScroll = true;
  scroller.scrollTop = Math.max(
    0,
    Math.min(maxScroll, Math.round(ratio * maxScroll)),
  );
  scheduleUnlock();
}

function handleScroll() {
  if (isProgrammaticScroll) return;
  const info = getScrollInfo();
  if (info) {
    emit("scroll", info);
  }
}

function handleInteraction() {
  emit("user-interaction");
}

defineExpose({
  getScrollInfo,
  scrollToFractionalLine,
  scrollToRatio,
  getScrollerElement: () => scrollContainer.value,
});

watch(
  () => props.source,
  () => {
    updatePreview();
  },
);

let themeObserver: MutationObserver | null = null;

onMounted(() => {
  updatePreview();
  themeObserver = new MutationObserver(() => {
    runMermaidSafely();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });

  if (scrollContainer.value) {
    const scroller = scrollContainer.value;
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    scroller.addEventListener("wheel", handleInteraction, { passive: true });
    scroller.addEventListener("pointerdown", handleInteraction, {
      passive: true,
    });
    scroller.addEventListener("touchstart", handleInteraction, {
      passive: true,
    });
  }
});

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
  if (rafUnlockId !== null) {
    cancelAnimationFrame(rafUnlockId);
    rafUnlockId = null;
  }
  if (scrollContainer.value) {
    const scroller = scrollContainer.value;
    scroller.removeEventListener("scroll", handleScroll);
    scroller.removeEventListener("wheel", handleInteraction);
    scroller.removeEventListener("pointerdown", handleInteraction);
    scroller.removeEventListener("touchstart", handleInteraction);
  }
});
</script>

<template>
  <div 
    ref="scrollContainer"
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
