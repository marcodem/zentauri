<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { VNetworkGraph } from "v-network-graph";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import "v-network-graph/lib/style.css";
import * as vNG from "v-network-graph";
import { ForceLayout } from "v-network-graph/lib/force-layout";
import { isDarkTheme } from "../lib/theme";

const props = defineProps<{
  folderPath: string;
}>();

const emit = defineEmits<(e: "select", path: string) => void>();

const nodes = ref<Record<string, { name: string }>>({});
const edges = ref<Record<string, { source: string; target: string }>>({});
const layouts = ref({
  nodes: {},
});

const isLoading = ref(true);

const isDark = ref(
  isDarkTheme(
    document.documentElement.getAttribute("data-theme") || "system",
  ) || document.documentElement.classList.contains("dark"),
);

let observer: MutationObserver | null = null;

onMounted(() => {
  const updateTheme = () => {
    const theme =
      document.documentElement.getAttribute("data-theme") || "system";
    isDark.value =
      isDarkTheme(theme) || document.documentElement.classList.contains("dark");
  };

  updateTheme();

  observer = new MutationObserver(updateTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
});

onUnmounted(() => {
  observer?.disconnect();
  observer = null;
});

const configs = computed(() =>
  vNG.defineConfigs({
    view: {
      layoutHandler: new ForceLayout({
        positionFixedByDrag: false,
        positionFixedByClickWithAltKey: false,
      }),
      panEnabled: true,
      zoomEnabled: true,
    },
    node: {
      normal: {
        radius: 12,
        color: isDark.value ? "#eab308" : "#b45309",
      },
      hover: {
        radius: 14,
        color: isDark.value ? "#fde047" : "#d97706",
      },
      label: {
        visible: true,
        color: isDark.value ? "#e8e0d3" : "#03192e",
        fontSize: 11,
        direction: "south",
      },
    },
    edge: {
      normal: {
        color: isDark.value ? "#334155" : "#d8d2c6",
        width: 1.5,
      },
      hover: {
        color: isDark.value ? "#eab308" : "#b45309",
        width: 2.5,
      },
      marker: {
        target: {
          type: "arrow",
          width: 5,
          height: 5,
        },
      },
    },
  }),
);

const graph = ref(null);

async function loadGraphData() {
  if (!props.folderPath) return;
  isLoading.value = true;

  try {
    const data: {
      nodes: { id: string; name: string }[];
      edges: { source: string; target: string }[];
    } = await invoke("get_knowledge_graph", { path: props.folderPath });

    const mappedNodes: Record<string, { name: string }> = {};
    const nodeNameMap: Record<string, string> = {};

    for (const n of data.nodes) {
      mappedNodes[n.id] = { name: n.name };
      nodeNameMap[n.name.toLowerCase()] = n.id;

      const fileName = n.id.split(/[/\\]/).pop() || "";
      const withoutExt = fileName
        .replace(/\.md$/, "")
        .replace(/\.markdown$/, "");
      nodeNameMap[withoutExt.toLowerCase()] = n.id;
    }

    nodes.value = mappedNodes;

    const mappedEdges: Record<string, { source: string; target: string }> = {};
    let edgeIdx = 0;

    for (const e of data.edges) {
      let cleanTarget = e.target.split(/[?#]/)[0].trim();
      try {
        cleanTarget = decodeURIComponent(cleanTarget);
      } catch {}
      const targetFileName = cleanTarget.split(/[/\\]/).pop() || cleanTarget;
      const targetWithoutExt = targetFileName
        .replace(/\.md$/i, "")
        .replace(/\.markdown$/i, "");

      const targetId =
        nodeNameMap[cleanTarget.toLowerCase()] ||
        nodeNameMap[targetFileName.toLowerCase()] ||
        nodeNameMap[targetWithoutExt.toLowerCase()];

      if (targetId && targetId !== e.source) {
        mappedEdges[`edge${edgeIdx++}`] = {
          source: e.source,
          target: targetId,
        };
      }
    }

    edges.value = mappedEdges;
  } catch (err) {
    console.error("Failed to load graph data", err);
  } finally {
    isLoading.value = false;
  }
}

watch(() => props.folderPath, loadGraphData);

onMounted(() => {
  loadGraphData();
});

const onNodeClick = ({ node }: { node: string }) => {
  if (node) {
    emit("select", node);
  }
};
</script>

<template>
  <div class="h-full w-full bg-app-bg relative flex flex-col">
    <div class="absolute top-4 left-4 z-10 p-3 bg-app-bg-secondary/90 backdrop-blur-md border border-app-border rounded-lg shadow-sm pointer-events-none">
      <h2 class="text-app-text font-bold text-sm mb-0.5">Knowledge Graph</h2>
      <p class="text-app-text-muted text-xs">{{ Object.keys(nodes).length }} Dokumente, {{ Object.keys(edges).length }} Verknüpfungen</p>
    </div>
    
    <div v-if="isLoading" class="flex-1 flex items-center justify-center text-app-text-muted">
      Loading graph...
    </div>
    
    <v-network-graph
      v-else
      ref="graph"
      class="flex-1 w-full h-full"
      :nodes="nodes"
      :edges="edges"
      :layouts="layouts"
      :configs="configs"
      @node-click="onNodeClick"
    />
  </div>
</template>
