/**
 * Remark plugin: `:::` container blocks for Payer-style containers.
 *
 * Uses `remark-directive` (installed) to parse `:::` fences,
 * then transforms directive nodes into styled container elements
 * via hName/hProperties (the remark-rehype bridge).
 *
 * Supported container types (from Payer's qa_viewer.html):
 *   grammar-box, grammar-box2, media, center, metrik-schema,
 *   important, deleteme-box, note-box, laut-table,
 *   indent, compact, no-header
 *
 * Syntax:
 *   ::: grammar-box[Optional title]
 *   content
 *   :::
 *
 * The optional title in `[brackets]` is extracted from the first line
 * of the container body and rendered as `.md-box__title`.
 */
import { visit, SKIP } from 'unist-util-visit'
import type { Content } from 'mdast'

type AnyParent = { type: string; children: Content[] }

const CONTAINER_KINDS: Record<string, string> = {
  'grammarbox':     'grammarbox',
  'gramarbox':      'grammarbox',
  'grammarbox2':    'grammarbox2',
  'gramarbox2':     'grammarbox2',
  'grammar-box':    'grammarbox',
  'gramar-box':     'grammarbox',
  'grammar-box2':   'grammarbox2',
  'gramar-box2':    'grammarbox2',
  'media':          'media',
  'center':         'center',
  'metrik-schema':  'metrik-schema',
  'metrikschema':   'metrik-schema',
  'important':      'important',
  'deleteme-box':   'deleteme-box',
  'deletemebox':    'deleteme-box',
  'note-box':       'note-box',
  'notebox':        'note-box',
  'laut-table':     'laut-table',
  'lauttable':      'laut-table',
  'indent':         'indent',
  'compact':        'compact',
  'no-header':      'no-header',
  'noheader':       'no-header',
}

/**
 * Remark plugin that converts `containerDirective` nodes (from
 * `remark-directive`) into our styled container `<div>` elements.
 *
 * Uses the hName/hProperties bridge so remark-rehype generates the
 * correct HTML structure, preserving sandboxed rendering.
 *
 * Must be placed **after** `remarkDirective` in the processor pipeline.
 */
import type { ContainerDirective } from 'mdast-util-directive'

export default function remarkBoxes(this: unknown): (tree: import('mdast').Root) => void {
  return (tree: import('mdast').Root): void => {
    visit(tree, 'containerDirective', (node: ContainerDirective, index: number | undefined, parent: import('mdast').Parent | undefined) => {
      if (!parent || index === undefined) return
      const kind = (node.name != null ? CONTAINER_KINDS[node.name.toLowerCase()] : undefined)
      if (!kind) return // Unknown directive — skip

      const tagName = (kind === 'important') ? 'aside' : 'div'

      // ── Build children ──
      const containerChildren: Content[] = [...(node.children ?? [])]

      const hProps: Record<string, unknown> = {
        className: ['md-box', `md-box--${kind}`],
        'data-box-kind': kind,
      }

      // Mutate the node IN PLACE so unist-util-visit traverses the new structure correctly
      // without needing complex return values or duplicate visit hacks.
      // We cast to any to overwrite 'type' which is usually readonly in TS AST.
      const n = node as any;
      n.type = 'paragraph';
      n.data = {
        hName: tagName,
        hProperties: hProps,
      };
      
      n.children = [
        // Inner wrapper
        {
          type: 'paragraph',
          data: {
            hName: 'div',
            hProperties: { className: ['md-box__inner'] },
          },
          children: [
            // Body wrapper (title is already in containerChildren)
            {
              type: 'paragraph',
              data: {
                hName: 'div',
                hProperties: { className: ['md-box__body'] },
              },
              children: containerChildren,
            } as Content,
          ],
        } as Content,
      ];
    })
  }
}