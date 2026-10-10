import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StatusBar from "./StatusBar.vue";

describe("StatusBar Component", () => {
  it("renders cursor position and default editor details", () => {
    const wrapper = mount(StatusBar, {
      props: {
        cursorInfo: {
          line: 42,
          column: 17,
          selectedChars: 0,
          totalLines: 100,
        },
        wordCount: 1250,
        charCount: 8400,
        readTime: 7,
        workspaceName: "zentauri",
        encoding: "UTF-8",
        eol: "LF",
        indentation: "Spaces: 2",
      },
    });

    // Check cursor position
    expect(wrapper.text()).toContain("Ln 42, Col 17");
    // Check words
    expect(wrapper.text()).toContain("words");
    expect(wrapper.text()).toContain("42");
    // Check workspace
    expect(wrapper.text()).toContain("zentauri");
    // Check encoding & mode
    expect(wrapper.text()).toContain("UTF-8");
    expect(wrapper.text()).toContain("LF");
    expect(wrapper.text()).toContain("Spaces: 2");
  });

  it("displays selected character count when text is selected", () => {
    const wrapper = mount(StatusBar, {
      props: {
        cursorInfo: {
          line: 10,
          column: 5,
          selectedChars: 25,
          totalLines: 50,
        },
      },
    });

    expect(wrapper.text()).toContain("Ln 10, Col 5 (25 selected)");
  });

  it("emits jump-to-line when clicking cursor position button", async () => {
    const wrapper = mount(StatusBar, {
      props: {
        cursorInfo: {
          line: 12,
          column: 3,
          selectedChars: 0,
          totalLines: 50,
        },
      },
    });

    const cursorBtn = wrapper.find("button");
    await cursorBtn.trigger("click");

    expect(wrapper.emitted("jump-to-line")).toBeTruthy();
  });

  it("does not render language mode control and renders sync scroll as display only", () => {
    const wrapper = mount(StatusBar, {
      props: {
        viewMode: "split",
        syncScroll: true,
      },
    });

    // Ensure Markdown button is removed
    expect(wrapper.text().includes("Markdown")).toBe(false);

    // Sync scroll is rendered as non-interactive display
    const syncIndicator = wrapper.find(
      "span[title='Scroll Synchronization: Active']",
    );
    expect(syncIndicator.exists()).toBe(true);
    expect(syncIndicator.text()).toContain("Sync");
  });

  it("renders VIM indicator as non-interactive display when vimMode is enabled", () => {
    const wrapper = mount(StatusBar, {
      props: {
        vimMode: true,
      },
    });

    const vimIndicator = wrapper.find("span[title='Vim-Modus aktiv']");
    expect(vimIndicator.exists()).toBe(true);
    expect(vimIndicator.text()).toBe("VIM");

    // Ensure it is not an interactive button
    const buttons = wrapper.findAll("button");
    const vimBtn = buttons.find((b) => b.text().includes("VIM"));
    expect(vimBtn).toBeUndefined();
  });
});
