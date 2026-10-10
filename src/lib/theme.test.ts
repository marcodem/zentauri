import { beforeEach, describe, expect, it } from "vitest";
import { THEME_OPTIONS, applyTheme, initTheme, isDarkTheme } from "./theme";

describe("Theme Management", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  it("includes payer-day and payer-night in THEME_OPTIONS", () => {
    const ids = THEME_OPTIONS.map((o) => o.id);
    expect(ids).toContain("payer-day");
    expect(ids).toContain("payer-night");
  });

  it("correctly identifies dark vs light themes", () => {
    expect(isDarkTheme("payer-day")).toBe(false);
    expect(isDarkTheme("light")).toBe(false);
    expect(isDarkTheme("solarized")).toBe(false);

    expect(isDarkTheme("payer-night")).toBe(true);
    expect(isDarkTheme("dark")).toBe(true);
    expect(isDarkTheme("solarized-dark")).toBe(true);
    expect(isDarkTheme("dracula")).toBe(true);
    expect(isDarkTheme("tokyonight")).toBe(true);
    expect(isDarkTheme("catppuccin")).toBe(true);
    expect(isDarkTheme("gruvbox")).toBe(true);
    expect(isDarkTheme("nord")).toBe(true);
  });

  it("applies payer-day correctly to documentElement", () => {
    applyTheme("payer-day", 18);
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "payer-day",
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue("--editor-font-size"),
    ).toBe("18px");
  });

  it("applies payer-night correctly to documentElement and sets dark class", () => {
    applyTheme("payer-night", 16);
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "payer-night",
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue("--editor-font-size"),
    ).toBe("16px");
  });

  it("initializes saved theme from localStorage", () => {
    localStorage.setItem(
      "zentauri-settings",
      JSON.stringify({ theme: "payer-night", fontSize: 20 }),
    );
    initTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "payer-night",
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue("--editor-font-size"),
    ).toBe("20px");
  });
});
