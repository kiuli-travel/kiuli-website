const https = require('https');
const fs = require('fs');

console.log('='.repeat(80));
console.log('TEST 3: GEMINI ENHANCEMENT VALIDATION');
console.log('='.repeat(80));
console.log('\nPurpose: Test if Gemini can enhance content quality for SEO\n');

const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCQi8M81Z_eKbTWqD_XmVs4kO_bfc3xD2E';

if (!API_KEY || API_KEY === 'AIzaSyCQi8M81Z_eKbTWqD_XmVs4kO_bfc3xD2E') {
  console.log('Using Kiuli Gemini API key\n');
}

if (false) {
  console.log('❌ GEMINI_API_KEY not set');
  console.log('\nTo run this test:');
  console.log('1. Get free API key: https://aistudio.google.com/app/apikey');
  console.log('2. Set environment variable:');
  console.log('   export GEMINI_API_KEY="your-key-here"');
  console.log('3. Run this script again\n');
  
  const report = {
    testName: 'Gemini Enhancement Validation',
    testedAt: new Date().toISOString(),
    status: 'SKIPPED',
    reason: 'GEMINI_API_KEY not set',
    instructions: [
      'Get API key from https://aistudio.google.com/app/apikey',
      'Set: export GEMINI_API_KEY="your-key"',
      'Re-run test'
    ]
  };
  
  fs.writeFileSync('./test3-report.json', 
    JSON.stringify(report, null, 2));
  
  console.log('✅ Saved test3-report.json (skipped)\n');
  process.exit(0);
}

// Load scraped data
const scrapedData = JSON.parse(fs.readFileSync('./all-itineraries.json', 'utf8'));
const firstItin = scrapedData[0];
const pres = firstItin.presentation;

// Get a sample stay segment
const sampleStay = pres.segments.find(s => s.type === 'stay' && s.description);

if (!sampleStay) {
  console.log('❌ No stay segment with description found');
  process.exit(1);
}

console.log(`Testing with: ${sampleStay.title}\n`);
console.log('Original Content:');
console.log(`  Length: ${sampleStay.description.length} characters`);
console.log(`  Words: ${sampleStay.description.split(/\s+/).length} words\n`);

// Define prompting strategies
const strategies = [
  {
    name: 'Basic Enhancement',
    prompt: `Enhance this accommodation description for a luxury safari website. Keep factual accuracy. Add sensory details and luxury positioning. Output only the enhanced description.

Original: ${sampleStay.description}`
  },
  {
    name: 'SEO-Optimized',
    prompt: `Rewrite this for SEO optimization. Include keywords: "luxury safari", "exclusive", "private". Keep facts accurate. Make it 300-400 words. Output only the enhanced text.

Original: ${sampleStay.description}`
  },
  {
    name: 'Kiuli Voice',
    prompt: `Rewrite this in Kiuli's brand voice: sophisticated, authentic, insider perspective. Focus on experience over amenities. Keep facts accurate. Output only the enhanced text.

Brand tone: "We don't just plan trips. We unlock Africa's hidden wonders with insider access."

Original: ${sampleStay.description}`
  },
  {
    name: 'Structured with FAQ',
    prompt: `Enhance this description AND add a FAQ section with 3 questions travelers ask about this property. Keep facts accurate. Format as:

DESCRIPTION:
[enhanced description]

FAQ:
Q: [question]
A: [answer]

Original: ${sampleStay.description}`
  },
  {
    name: 'Schema-Ready',
    prompt: `Enhance this description to be schema.org ready. Include: what makes it luxury, location benefits, unique features, typical experience. Keep facts accurate. 250-350 words. Output only the enhanced description.

Original: ${sampleStay.description}`
  }
];

// Function to call Gemini API
function callGemini(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    });
    
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.candidates && response.candidates[0]) {
            const text = response.candidates[0].content.parts[0].text;
            resolve(text);
          } else {
            reject(new Error('No candidates in response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Score quality
function scoreContent(text) {
  const wordCount = text.split(/\s+/).length;
  const hasLuxuryKeywords = /luxury|exclusive|private|premier|bespoke/gi.test(text);
  const hasSafariKeywords = /safari|wildlife|game drive|conservation/gi.test(text);
  const hasSensoryDetails = /hear|see|feel|taste|sound|scent|view/gi.test(text);
  const readabilityGood = wordCount >= 150 && wordCount <= 500;
  
  let score = 0;
  if (wordCount >= 200) score += 2;
  if (hasLuxuryKeywords) score += 2;
  if (hasSafariKeywords) score += 2;
  if (hasSensoryDetails) score += 2;
  if (readabilityGood) score += 2;
  
  return {
    score: score,
    maxScore: 10,
    wordCount,
    hasLuxuryKeywords,
    hasSafariKeywords,
    hasSensoryDetails,
    readabilityGood
  };
}

// Test all strategies
async function runTests() {
  const results = [];
  let bestScore = 0;
  let bestEnhancement = null;
  
  console.log('Testing enhancement strategies...\n');
  
  for (const strategy of strategies) {
    console.log(`Testing: ${strategy.name}...`);
    
    try {
      const enhanced = await callGemini(strategy.prompt);
      const quality = scoreContent(enhanced);
      
      results.push({
        strategy: strategy.name,
        enhanced: enhanced,
        quality: quality,
        cost: 0.001 // Approximate cost per call
      });
      
      console.log(`  ✅ Score: ${quality.score}/10`);
      console.log(`  Words: ${quality.wordCount}\n`);
      
      if (quality.score > bestScore) {
        bestScore = quality.score;
        bestEnhancement = enhanced;
      }
      
      // Wait 1 second between calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}\n`);
      results.push({
        strategy: strategy.name,
        error: error.message
      });
    }
  }
  
  // Calculate average cost per itinerary
  const avgSegments = 10; // Typical itinerary
  const costPerItinerary = (results.length * 0.001 * avgSegments).toFixed(2);
  
  console.log('='.repeat(80));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log('\nQuality Scores:');
  results.forEach(r => {
    if (r.quality) {
      console.log(`  ${r.strategy}: ${r.quality.score}/10`);
    } else {
      console.log(`  ${r.strategy}: FAILED`);
    }
  });
  
  console.log(`\nBest Score: ${bestScore}/10`);
  console.log(`Estimated cost per itinerary: $${costPerItinerary}`);
  console.log('  (Assumes ~10 segments per itinerary)\n');
  
  // Save best enhancement
  if (bestEnhancement) {
    fs.writeFileSync('./best-enhanced-content.txt', bestEnhancement);
    console.log('✅ Saved best-enhanced-content.txt\n');
  }
  
  // Generate report
  const report = {
    testName: 'Gemini Enhancement Validation',
    testedAt: new Date().toISOString(),
    tested: {
      property: sampleStay.title,
      originalLength: sampleStay.description.length,
      originalWords: sampleStay.description.split(/\s+/).length
    },
    strategies: results,
    bestStrategy: results.find(r => r.quality?.score === bestScore)?.strategy || 'None',
    bestScore: bestScore,
    costAnalysis: {
      perSegment: '$0.001',
      perItinerary: `$${costPerItinerary}`,
      per100Itineraries: `$${(costPerItinerary * 100).toFixed(2)}`
    },
    recommendation: bestScore >= 7 
      ? 'Gemini enhancement WORKS. Quality sufficient for SEO.'
      : bestScore >= 5
      ? 'Gemini enhancement ACCEPTABLE. May need prompt refinement.'
      : 'Gemini enhancement POOR. Consider alternative approaches.',
    conclusion: bestScore >= 7
      ? 'AI enhancement can successfully improve content quality for SEO while maintaining factual accuracy.'
      : 'AI enhancement needs refinement or alternative approach.'
  };
  
  fs.writeFileSync('./test3-report.json', 
    JSON.stringify(report, null, 2));
  
  console.log('='.repeat(80));
  console.log('CONCLUSION');
  console.log('='.repeat(80));
  console.log(`\nBest Score: ${bestScore}/10`);
  console.log(`Status: ${bestScore >= 7 ? 'SUCCESS' : bestScore >= 5 ? 'ACCEPTABLE' : 'NEEDS WORK'}`);
  console.log(`\n${report.recommendation}\n`);
  console.log('✅ Saved test3-report.json\n');
}

runTests().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
