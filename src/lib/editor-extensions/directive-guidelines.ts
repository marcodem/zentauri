import { StateField, RangeSetBuilder } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'

/**
 * Parses the document line by line to determine the nesting depth
 * of Markdown generic directives (`:::`).
 * Applies a left border (`box-shadow`) to lines within the directive block.
 */
export const directiveGuidelines = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state.doc)
  },
  update(decorations, tr) {
    if (tr.docChanged) {
      return buildDecorations(tr.state.doc)
    }
    return decorations
  },
  provide: f => EditorView.decorations.from(f)
})

function buildDecorations(doc: any): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const stack: { colons: number }[] = []
  
  // Cache for decorations at different depths
  const decosCache: Record<number, Decoration> = {}
  
  const getDeco = (depth: number) => {
    if (decosCache[depth]) return decosCache[depth]
    
    // Use theme-specific CSS variables
    const colors = [
      'var(--directive-l1)', // Level 1
      'var(--directive-l2)', // Level 2
      'var(--directive-l3)', // Level 3
      'var(--directive-l4)', // Level 4
      'var(--directive-l5)'  // Level 5
    ]
    
    let boxShadows = []
    for (let i = 0; i < depth; i++) {
      const color = colors[i % colors.length]
      // Use inset box-shadow to stack left borders without shifting layout width
      // level 1: 4px, level 2: 8px, etc.
      boxShadows.push(`inset ${(i + 1) * 4}px 0 0 ${color}`)
    }
    
    const deco = Decoration.line({
      attributes: {
        // Adjust padding-left so the text avoids the thick border.
        style: `box-shadow: ${boxShadows.join(', ')}; padding-left: ${depth * 4 + 8}px; transition: padding 0.1s ease;`,
        class: `cm-directive-block cm-directive-depth-${depth}`
      }
    })
    decosCache[depth] = deco
    return deco
  }

  // Iterate over every line to compute depth
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text.trim()
    const colonMatch = text.match(/^(:{3,})(.*)$/)
    
    let isClosing = false
    let isOpening = false
    
    if (colonMatch) {
      const colons = colonMatch[1].length
      const rest = colonMatch[2].trim()
      
      // Closing tag must have no extra text and >= colons of the current block
      if (rest === '' && stack.length > 0 && colons >= stack[stack.length - 1].colons) {
        isClosing = true
      } else {
        isOpening = true
      }
    }
    
    if (isOpening) {
      stack.push({ colons: colonMatch![1].length })
    }
    
    const depth = stack.length
    
    // Apply decoration to the line if it is within a block (including boundary lines)
    if (depth > 0) {
      builder.add(line.from, line.from, getDeco(depth))
    }
    
    if (isClosing) {
      stack.pop()
    }
  }
  
  return builder.finish()
}
