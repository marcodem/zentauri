import { describe, it, expect } from "vitest";
import { autoRepairMarkdown } from "./auto-repair";

describe("autoRepairMarkdown", () => {
  it("should return unchanged text when no repair needed", () => {
    const input = "# Heading\n\n::: important[Title]\nContent\n:::";
    const result = autoRepairMarkdown(input);
    expect(result.didRepair).toBe(false);
    expect(result.repaired).toBe(input);
    expect(result.repairedCount).toBe(0);
  });

  it("should auto-close unclosed container directives (:::)", () => {
    const input = "::: grammar-box\nSome grammar notes";
    const result = autoRepairMarkdown(input);
    expect(result.didRepair).toBe(true);
    expect(result.repaired).toContain(
      "::: grammar-box\nSome grammar notes\n:::",
    );
    expect(result.repairedCount).toBe(1);
  });

  it("should auto-close unclosed Sanskrit double angle brackets 《...》", () => {
    const input = "This is Sanskrit 《rāmah";
    const result = autoRepairMarkdown(input);
    expect(result.didRepair).toBe(true);
    expect(result.repaired).toBe("This is Sanskrit 《rāmah》");
    expect(result.repairedCount).toBe(1);
  });

  it("should auto-close unclosed special angle brackets ⟪...⟫", () => {
    const input = "Special brackets ⟪test";
    const result = autoRepairMarkdown(input);
    expect(result.didRepair).toBe(true);
    expect(result.repaired).toBe("Special brackets ⟪test⟫");
    expect(result.repairedCount).toBe(1);
  });
});
