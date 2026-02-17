/**
 * Converts plain text (potentially with markdown-style paragraphs) to
 * Payload CMS Lexical richText JSON format.
 *
 * Splits on double-newline for paragraphs. Single newlines within a
 * paragraph are joined with a space.
 *
 * Does NOT handle markdown bold, headers, lists, or links.
 * The publisher's job is to move content, not format it.
 * Formatting is the frontend's job.
 */
export function textToLexical(text: string): Record<string, unknown> {
  if (!text || text.trim().length === 0) {
    return {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        children: [],
        direction: null,
      },
    }
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 0)

  const children = paragraphs.map((para) => ({
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    children: [
      {
        type: 'text',
        format: 0,
        text: para,
        detail: 0,
        mode: 'normal',
        style: '',
        version: 1,
      },
    ],
    direction: 'ltr',
    textFormat: 0,
    textStyle: '',
  }))

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children,
      direction: 'ltr',
    },
  }
}
