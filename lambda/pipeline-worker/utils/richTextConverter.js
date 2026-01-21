/**
 * Rich Text Converter Utility
 *
 * Converts plain text or HTML to Payload Lexical RichText format
 */

/**
 * Convert plain text or HTML to Payload RichText format
 * @param {string|object} text - Text content to convert
 * @returns {object|null} Lexical RichText structure or null if empty
 */
function convertToRichText(text) {
  if (!text) return null;

  // If already rich text format, return as-is
  if (typeof text === 'object' && text.root) {
    return text;
  }

  // Convert to string if needed
  const content = String(text).trim();
  if (!content) return null;

  // Split into paragraphs
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

  // If no paragraphs, use the whole content as one
  if (paragraphs.length === 0) {
    paragraphs.push(content);
  }

  // Build Lexical structure
  const children = paragraphs.map(para => {
    // Split paragraph by single newlines to handle line breaks
    const lines = para.split(/\n/).filter(l => l.trim());

    if (lines.length <= 1) {
      // Simple paragraph
      return {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: para.trim(),
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      };
    }

    // Paragraph with line breaks
    const textChildren = [];
    lines.forEach((line, idx) => {
      if (idx > 0) {
        textChildren.push({
          type: 'linebreak',
          version: 1,
        });
      }
      textChildren.push({
        type: 'text',
        text: line.trim(),
        version: 1,
      });
    });

    return {
      type: 'paragraph',
      children: textChildren,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    };
  });

  return {
    root: {
      type: 'root',
      children: children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  };
}

/**
 * Convert HTML to Payload RichText format
 * Basic HTML support for common tags
 * @param {string} html - HTML content
 * @returns {object|null} Lexical RichText structure
 */
function convertHtmlToRichText(html) {
  if (!html) return null;

  // Strip HTML tags for now (basic conversion)
  // More sophisticated HTML parsing can be added later
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();

  return convertToRichText(text);
}

/**
 * Extract plain text from RichText structure
 * @param {object} richText - Lexical RichText structure
 * @returns {string} Plain text content
 */
function extractPlainText(richText) {
  if (!richText || !richText.root) return '';

  const extractText = (node) => {
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.type === 'linebreak') {
      return '\n';
    }
    if (node.children && Array.isArray(node.children)) {
      return node.children.map(extractText).join('');
    }
    return '';
  };

  return richText.root.children
    .map(extractText)
    .join('\n\n')
    .trim();
}

module.exports = {
  convertToRichText,
  convertHtmlToRichText,
  extractPlainText,
};
