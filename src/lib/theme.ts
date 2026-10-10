export const DARK_THEMES = [
  "dark",
  "payer-night",
  "solarized-dark",
  "dracula",
  "tokyonight",
  "catppuccin",
  "gruvbox",
  "nord",
] as const;

export type ThemeId =
  | "system"
  | "light"
  | "dark"
  | "payer-day"
  | "payer-night"
  | "gruvbox"
  | "solarized"
  | "solarized-dark"
  | "catppuccin"
  | "tokyonight"
  | "nord"
  | "dracula";

export interface ThemeOption {
  id: ThemeId;
  label: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "payer-day", label: "Payer-Day" },
  { id: "payer-night", label: "Payer-Night" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "solarized", label: "Solarized Light" },
  { id: "solarized-dark", label: "Solarized Dark" },
  { id: "catppuccin", label: "Catppuccin (Mocha)" },
  { id: "tokyonight", label: "Tokyo Night" },
  { id: "nord", label: "Nord" },
  { id: "dracula", label: "Dracula" },
];

export function isDarkTheme(theme: string): boolean {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  }
  return (DARK_THEMES as readonly string[]).includes(theme);
}

export function applyTheme(theme: string, fontSize?: number): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-theme", theme);
  if (fontSize !== undefined && fontSize > 0) {
    html.style.setProperty("--editor-font-size", `${fontSize}px`);
  }
  const dark = isDarkTheme(theme);
  html.classList.toggle("dark", dark);
}

export function initTheme(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem("zentauri-settings");
    if (raw) {
      const s = JSON.parse(raw);
      if (s.theme) {
        applyTheme(s.theme, s.fontSize);
        return;
      }
    }
  } catch {}
  applyTheme("system");
}
