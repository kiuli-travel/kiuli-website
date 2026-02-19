/**
 * Extract plain text from Payload's Lexical JSON rich text format.
 * Recursively walks all children arrays, collecting leaf text nodes.
 * Preserves paragraph boundaries with double newlines for downstream rendering.
 */
export function extractTextFromLexical(lexicalJson: unknown): string {
  if (!lexicalJson || typeof lexicalJson !== 'object') return ''

  try {
    const root = (lexicalJson as Record<string, unknown>).root
    if (!root) return ''
    return extractNode(root).trim()
  } catch {
    return ''
  }
}

/**
 * Extract heading text from Lexical JSON by walking the AST.
 * Returns an array of heading strings in document order.
 * Position 0 = first heading, Position 1 = second heading, etc.
 * This matches the publisher's heading index system.
 */
export function extractHeadingsFromLexical(lexicalJson: unknown): string[] {
  if (!lexicalJson || typeof lexicalJson !== 'object') return []
  const root = (lexicalJson as Record<string, unknown>).root
  if (!root || typeof root !== 'object') return []
  const children = (root as Record<string, unknown>).children
  if (!Array.isArray(children)) return []

  const headings: string[] = []
  for (const child of children) {
    if (child && typeof child === 'object' && (child as Record<string, unknown>).type === 'heading') {
      const text = extractNode(child)
      if (text.trim()) headings.push(text.trim())
    }
  }
  return headings
}

function extractNode(node: unknown): string {
  if (!node || typeof node !== 'object') return ''

  const n = node as Record<string, unknown>

  // Leaf text node
  if (typeof n.text === 'string') return n.text

  // Recurse into children
  if (Array.isArray(n.children)) {
    const parts: string[] = []
    for (const child of n.children) {
      const text = extractNode(child)
      if (text) parts.push(text)
    }

    const type = n.type as string | undefined

    // Inline containers (paragraph, heading, listitem): join children without separator
    if (type === 'paragraph' || type === 'heading' || type === 'listitem') {
      return parts.join('')
    }

    // Block containers (root, list, etc.): join children with double newline
    // to preserve paragraph boundaries
    return parts.join('\n\n')
  }

  return ''
}
