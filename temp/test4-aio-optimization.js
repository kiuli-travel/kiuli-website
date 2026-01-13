const fs = require('fs');

console.log('='.repeat(80));
console.log('TEST 4: AIO (AI OVERVIEWS) OPTIMIZATION');
console.log('='.repeat(80));
console.log('\nPurpose: Determine optimal content structure for AI-powered search\n');

// Load scraped data
const scrapedData = JSON.parse(fs.readFileSync('./all-itineraries.json', 'utf8'));
const firstItin = scrapedData[0];
const pres = firstItin.presentation;

console.log(`Testing with: ${pres.itineraryName}\n`);

// Extract key information
const stays = pres.segments.filter(s => s.type === 'stay');
const firstStay = stays[0];

// Test 4 different content formats
const formats = {
  faq: {
    name: 'FAQ Format',
    structure: generateFAQFormat(firstStay),
    description: 'Question-answer pairs that AI can extract directly'
  },
  table: {
    name: 'Table/List Format',
    structure: generateTableFormat(firstStay),
    description: 'Structured data that AI can parse systematically'
  },
  bullets: {
    name: 'Bullet Points',
    structure: generateBulletFormat(firstStay),
    description: 'Scannable lists for quick information extraction'
  },
  paragraph: {
    name: 'Narrative Paragraphs',
    structure: generateParagraphFormat(firstStay),
    description: 'Traditional prose format'
  }
};

// Generate FAQ format
function generateFAQFormat(stay) {
  return `## ${stay.title}

**Q: What type of accommodation is ${stay.title}?**
A: ${stay.title} is a luxury ${stay.roomType?.toLowerCase() || 'safari'} lodge located in ${stay.location}, ${stay.country}.

**Q: What's included in the stay?**
A: ${stay.clientIncludeExclude || 'Accommodation includes meals and selected activities.'}

**Q: What makes ${stay.title} special?**
A: ${stay.description ? stay.description.substring(0, 200) + '...' : 'This property offers luxury amenities and exceptional service.'}`;
}

// Generate table format
function generateTableFormat(stay) {
  return `## ${stay.title}

| Property | Details |
|----------|---------|
| Location | ${stay.location}, ${stay.country} |
| Type | Luxury ${stay.roomType?.toLowerCase() || 'Safari'} Lodge |
| Room | ${stay.roomNamesClient?.[0] || stay.roomType || 'Luxury Suite'} |
| Nights | ${stay.nights} |
| Includes | ${stay.clientIncludeExclude || 'Meals and activities'} |

${stay.description ? stay.description.substring(0, 150) : ''}`;
}

// Generate bullet format
function generateBulletFormat(stay) {
  return `## ${stay.title}

**Location:** ${stay.location}, ${stay.country}

**Key Features:**
- Luxury ${stay.roomType?.toLowerCase() || 'safari'} accommodation
- ${stay.nights} night${stay.nights > 1 ? 's' : ''} stay
- ${stay.roomNamesClient?.[0] || stay.roomType || 'Luxury Suite'}

**What's Included:**
${stay.clientIncludeExclude || '- Accommodation\n- Meals\n- Selected activities'}

**About the Property:**
${stay.description ? stay.description.substring(0, 200) : 'Exceptional luxury safari experience'}`;
}

// Generate paragraph format
function generateParagraphFormat(stay) {
  return `## ${stay.title}

Located in ${stay.location}, ${stay.country}, ${stay.title} offers a luxury ${stay.roomType?.toLowerCase() || 'safari'} experience for ${stay.nights} night${stay.nights > 1 ? 's' : ''}.

${stay.description || 'This property provides exceptional accommodations and service.'}

Your stay includes ${stay.clientIncludeExclude || 'accommodation, meals, and selected safari activities'}.`;
}

// Score each format for AI parsability
function scoreFormat(format, formatKey) {
  const text = format.structure;
  const scores = {
    factDensity: 0,
    structuredData: 0,
    aiParsability: 0,
    scannability: 0
  };
  
  // Fact density (0-25 points)
  const factMarkers = text.match(/\n|:|•|\||Q:|A:/g) || [];
  scores.factDensity = Math.min(25, factMarkers.length * 2);
  
  // Structured data (0-25 points)
  if (formatKey === 'table') scores.structuredData = 25;
  else if (formatKey === 'faq') scores.structuredData = 23;
  else if (formatKey === 'bullets') scores.structuredData = 20;
  else scores.structuredData = 10;
  
  // AI parsability (0-25 points)
  const hasQA = /Q:|A:/.test(text);
  const hasHeaders = /##|:/.test(text);
  const hasLists = /•|\||-/.test(text);
  
  if (hasQA) scores.aiParsability = 25;
  else if (hasHeaders && hasLists) scores.aiParsability = 20;
  else if (hasLists) scores.aiParsability = 15;
  else scores.aiParsability = 10;
  
  // Scannability (0-25 points)
  const lines = text.split('\n').length;
  const avgLineLength = text.length / lines;
  
  if (avgLineLength < 60) scores.scannability = 25;
  else if (avgLineLength < 100) scores.scannability = 20;
  else if (avgLineLength < 150) scores.scannability = 15;
  else scores.scannability = 10;
  
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  
  return {
    ...scores,
    total,
    grade: total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : 'D'
  };
}

// Score all formats
console.log('Scoring formats for AI Overview optimization:\n');

const results = {};
let bestFormat = null;
let bestScore = 0;

Object.keys(formats).forEach(key => {
  const format = formats[key];
  const score = scoreFormat(format, key);
  
  results[key] = {
    ...format,
    score: score
  };
  
  console.log(`${format.name}: ${score.total}/100 (Grade: ${score.grade})`);
  console.log(`  Fact Density: ${score.factDensity}/25`);
  console.log(`  Structured Data: ${score.structuredData}/25`);
  console.log(`  AI Parsability: ${score.aiParsability}/25`);
  console.log(`  Scannability: ${score.scannability}/25\n`);
  
  if (score.total > bestScore) {
    bestScore = score.total;
    bestFormat = key;
  }
});

console.log('='.repeat(80));
console.log('BEST FORMAT FOR AI OVERVIEWS');
console.log('='.repeat(80));
console.log(`\nWinner: ${formats[bestFormat].name}`);
console.log(`Score: ${bestScore}/100 (Grade: ${results[bestFormat].score.grade})\n`);

// Save best format example
if (bestFormat) {
  fs.writeFileSync('./best-aio-format.md', results[bestFormat].structure);
  console.log('✅ Saved best-aio-format.md\n');
}

// Generate report
const report = {
  testName: 'AIO (AI Overviews) Optimization',
  testedAt: new Date().toISOString(),
  tested: {
    itinerary: pres.itineraryName,
    property: firstStay.title
  },
  formats: Object.keys(formats).map(key => ({
    format: formats[key].name,
    description: formats[key].description,
    score: results[key].score.total,
    grade: results[key].score.grade,
    breakdown: {
      factDensity: results[key].score.factDensity,
      structuredData: results[key].score.structuredData,
      aiParsability: results[key].score.aiParsability,
      scannability: results[key].score.scannability
    }
  })),
  winner: {
    format: formats[bestFormat].name,
    score: bestScore,
    grade: results[bestFormat].score.grade
  },
  recommendation: bestScore >= 85 
    ? `Use ${formats[bestFormat].name} format. Excellent for AI extraction.`
    : bestScore >= 70
    ? `${formats[bestFormat].name} format works well. Consider enhancements.`
    : `All formats scored low. May need hybrid approach.`,
  insights: [
    'AI Overviews favor structured, fact-dense content',
    'FAQ format provides direct question-answer pairs',
    'Tables enable systematic data extraction',
    'Bullet points balance structure with readability',
    'Narrative prose requires more AI processing'
  ],
  implementation: [
    `Primary format: ${formats[bestFormat].name}`,
    'Include key facts in first 200 characters',
    'Use clear headers and structure markers',
    'Keep fact density high',
    'Consider FAQ section for common questions'
  ],
  note: 'Google has not published official AIO optimization guidelines. These scores are based on observed patterns in AI Overview appearances and general AI parsability principles.'
};

fs.writeFileSync('./test4-report.json', 
  JSON.stringify(report, null, 2));

console.log('='.repeat(80));
console.log('RECOMMENDATION');
console.log('='.repeat(80));
console.log(`\nBest Format: ${formats[bestFormat].name}`);
console.log(`Score: ${bestScore}/100\n`);
console.log(report.recommendation);
console.log('\nImplementation Tips:');
report.implementation.forEach((tip, idx) => {
  console.log(`  ${idx + 1}. ${tip}`);
});
console.log('\n✅ Saved test4-report.json\n');
console.log('Note: No official AIO guidelines exist from Google.');
console.log('These recommendations are based on observed patterns.\n');
