import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import FileTree from "./FileTree.vue";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockImplementation(async (cmd) => {
    if (cmd === "read_workspace_tree") {
      return [
        {
          name: "01_Notes.md",
          path: "/Users/test/my-project/01_Notes.md",
          is_directory: false,
          title: "Notes Title",
        },
        {
          name: "02_Draft.md",
          path: "/Users/test/my-project/02_Draft.md",
          is_directory: false,
        },
        {
          name: "SubFolder",
          path: "/Users/test/my-project/SubFolder",
          is_directory: true,
        },
      ];
    }
    return [];
  }),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
}));

describe("FileTree Component", () => {
  it("renders welcome buttons on fresh start with only untitled tab and no workspace", async () => {
    const wrapper = mount(FileTree, {
      props: {
        rootPath: null,
        rootPaths: [],
        openTabs: [
          {
            id: "1",
            path: "untitled://1",
            title: "Untitled Document",
            content: "",
          },
        ],
      },
      global: {
        stubs: {
          ContextMenu: true,
        },
      },
    });

    const buttons = wrapper.findAll("button");
    const buttonTexts = buttons.map((b) => b.text());

    // Must show Open Folder and Open File buttons
    expect(buttonTexts).toContain("Open Folder");
    expect(buttonTexts).toContain("Open File");

    // Must not show the filter input bar when workspace and open editors are both empty
    expect(wrapper.find("input[placeholder='Filter files...']").exists()).toBe(
      false,
    );

    // Clicking Open Folder emits open-folder event
    const openFolderBtn = buttons.find((b) => b.text().includes("Open Folder"));
    await openFolderBtn?.trigger("click");
    expect(wrapper.emitted("open-folder")).toBeTruthy();

    // Clicking Open File emits open-file event
    const openFileBtn = buttons.find((b) => b.text().includes("Open File"));
    await openFileBtn?.trigger("click");
    expect(wrapper.emitted("open-file")).toBeTruthy();
  });

  it("renders Open Editors when a standalone file is loaded without workspace root", () => {
    const wrapper = mount(FileTree, {
      props: {
        rootPath: null,
        rootPaths: [],
        openTabs: [
          {
            id: "file-1",
            path: "/Users/test/notes.md",
            title: "notes.md",
            content: "Hello",
          },
        ],
      },
      global: {
        stubs: {
          ContextMenu: true,
        },
      },
    });

    // Filter bar should now exist
    expect(wrapper.find("input[placeholder='Filter files...']").exists()).toBe(
      true,
    );

    // Open Editors section should be visible
    expect(wrapper.text()).toContain("Open Editors");
    expect(wrapper.text()).toContain("notes.md");

    // Fallback prompt for workspace folder should be visible
    expect(wrapper.text()).toContain("No folder opened in workspace.");
  });

  it("renders real WorkspaceFolderSection and file items when workspace folders are provided", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
      writable: true,
    });

    const wrapper = mount(FileTree, {
      props: {
        rootPath: "/Users/test/my-project",
        rootPaths: ["/Users/test/my-project"],
        openTabs: [],
      },
      global: {
        stubs: {
          ContextMenu: true,
        },
      },
    });

    // Wait for async loadFolderTree to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(wrapper.text()).toContain("MY-PROJECT");
    expect(wrapper.text()).toContain("Notes Title");
    expect(wrapper.text()).toContain("02_Draft.md");
    expect(wrapper.text()).toContain("SubFolder");

    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });
});
