/**
 * Convert markdown text to Payload's Lexical richText JSON format.
 * Handles headings (h1-h3) and paragraphs. Shared between research
 * route and conversation handler.
 */
export function markdownToLexical(text: string): any {
  const lines = text.split('\n')
  const children: any[] = []
  let currentParagraphTexts: string[] = []

  function flushParagraph() {
    if (currentParagraphTexts.length > 0) {
      const joined = currentParagraphTexts.join('\n')
      if (joined.trim()) {
        children.push({
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'text',
              version: 1,
              text: joined,
              format: 0,
              mode: 'normal',
              style: '',
              detail: 0,
            },
          ],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          textFormat: 0,
          textStyle: '',
        })
      }
      currentParagraphTexts = []
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      const level = headingMatch[1].length
      children.push({
        type: 'heading',
        version: 1,
        tag: `h${level}`,
        children: [
          {
            type: 'text',
            version: 1,
            text: headingMatch[2],
            format: 0,
            mode: 'normal',
            style: '',
            detail: 0,
          },
        ],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
      })
    } else if (line.trim() === '') {
      flushParagraph()
    } else {
      currentParagraphTexts.push(line)
    }
  }
  flushParagraph()

  return {
    root: {
      type: 'root',
      version: 1,
      children,
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
    },
  }
}
