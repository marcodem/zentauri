import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import Preview from "./Preview.vue";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Preview Component - Link Handling", () => {
  it("normalizes www. links and emits open-url with https prefix", async () => {
    const markdown = "[Birchville](www.birchville.org)";
    const wrapper = mount(Preview, {
      props: { source: markdown },
    });
    await wrapper.vm.$nextTick();

    const link = wrapper.find('a[href="www.birchville.org"]');
    expect(link.exists()).toBe(true);

    await link.trigger("click");
    expect(wrapper.emitted("open-url")).toBeTruthy();
    expect(wrapper.emitted("open-url")?.[0]).toEqual([
      "https://www.birchville.org",
    ]);
  });

  it("normalizes protocol-relative // links and emits open-url with https: prefix", async () => {
    const markdown = "[Protocol Relative](//example.com/test)";
    const wrapper = mount(Preview, {
      props: { source: markdown },
    });
    await wrapper.vm.$nextTick();

    const link = wrapper.find('a[href="//example.com/test"]');
    expect(link.exists()).toBe(true);

    await link.trigger("click");
    expect(wrapper.emitted("open-url")).toBeTruthy();
    expect(wrapper.emitted("open-url")?.[0]).toEqual([
      "https://example.com/test",
    ]);
  });

  it("emits open-url for standard https and mailto links", async () => {
    const markdown =
      "[Website](https://example.org) and [Email](mailto:support@example.org)";
    const wrapper = mount(Preview, {
      props: { source: markdown },
    });
    await wrapper.vm.$nextTick();

    await wrapper.find('a[href="https://example.org"]').trigger("click");
    expect(wrapper.emitted("open-url")?.[0]).toEqual(["https://example.org"]);

    await wrapper.find('a[href="mailto:support@example.org"]').trigger("click");
    expect(wrapper.emitted("open-url")?.[1]).toEqual([
      "mailto:support@example.org",
    ]);
  });

  it("emits open-file for relative markdown links", async () => {
    const markdown = "[Chapter 1](./chapters/01-panini.md)";
    const wrapper = mount(Preview, {
      props: { source: markdown },
    });
    await wrapper.vm.$nextTick();

    await wrapper.find('a[href="./chapters/01-panini.md"]').trigger("click");
    expect(wrapper.emitted("open-file")).toBeTruthy();
    expect(wrapper.emitted("open-file")?.[0]).toEqual([
      "./chapters/01-panini.md",
    ]);
  });

  it("ignores anchor hash links", async () => {
    const markdown = "[Jump to Summary](#summary)";
    const wrapper = mount(Preview, {
      props: { source: markdown },
    });
    await wrapper.vm.$nextTick();

    await wrapper.find('a[href="#summary"]').trigger("click");
    expect(wrapper.emitted("open-url")).toBeFalsy();
    expect(wrapper.emitted("open-file")).toBeFalsy();
  });

  describe("Scroll Synchronization", () => {
    it("exposes scroll methods and calculates scroll info", async () => {
      const markdown = "# Title\n\nParagraph 1\n\n## Section 2\n\nParagraph 2";
      const wrapper = mount(Preview, {
        props: { source: markdown },
      });
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as any;
      expect(typeof vm.getScrollInfo).toBe("function");
      expect(typeof vm.scrollToFractionalLine).toBe("function");
      expect(typeof vm.scrollToRatio).toBe("function");
      expect(typeof vm.getScrollerElement).toBe("function");

      const scroller = vm.getScrollerElement();
      expect(scroller).toBeDefined();

      const info = vm.getScrollInfo();
      expect(info).not.toBeNull();
      expect(info.fractionalLine).toBeGreaterThanOrEqual(1);
    });

    it("scrolls to ratio and fractional line programmatically", async () => {
      const markdown = "# Title\n\nParagraph 1\n\n## Section 2\n\nParagraph 2";
      const wrapper = mount(Preview, {
        props: { source: markdown },
      });
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as any;
      const scroller = vm.getScrollerElement() as HTMLElement;

      Object.defineProperty(scroller, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scroller, "clientHeight", {
        value: 500,
        configurable: true,
      });

      vm.scrollToRatio(0.5);
      expect(scroller.scrollTop).toBe(250);

      vm.scrollToFractionalLine(1);
      expect(scroller.scrollTop).toBe(0);
    });
  });
});
