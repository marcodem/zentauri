/**
 * Silent Auto-Repair module for Zentauri
 * Automatically fixes common Markdown syntax errors upon save (e.g., container nesting depth,
 * unclosed ::: containers, unclosed Sanskrit brackets 《...》 / ⟪...⟫).
 */

export interface AutoRepairResult {
  repaired: string;
  didRepair: boolean;
  repairedCount: number;
}

export interface ContainerNestingResult {
  repaired: string;
  didRepair: boolean;
  adjustedCount: number;
}

interface ContainerBlock {
  id: number;
  openLineIndex: number;
  closeLineIndex: number | null;
  indent: string;
  colons: string;
  space: string;
  name: string;
  rest: string;
  closeIndent: string;
  closeColons: string;
  targetColonsCount: number;
  children: ContainerBlock[];
  parent: ContainerBlock | null;
}

/**
 * Adjusts container colons according to hierarchy depth.
 * In markdown-it / VitePress container rules, an outer container MUST have strictly more colons
 * than any container nested directly or indirectly inside it.
 * (e.g., innermost = :::, outer = ::::, outermost = :::::)
 */
export function adjustContainerNesting(
  src: string,
  options?: { closeUnclosed?: boolean },
): ContainerNestingResult {
  if (!src) {
    return { repaired: src, didRepair: false, adjustedCount: 0 };
  }

  const hasTrailingNewline = src.endsWith("\n");
  const rawLines = src.split("\n");
  // If the last line is empty due to a trailing newline, remove it temporarily
  const lines =
    hasTrailingNewline &&
    rawLines.length > 0 &&
    rawLines[rawLines.length - 1] === ""
      ? rawLines.slice(0, -1)
      : rawLines.slice();

  const stack: ContainerBlock[] = [];
  const roots: ContainerBlock[] = [];
  const allContainers: ContainerBlock[] = [];
  let nextId = 1;

  let inCodeFence = false;
  let codeFenceChar = "";
  let codeFenceLen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check code fence toggle
    const fenceMatch = line.match(/^[ \t]*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceChar = char;
        codeFenceLen = len;
        continue;
      }
      if (char === codeFenceChar && len >= codeFenceLen) {
        inCodeFence = false;
        continue;
      }
    }

    if (inCodeFence) {
      continue;
    }

    // Check for container opener: :::{3,} [name] [rest]
    const openMatch = line.match(
      /^([ \t]*)(:{3,})([ \t]*)([a-zA-Z0-9_-]+)(.*)$/,
    );
    if (openMatch) {
      const indent = openMatch[1];
      const colons = openMatch[2];
      const space = openMatch[3] || " ";
      const name = openMatch[4];
      const rest = openMatch[5];

      const block: ContainerBlock = {
        id: nextId++,
        openLineIndex: i,
        closeLineIndex: null,
        indent,
        colons,
        space,
        name,
        rest,
        closeIndent: indent,
        closeColons: colons,
        targetColonsCount: colons.length,
        children: [],
        parent: stack.length > 0 ? stack[stack.length - 1] : null,
      };

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(block);
      } else {
        roots.push(block);
      }
      stack.push(block);
      allContainers.push(block);
      continue;
    }

    // Check for container closer: :::{3,}
    const closeMatch = line.match(/^([ \t]*)(:{3,})[ \t]*$/);
    if (closeMatch) {
      if (stack.length > 0) {
        const top = stack.pop()!;
        top.closeLineIndex = i;
        top.closeIndent = closeMatch[1];
        top.closeColons = closeMatch[2];
      }
    }
  }

  // Calculate required colon counts bottom-up (post-order traversal)
  function computeTargetColons(block: ContainerBlock): number {
    let maxChildColons = 0;
    for (const child of block.children) {
      const childColons = computeTargetColons(child);
      if (childColons > maxChildColons) {
        maxChildColons = childColons;
      }
    }

    if (block.children.length > 0) {
      block.targetColonsCount = Math.max(
        block.colons.length,
        maxChildColons + 1,
        3,
      );
    } else {
      block.targetColonsCount = Math.max(block.colons.length, 3);
    }

    return block.targetColonsCount;
  }

  for (const root of roots) {
    computeTargetColons(root);
  }

  let didRepair = false;
  let adjustedCount = 0;

  // Update existing opening and closing fences
  for (const block of allContainers) {
    const openNeedsUpdate = block.targetColonsCount !== block.colons.length;
    const closeNeedsUpdate =
      block.closeLineIndex !== null &&
      (block.targetColonsCount !== block.closeColons.length ||
        block.closeColons.length !== block.colons.length);

    if (openNeedsUpdate || closeNeedsUpdate) {
      didRepair = true;
      adjustedCount++;

      const newColons = ":".repeat(block.targetColonsCount);
      lines[block.openLineIndex] =
        `${block.indent}${newColons}${block.space}${block.name}${block.rest}`;

      if (block.closeLineIndex !== null) {
        lines[block.closeLineIndex] = `${block.closeIndent}${newColons}`;
      }
    }
  }

  // Auto-close unclosed containers if requested
  if (options?.closeUnclosed && stack.length > 0) {
    didRepair = true;
    while (stack.length > 0) {
      const unclosed = stack.pop()!;
      adjustedCount++;
      const closerColons = ":".repeat(unclosed.targetColonsCount);
      lines.push(`${unclosed.indent}${closerColons}`);
    }
  }

  let repairedText = lines.join("\n");
  if (hasTrailingNewline) {
    repairedText += "\n";
  }

  return {
    repaired: repairedText,
    didRepair,
    adjustedCount,
  };
}

export function autoRepairMarkdown(src: string): AutoRepairResult {
  if (!src) {
    return { repaired: src, didRepair: false, repairedCount: 0 };
  }

  let text = src;
  let didRepair = false;
  let repairedCount = 0;

  // 1. Repair container nesting & unclosed containers with matching colon counts
  const nestingResult = adjustContainerNesting(text, { closeUnclosed: true });
  if (nestingResult.didRepair) {
    text = nestingResult.repaired;
    didRepair = true;
    repairedCount += nestingResult.adjustedCount;
  }

  // 2. Sanskrit brackets repair - only per-line outside code blocks, without appending to end of document
  const rawLines = text.split("\n");
  let inCodeFence = false;
  let codeFenceChar = "";
  let codeFenceLen = 0;

  const repairedLines = rawLines.map((line) => {
    const fenceMatch = line.match(/^[ \t]*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceChar = char;
        codeFenceLen = len;
        return line;
      }
      if (char === codeFenceChar && len >= codeFenceLen) {
        inCodeFence = false;
        return line;
      }
    }

    if (inCodeFence) {
      return line;
    }

    let modified = line;
    // Check line-level unclosed 《 ... 》
    const openDouble = (modified.match(/《/g) || []).length;
    const closeDouble = (modified.match(/》/g) || []).length;
    if (openDouble > closeDouble) {
      const diff = openDouble - closeDouble;
      modified += "》".repeat(diff);
      didRepair = true;
      repairedCount += diff;
    }

    // Check line-level unclosed ⟪ ... ⟫
    const openSpecial = (modified.match(/⟪/g) || []).length;
    const closeSpecial = (modified.match(/⟫/g) || []).length;
    if (openSpecial > closeSpecial) {
      const diff = openSpecial - closeSpecial;
      modified += "⟫".repeat(diff);
      didRepair = true;
      repairedCount += diff;
    }

    return modified;
  });

  if (didRepair) {
    text = repairedLines.join("\n");
  }

  return {
    repaired: text,
    didRepair,
    repairedCount,
  };
}
