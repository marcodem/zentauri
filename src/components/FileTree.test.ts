import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import FileTree from "./FileTree.vue";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
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
          WorkspaceFolderSection: true,
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
          WorkspaceFolderSection: true,
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

  it("renders WorkspaceFolderSection when workspace folders are provided", () => {
    const wrapper = mount(FileTree, {
      props: {
        rootPath: "/Users/test/my-project",
        rootPaths: ["/Users/test/my-project"],
        openTabs: [],
      },
      global: {
        stubs: {
          WorkspaceFolderSection: {
            template: "<div class='mock-folder-section'>Workspace Folder</div>",
          },
          ContextMenu: true,
        },
      },
    });

    expect(wrapper.find(".mock-folder-section").exists()).toBe(true);
    expect(wrapper.text()).toContain("Workspace Folder");
  });
});
