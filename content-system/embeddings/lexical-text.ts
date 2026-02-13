/**
 * Extract plain text from Payload's Lexical JSON rich text format.
 * Recursively walks all children arrays, collecting leaf text nodes.
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
    // Join paragraphs/blocks with newline, inline content without separator
    const isParagraph = n.type === 'paragraph' || n.type === 'heading' || n.type === 'listitem'
    return isParagraph ? parts.join('') : parts.join('\n')
  }

  return ''
}
