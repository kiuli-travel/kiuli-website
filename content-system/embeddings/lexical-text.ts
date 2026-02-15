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
