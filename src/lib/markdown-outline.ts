import { invoke } from "@tauri-apps/api/core";

export interface HeadingItem {
  level: number;
  text: string;
  line: number;
}

/**
 * Parses Markdown headers (H1-H6) in high-speed native Rust via Tauri IPC.
 * @param content Full markdown content string
 * @returns Array of heading items with level, text, and 1-based line number
 */
export async function getMarkdownOutline(
  content: string,
): Promise<HeadingItem[]> {
  try {
    return await invoke<HeadingItem[]>("parse_outline", { content });
  } catch (err) {
    console.error("Failed to parse markdown outline via Rust backend:", err);
    return [];
  }
}
