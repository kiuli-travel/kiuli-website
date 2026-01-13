const fs = require('fs');

console.log('='.repeat(80));
console.log('TEST 2: SEO CONTENT READINESS');
console.log('='.repeat(80));
console.log('\nPurpose: Determine if iTrvl content is SEO-ready or needs enhancement\n');

// Load scraped data
const scrapedData = JSON.parse(fs.readFileSync('./all-itineraries.json', 'utf8'));
const firstItin = scrapedData[0];
const pres = firstItin.presentation;

console.log(`Analyzing: ${pres.itineraryName}\n`);

// Extract all text content
let totalWordCount = 0;
let contentPieces = [];

// Get content from each segment
pres.segments.forEach(seg => {
  if (seg.type === 'stay' || seg.type === 'service') {
    const content = {
      type: seg.type,
      title: seg.title || '',
      description: seg.description || '',
      inclusions: seg.clientIncludeExclude || ''
    };
    
    // Count words
    const wordCount = (content.title + ' ' + content.description + ' ' + content.inclusions)
      .split(/\s+/).filter(w => w.length > 0).length;
    
    content.wordCount = wordCount;
    totalWordCount += wordCount;
    
    if (wordCount > 0) {
      contentPieces.push(content);
    }
  }
});

console.log('Content Analysis:');
console.log(`  Total word count: ${totalWordCount} words`);
console.log(`  Content segments: ${contentPieces.length}`);
console.log(`  Average per segment: ${(totalWordCount / contentPieces.length).toFixed(0)} words\n`);

// Competitor benchmarks (from research)
const benchmarks = {
  minWords: 1500,
  idealWords: 2500,
  topCompetitors: 3000,
  luxuryKeywords: ['luxury', 'exclusive', 'private', 'premier', 'bespoke'],
  safariKeywords: ['safari', 'game drive', 'wildlife', 'big five', 'conservation'],
  pricingMentions: ['price', 'cost', 'per person', 'per day', 'inclusive']
};

// Check keyword density
function countKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  let count = 0;
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) count += matches.length;
  });
  return count;
}

const allText = contentPieces.map(c => c.title + ' ' + c.description + ' ' + c.inclusions).join(' ');

const luxuryKeywordCount = countKeywords(allText, benchmarks.luxuryKeywords);
const safariKeywordCount = countKeywords(allText, benchmarks.safariKeywords);
const pricingMentions = countKeywords(allText, benchmarks.pricingMentions);

console.log('Keyword Analysis:');
console.log(`  Luxury keywords: ${luxuryKeywordCount} occurrences`);
console.log(`  Safari keywords: ${safariKeywordCount} occurrences`);
console.log(`  Pricing mentions: ${pricingMentions} occurrences\n`);

// Calculate SEO readiness score
function calculateSEOScore() {
  let score = 0;
  const factors = [];
  
  // Word count (0-40 points)
  if (totalWordCount >= benchmarks.topCompetitors) {
    score += 40;
    factors.push({ factor: 'Word Count', points: 40, status: 'Excellent (3000+ words)' });
  } else if (totalWordCount >= benchmarks.idealWords) {
    score += 30;
    factors.push({ factor: 'Word Count', points: 30, status: 'Good (2500+ words)' });
  } else if (totalWordCount >= benchmarks.minWords) {
    score += 20;
    factors.push({ factor: 'Word Count', points: 20, status: 'Acceptable (1500+ words)' });
  } else {
    score += 10;
    factors.push({ factor: 'Word Count', points: 10, status: `Poor (${totalWordCount} words)` });
  }
  
  // Luxury keyword density (0-20 points)
  if (luxuryKeywordCount >= 15) {
    score += 20;
    factors.push({ factor: 'Luxury Keywords', points: 20, status: 'Excellent' });
  } else if (luxuryKeywordCount >= 10) {
    score += 15;
    factors.push({ factor: 'Luxury Keywords', points: 15, status: 'Good' });
  } else if (luxuryKeywordCount >= 5) {
    score += 10;
    factors.push({ factor: 'Luxury Keywords', points: 10, status: 'Acceptable' });
  } else {
    score += 5;
    factors.push({ factor: 'Luxury Keywords', points: 5, status: 'Poor' });
  }
  
  // Safari keyword density (0-20 points)
  if (safariKeywordCount >= 20) {
    score += 20;
    factors.push({ factor: 'Safari Keywords', points: 20, status: 'Excellent' });
  } else if (safariKeywordCount >= 15) {
    score += 15;
    factors.push({ factor: 'Safari Keywords', points: 15, status: 'Good' });
  } else if (safariKeywordCount >= 10) {
    score += 10;
    factors.push({ factor: 'Safari Keywords', points: 10, status: 'Acceptable' });
  } else {
    score += 5;
    factors.push({ factor: 'Safari Keywords', points: 5, status: 'Poor' });
  }
  
  // Pricing transparency (0-20 points)
  if (pricingMentions >= 5) {
    score += 20;
    factors.push({ factor: 'Pricing Mentions', points: 20, status: 'Excellent' });
  } else if (pricingMentions >= 3) {
    score += 15;
    factors.push({ factor: 'Pricing Mentions', points: 15, status: 'Good' });
  } else if (pricingMentions >= 1) {
    score += 10;
    factors.push({ factor: 'Pricing Mentions', points: 10, status: 'Minimal' });
  } else {
    score += 0;
    factors.push({ factor: 'Pricing Mentions', points: 0, status: 'None' });
  }
  
  return { score, factors };
}

const seoScore = calculateSEOScore();

console.log('SEO Readiness Score: ' + seoScore.score + '/100\n');
seoScore.factors.forEach(f => {
  console.log(`  ${f.factor}: ${f.points}/20 - ${f.status}`);
});
console.log('');

// Determine gaps
const gaps = [];
const wordGap = benchmarks.minWords - totalWordCount;

if (wordGap > 0) {
  gaps.push(`Need ${wordGap} more words to reach minimum (1500)`);
}
if (luxuryKeywordCount < 10) {
  gaps.push(`Need more luxury positioning keywords (currently ${luxuryKeywordCount})`);
}
if (pricingMentions < 3) {
  gaps.push('Need explicit pricing transparency (competitors state $600-$1000/day)');
}
if (totalWordCount < benchmarks.topCompetitors) {
  gaps.push(`To match top competitors, need ${benchmarks.topCompetitors - totalWordCount} more words`);
}

console.log('Content Gaps:');
if (gaps.length === 0) {
  console.log('  ✅ No major gaps - content is SEO-ready!');
} else {
  gaps.forEach((gap, idx) => {
    console.log(`  ${idx + 1}. ${gap}`);
  });
}
console.log('');

// Generate report
const report = {
  testName: 'SEO Content Readiness',
  testedAt: new Date().toISOString(),
  itinerary: {
    id: firstItin.itineraryId,
    name: pres.itineraryName
  },
  metrics: {
    totalWords: totalWordCount,
    contentSegments: contentPieces.length,
    luxuryKeywords: luxuryKeywordCount,
    safariKeywords: safariKeywordCount,
    pricingMentions: pricingMentions
  },
  benchmarks: {
    minWords: benchmarks.minWords,
    idealWords: benchmarks.idealWords,
    topCompetitors: benchmarks.topCompetitors
  },
  seoScore: seoScore.score,
  scoreBreakdown: seoScore.factors,
  gaps: gaps,
  recommendation: seoScore.score >= 70 
    ? 'Content is SEO-ready. Minor enhancements recommended.'
    : seoScore.score >= 50
    ? 'Content needs enhancement. Gaps identified above.'
    : 'Content requires significant enhancement to compete with top-ranking pages.',
  competitorInsights: [
    'Top-ranking luxury safari pages have 1500-3000 words',
    'Competitors explicitly state pricing: "$600-$1,000 per person per day"',
    'Content structure: Overview → Detailed Itinerary → Inclusions → FAQ',
    'High density of "luxury", "exclusive", "private" positioning keywords',
    'Multiple images per section (you have this covered)'
  ],
  actionItems: gaps.length > 0 ? [
    'Use Gemini to expand content to minimum 1500 words',
    'Add luxury positioning language',
    'Include transparent pricing information',
    'Consider FAQ section for common questions'
  ] : [
    'Content is sufficient, proceed with scraper'
  ]
};

fs.writeFileSync('./test2-report.json', 
  JSON.stringify(report, null, 2));

console.log('='.repeat(80));
console.log('CONCLUSION');
console.log('='.repeat(80));
console.log(`\nSEO Score: ${seoScore.score}/100`);
console.log(`Rating: ${seoScore.score >= 70 ? 'GOOD' : seoScore.score >= 50 ? 'NEEDS WORK' : 'POOR'}`);
console.log(`\nRecommendation: ${report.recommendation}\n`);
console.log('✅ Saved test2-report.json\n');
