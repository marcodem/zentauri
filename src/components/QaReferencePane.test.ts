import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import QaReferencePane from "./QaReferencePane.vue";

describe("QaReferencePane", () => {
  it("renders reference pane with title, language code and swap button", () => {
    const wrapper = mount(QaReferencePane, {
      props: {
        title: "lektion01.md",
        content: "# Lektion 01\nText in German.",
        langCode: "de",
      },
    });

    expect(wrapper.text()).toContain("lektion01.md");
    expect(wrapper.text()).toContain("DE");
    expect(wrapper.text()).toContain("SWAP");
  });

  it("emits swap event when swap button is clicked", async () => {
    const wrapper = mount(QaReferencePane, {
      props: {
        title: "lektion01.md",
        content: "# Lektion 01",
        langCode: "de",
      },
    });

    const swapBtn = wrapper.find('button[title*="SWAP"]');
    expect(swapBtn.exists()).toBe(true);
    await swapBtn.trigger("click");

    expect(wrapper.emitted("swap")).toBeTruthy();
  });

  it("toggles between rendered preview and raw text view", async () => {
    const wrapper = mount(QaReferencePane, {
      props: {
        title: "test.md",
        content: "# Header\nSome raw markdown",
      },
    });

    const rawBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Quelltext");
    expect(rawBtn).toBeDefined();
    await rawBtn?.trigger("click");

    const textarea = wrapper.find("textarea");
    expect(textarea.exists()).toBe(true);
    expect(textarea.element.value).toContain("# Header");
  });
});
