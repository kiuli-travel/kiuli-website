function formatFaq(enhancedData) {
  console.log('[FAQ] Formatting FAQ HTML');

  const segments = [];
  findSegmentsForFaq(enhancedData, segments);

  let html = '<div class="faq-section" itemscope itemtype="https://schema.org/FAQPage">\n';

  let dayNum = 0;
  for (const segment of segments) {
    dayNum++;
    const title = segment.title || segment.name || `Day ${dayNum}`;
    const description = segment.enhancedDescription || segment.description || '';

    if (!description) continue;

    html += `  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">\n`;
    html += `    <h3 itemprop="name">What's included in ${title}?</h3>\n`;
    html += `    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n`;
    html += `      <div itemprop="text">${escapeHtml(description)}</div>\n`;
    html += `    </div>\n`;
    html += `  </div>\n`;
  }

  html += '</div>';

  console.log(`[FAQ] Generated FAQ with ${dayNum} questions`);
  return html;
}

function findSegmentsForFaq(obj, segments, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return;

  if (Array.isArray(obj)) {
    obj.forEach(item => findSegmentsForFaq(item, segments, depth + 1));
  } else {
    if ((obj.description || obj.enhancedDescription) && (obj.title || obj.name)) {
      segments.push(obj);
    }
    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        findSegmentsForFaq(value, segments, depth + 1);
      }
    }
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { formatFaq };
