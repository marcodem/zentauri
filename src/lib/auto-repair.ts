/**
 * Silent Auto-Repair module for Zentauri
 * Automatically fixes common Markdown syntax errors upon save (e.g., unclosed ::: containers,
 * unclosed Sanskrit brackets 《...》 / ⟪...⟫).
 */

export interface AutoRepairResult {
  repaired: string;
  didRepair: boolean;
  repairedCount: number;
}

export function autoRepairMarkdown(src: string): AutoRepairResult {
  if (!src) {
    return { repaired: src, didRepair: false, repairedCount: 0 };
  }

  let text = src;
  let didRepair = false;
  let repairedCount = 0;

  // 1. Repair unclosed container directives (:::)
  const lines = text.split("\n");
  let openContainers = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(/^(:{3,})(.*)$/);
    if (match) {
      const rest = match[2].trim();
      if (rest === "") {
        // Closing fence
        if (openContainers > 0) {
          openContainers--;
        }
      } else {
        // Opening fence
        openContainers++;
      }
    }
  }

  if (openContainers > 0) {
    const trailingNewline = text.endsWith("\n") ? "" : "\n";
    let closers = "";
    for (let c = 0; c < openContainers; c++) {
      closers += (c > 0 ? "\n" : "") + ":::";
    }
    text = text + trailingNewline + closers;
    didRepair = true;
    repairedCount += openContainers;
  }

  // 2. Repair unclosed Sanskrit double brackets 《 ... 》
  const openDoubleAngleCount = (text.match(/《/g) || []).length;
  const closeDoubleAngleCount = (text.match(/》/g) || []).length;

  if (openDoubleAngleCount > closeDoubleAngleCount) {
    const diff = openDoubleAngleCount - closeDoubleAngleCount;
    text += "》".repeat(diff);
    didRepair = true;
    repairedCount += diff;
  }

  // 3. Repair unclosed Sanskrit double angle brackets ⟪ ... ⟫
  const openSpecialAngleCount = (text.match(/⟪/g) || []).length;
  const closeSpecialAngleCount = (text.match(/⟫/g) || []).length;

  if (openSpecialAngleCount > closeSpecialAngleCount) {
    const diff = openSpecialAngleCount - closeSpecialAngleCount;
    text += "⟫".repeat(diff);
    didRepair = true;
    repairedCount += diff;
  }

  return {
    repaired: text,
    didRepair,
    repairedCount,
  };
}
