import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import Editor from "./components/Editor.vue";
import FileTree from "./components/FileTree.vue";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockImplementation(async (cmd) => {
    if (cmd === "read_workspace_tree") return [];
    if (cmd === "get_app_cwd") return null;
    if (cmd === "is_directory_path") return false;
    return [];
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: vi.fn().mockResolvedValue([]),
  readTextFile: vi.fn().mockResolvedValue(""),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
  message: vi.fn().mockResolvedValue("Save"),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

describe("App Component Integration", () => {
  it("mounts Editor and FileTree as real components on startup", async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          Editor: true, // we verify Editor resolves as a component, not unresolvable custom element
          Preview: true,
          Cheatsheet: true,
          HelpSystem: true,
          Settings: true,
          GraphView: true,
          SearchPanel: true,
          UpdateNotification: true,
        },
      },
    });

    // Verify FileTree component is mounted and rendered in the explorer pane
    const fileTree = wrapper.findComponent(FileTree);
    expect(fileTree.exists()).toBe(true);

    // Verify Editor component is mounted
    const editor = wrapper.findComponent(Editor);
    expect(editor.exists()).toBe(true);
  });
});
