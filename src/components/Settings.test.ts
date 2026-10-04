import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings.vue";

const mockCheckForUpdates = vi.fn();
const mockInstallAppUpdate = vi.fn();
const mockRelaunch = vi.fn();

vi.mock("../lib/updater", () => ({
  checkForUpdates: () => mockCheckForUpdates(),
  installAppUpdate: (...args: unknown[]) => mockInstallAppUpdate(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: () => mockRelaunch(),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn().mockResolvedValue("1.1.23"),
}));

describe("Settings Component - Update Flow & Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders settings modal when isOpen is true", () => {
    const wrapper = mount(Settings, {
      props: { isOpen: true },
    });
    expect(wrapper.find("h2").text()).toBe("Settings");
    expect(wrapper.text()).toContain("Check for Updates");
  });

  it("handles update check, places download button above notes, and keeps notes collapsed by default", async () => {
    mockCheckForUpdates.mockResolvedValue({
      available: true,
      version: "1.2.0",
      body: "- Feature 1\n- Feature 2",
      update: {},
    });

    const wrapper = mount(Settings, {
      props: { isOpen: true },
    });

    const checkBtnEl = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Check for Updates"));
    expect(checkBtnEl).toBeDefined();

    await checkBtnEl!.trigger("click");
    await wrapper.vm.$nextTick();

    // Check availability message
    expect(wrapper.text()).toContain("New version v1.2.0 is available!");

    // Download & Install Update button must exist and be visible
    const installBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Download & Install Update"));
    expect(installBtn).toBeDefined();
    expect(installBtn!.exists()).toBe(true);

    // Release notes should be collapsed by default
    expect(wrapper.find(".release-notes-content").exists()).toBe(false);

    // Verify DOM order: Download button must appear BEFORE the release notes toggle
    const html = wrapper.html();
    const installBtnIndex = html.indexOf("Download &amp; Install Update");
    const notesToggleIndex = html.indexOf("Release Notes");
    expect(installBtnIndex).toBeGreaterThan(-1);
    expect(notesToggleIndex).toBeGreaterThan(-1);
    expect(installBtnIndex).toBeLessThan(notesToggleIndex);

    // Clicking toggle expands release notes
    const toggleNotesBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Release Notes"));
    expect(toggleNotesBtn).toBeDefined();
    await toggleNotesBtn!.trigger("click");
    await wrapper.vm.$nextTick();

    const notesContainer = wrapper.find(".release-notes-content");
    expect(notesContainer.exists()).toBe(true);
    expect(notesContainer.html()).toContain("<li>Feature 1</li>");

    // Clicking download triggers installAppUpdate and shows progress
    let finishInstall!: () => void;
    const installPromise = new Promise<void>((resolve) => {
      finishInstall = resolve;
    });

    mockInstallAppUpdate.mockImplementation(
      async (_update: unknown, cb?: (d: number, t?: number) => void) => {
        if (cb) cb(50, 100);
        return installPromise;
      },
    );

    await installBtn!.trigger("click");
    await wrapper.vm.$nextTick();

    expect(mockInstallAppUpdate).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Downloading update... 50%");

    finishInstall();
    await wrapper.vm.$nextTick();
    await new Promise((r) => setTimeout(r, 10));
    expect(mockRelaunch).toHaveBeenCalled();
  });
});
