import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UpdateNotification from "./UpdateNotification.vue";

const mockCheckForUpdates = vi.fn();
const mockInstallAppUpdate = vi.fn();

vi.mock("../lib/updater", () => ({
  checkForUpdates: () => mockCheckForUpdates(),
  installAppUpdate: (...args: unknown[]) => mockInstallAppUpdate(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

describe("UpdateNotification Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Simulate Tauri environment
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  });

  it("does not render when isVisible is false", () => {
    const wrapper = mount(UpdateNotification);
    expect(wrapper.find("[role='alert']").exists()).toBe(false);
  });

  it("renders popup with release notes toggle when an update with notes is found", async () => {
    mockCheckForUpdates.mockResolvedValue({
      available: true,
      version: "1.2.0",
      body: "### Changes\n- Add native PDF export\n- Improve sidebar speed",
      update: {},
    });

    const wrapper = mount(UpdateNotification);

    // Call exposed runUpdateCheck
    await (wrapper.vm as unknown as { runUpdateCheck: (force?: boolean) => Promise<void> }).runUpdateCheck(true);
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[role='alert']").exists()).toBe(true);
    expect(wrapper.text()).toContain("v1.2.0");
    expect(wrapper.text()).toContain("Was ist neu in v1.2.0?");

    // Release notes should initially be collapsed
    expect(wrapper.find(".release-notes-content").exists()).toBe(false);

    // Click toggle button
    const toggleBtn = wrapper.find("button[class*='text-amber']");
    expect(toggleBtn.exists()).toBe(true);
    await toggleBtn.trigger("click");
    await wrapper.vm.$nextTick();

    // Release notes should now be visible and formatted
    const notesContainer = wrapper.find(".release-notes-content");
    expect(notesContainer.exists()).toBe(true);
    expect(notesContainer.html()).toContain("Changes</h3>");
    expect(notesContainer.html()).toContain("<li>Add native PDF export</li>");

    // Click again to collapse
    await toggleBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".release-notes-content").exists()).toBe(false);
  });

  it("dismisses popup and remembers version in sessionStorage", async () => {
    mockCheckForUpdates.mockResolvedValue({
      available: true,
      version: "1.2.0",
      body: "Some notes",
      update: {},
    });

    const wrapper = mount(UpdateNotification);
    await (wrapper.vm as unknown as { runUpdateCheck: (force?: boolean) => Promise<void> }).runUpdateCheck(true);
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[role='alert']").exists()).toBe(true);

    const closeBtn = wrapper.find("button[title='Schließen']");
    await closeBtn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[role='alert']").exists()).toBe(false);
    expect(sessionStorage.getItem("zentauri_dismissed_update_version")).toBe("1.2.0");
  });
});
