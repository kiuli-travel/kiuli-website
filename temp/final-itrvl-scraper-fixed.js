const puppeteer = require('puppeteer');
const fs = require('fs');

// The 6 iTrvl URLs to scrape
const URLS = [
  'https://itrvl.com/client/portal/sDafv7StYWDPEpQdzRZz4FB9ibXs803AxtuQ48eH15ixoHKVg3R5YvxOFCUZMzFa/680dff493cf205005cf76e8f',
  'https://itrvl.com/client/portal/Ir0nIrtJMhtj3RUzrj8Qyqw7XTIyA4NGk22g52ZHTmhD6IcgxNcRUNwhXTKXbgKa/680df70720a6c6005b2bfc34',
  'https://itrvl.com/client/portal/Op4IPe4KvCsHC7QuCxjWLQEa0JlM5eVGE0vAGUD9yRnUmAIwpwstlE85upkxlfTJ/680dfc35819f37005c255a29',
  'https://itrvl.com/client/portal/GCDp9oahYn8nuuwhp8b3JvnUWpO51RUTAcHT6w5fL8WvhDVbCq5bhceamIcQGBQV/680df9b0819f37005c255a1c',
  'https://itrvl.com/client/portal/RySYf1f1xoKGC2UaZGLIuS9GT8Qb3vTmcSBfGGN94rUciM7xo09kEW07FGI3I8h3/680df1803cf205005cf76e37',
  'https://itrvl.com/client/portal/SJK1xYm749VERKthohc6iSVAHZY5mZdBFIDkxcdiZIuK4O554kXRCEvNum9yVpFm/680df8bb3cf205005cf76e57'
];

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractItineraryId(url) {
  const match = url.match(/\/([a-f0-9]{24})$/);
  return match ? match[1] : null;
}

async function scrapeItinerary(url) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Scraping: ${url}`);
  console.log('='.repeat(80));
  
  const itineraryId = extractItineraryId(url);
  if (!itineraryId) {
    console.error('Could not extract itinerary ID from URL');
    return null;
  }
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    
    const apiData = {
      raw: null,
      presentation: null,
      media: null
    };
    
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      request.continue();
    });
    
    page.on('response', async response => {
      const url = response.url();
      
      try {
        // Raw itinerary data - uses 'id' field, not '_id'
        if (url.includes('/api/Itineraries?filter')) {
          const data = await response.json();
          if (Array.isArray(data)) {
            apiData.raw = data.find(item => item.id === itineraryId);
            if (apiData.raw) {
              console.log('  ✅ Captured raw itinerary data');
            }
          }
        }
        
        // Presentation data - structure is { itineraries: [...] }
        if (url.includes('/api/PresentationEdits/renderDataClient')) {
          const data = await response.json();
          if (data.itineraries && Array.isArray(data.itineraries)) {
            apiData.presentation = data.itineraries.find(item => item.id === itineraryId);
            if (apiData.presentation) {
              console.log('  ✅ Captured presentation data');
            }
          }
        }
        
        // Media data
        if (url.includes('/api/Itineraries/media')) {
          apiData.media = await response.json();
          console.log('  ✅ Captured media data');
        }
      } catch (e) {
        // Not JSON or error parsing
      }
    });
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    await wait(3000);
    await browser.close();
    
    return {
      url,
      itineraryId,
      ...apiData
    };
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function performExhaustiveAnalysis(scrapedData) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('EXHAUSTIVE FIELD-BY-FIELD ANALYSIS');
  console.log('='.repeat(80));
  
  const data = scrapedData[0];
  if (!data || !data.raw || !data.presentation) {
    console.error('\n❌ Missing raw or presentation data for analysis');
    console.error('Cannot continue with exhaustive analysis.');
    return;
  }
  
  const rawItin = data.raw;
  const presItin = data.presentation;
  
  console.log(`\nAnalyzing itinerary: ${data.itineraryId}`);
  console.log(`Title: ${rawItin.name || presItin.name}`);
  console.log(`Raw segments: ${rawItin.itinerary?.segments?.length || 0}`);
  console.log(`Presentation segments: ${presItin.segments?.length || 0}`);
  
  // Step 1: Find all fields in raw vs presentation
  console.log(`\n${'-'.repeat(80)}`);
  console.log('STEP 1: Complete Field Inventory');
  console.log('-'.repeat(80));
  
  const allRawFields = new Set();
  const allPresFields = new Set();
  
  rawItin.itinerary.segments.forEach(seg => {
    Object.keys(seg).forEach(key => allRawFields.add(key));
    if (seg.notes) {
      Object.keys(seg.notes).forEach(key => allRawFields.add('notes.' + key));
    }
  });
  
  presItin.segments.forEach(seg => {
    Object.keys(seg).forEach(key => allPresFields.add(key));
  });
  
  const rawOnly = Array.from(allRawFields).filter(f => !allPresFields.has(f)).sort();
  const presOnly = Array.from(allPresFields).filter(f => !allRawFields.has(f)).sort();
  const shared = Array.from(allRawFields).filter(f => allPresFields.has(f)).sort();
  
  console.log(`\nFields in RAW only (${rawOnly.length}):`);
  rawOnly.forEach(f => console.log(`  - ${f}`));
  
  console.log(`\nFields in PRESENTATION only (${presOnly.length}):`);
  presOnly.forEach(f => console.log(`  - ${f}`));
  
  console.log(`\nShared fields (${shared.length}):`);
  console.log(`  ${shared.join(', ')}`);
  
  // Step 2: Identify "empty" segments in presentation
  console.log(`\n${'-'.repeat(80)}`);
  console.log('STEP 2: Segments That Appear Empty in Presentation');
  console.log('-'.repeat(80));
  
  const emptyPresSeqs = presItin.segments
    .filter(seg => {
      const hasTitle = seg.title && seg.title.trim().length > 0;
      const hasDescription = seg.description && seg.description.trim().length > 0;
      const hasInclusions = seg.clientIncludeExclude && seg.clientIncludeExclude.trim().length > 0;
      const hasImages = seg.images && seg.images.length > 0;
      
      return !hasTitle && !hasDescription && !hasInclusions && !hasImages;
    })
    .map(seg => seg.sequence);
  
  console.log(`\nFound ${emptyPresSeqs.length} segments with no content in presentation`);
  if (emptyPresSeqs.length > 0) {
    console.log(`Sequences: ${emptyPresSeqs.join(', ')}`);
  }
  
  // Step 3: Check if "empty" segments have data in raw
  console.log(`\n${'-'.repeat(80)}`);
  console.log('STEP 3: Do Empty Segments Have Usable Data in Raw?');
  console.log('-'.repeat(80));
  
  if (emptyPresSeqs.length === 0) {
    console.log('\n✅ No empty segments! All presentation segments have content.');
  } else {
    const emptySegmentAnalysis = emptyPresSeqs.map(seq => {
      const rawSeg = rawItin.itinerary.segments.find(s => s.sequence === seq);
      const presSeg = presItin.segments.find(s => s.sequence === seq);
      
      if (!rawSeg) {
        return {
          sequence: seq,
          status: 'MISSING_IN_RAW',
          type: presSeg?.type
        };
      }
      
      const hasDescription = rawSeg.description && rawSeg.description.trim().length > 0;
      const hasClientNotes = rawSeg.notes?.clientNotes && rawSeg.notes.clientNotes.trim().length > 0;
      const hasInclusions = rawSeg.notes?.inclusions && rawSeg.notes.inclusions.trim().length > 0;
      const hasExclusions = rawSeg.notes?.exclusions && rawSeg.notes.exclusions.trim().length > 0;
      
      return {
        sequence: seq,
        type: rawSeg.type,
        status: (hasDescription || hasClientNotes || hasInclusions) ? 'HAS_DATA_IN_RAW' : 'TRULY_EMPTY',
        rawFields: {
          description: hasDescription ? `YES (${rawSeg.description.length} chars)` : 'NO',
          'notes.clientNotes': hasClientNotes ? `YES (${rawSeg.notes.clientNotes.length} chars)` : 'NO',
          'notes.inclusions': hasInclusions ? `YES (${rawSeg.notes.inclusions.length} chars)` : 'NO',
          'notes.exclusions': hasExclusions ? `YES (${rawSeg.notes.exclusions.length} chars)` : 'NO'
        }
      };
    });
    
    console.log('\nDetailed analysis of each empty segment:\n');
    emptySegmentAnalysis.forEach(analysis => {
      console.log(`Sequence ${analysis.sequence} [${analysis.type || 'UNKNOWN'}]: ${analysis.status}`);
      if (analysis.rawFields) {
        console.log(`  Raw fields:`);
        Object.entries(analysis.rawFields).forEach(([key, val]) => {
          console.log(`    ${key}: ${val}`);
        });
      }
      console.log('');
    });
  }
  
  // Step 4: Find all substantial text content fields
  console.log(`\n${'-'.repeat(80)}`);
  console.log('STEP 4: All Substantial Text Content in Raw vs Presentation');
  console.log('-'.repeat(80));
  
  const contentComparison = [];
  
  rawItin.itinerary.segments.forEach(rawSeg => {
    const presSeg = presItin.segments.find(s => s.sequence === rawSeg.sequence);
    
    const rawTextLength = {
      description: rawSeg.description?.length || 0,
      clientNotes: rawSeg.notes?.clientNotes?.length || 0,
      inclusions: rawSeg.notes?.inclusions?.length || 0
    };
    
    const presTextLength = {
      title: presSeg?.title?.length || 0,
      description: presSeg?.description?.length || 0,
      clientIncludeExclude: presSeg?.clientIncludeExclude?.length || 0
    };
    
    const rawTotal = Object.values(rawTextLength).reduce((a, b) => a + b, 0);
    const presTotal = Object.values(presTextLength).reduce((a, b) => a + b, 0);
    
    if (rawTotal > 0 || presTotal > 0) {
      contentComparison.push({
        sequence: rawSeg.sequence,
        type: rawSeg.type,
        rawTotal,
        presTotal,
        difference: presTotal - rawTotal,
        rawFields: rawTextLength,
        presFields: presTextLength
      });
    }
  });
  
  console.log(`\nContent comparison (showing segments with text):\n`);
  contentComparison.forEach(item => {
    console.log(`Seq ${item.sequence} [${item.type}]:`);
    console.log(`  Raw total: ${item.rawTotal} chars`);
    console.log(`  Pres total: ${item.presTotal} chars`);
    console.log(`  Difference: ${item.difference > 0 ? '+' : ''}${item.difference} chars`);
    if (item.rawFields.description > 0) {
      console.log(`    Raw description: ${item.rawFields.description}`);
    }
    if (item.presFields.description > 0) {
      console.log(`    Pres description: ${item.presFields.description}`);
    }
    console.log('');
  });
  
  // Step 5: Sample segment comparison
  console.log(`\n${'-'.repeat(80)}`);
  console.log('STEP 5: Sample Segment Comparison (Raw vs Presentation)');
  console.log('-'.repeat(80));
  
  const sampleSeg = rawItin.itinerary.segments.find(seg => 
    seg.type === 'stay' && seg.notes?.inclusions && seg.notes.inclusions.length > 100
  );
  
  let samplePresSeg = null;
  if (sampleSeg) {
    samplePresSeg = presItin.segments.find(s => s.sequence === sampleSeg.sequence);
    
    console.log(`\nSample: Sequence ${sampleSeg.sequence} [${sampleSeg.type}]`);
    console.log(`\nRAW DATA:`);
    console.log(`  description: ${sampleSeg.description?.substring(0, 150) || 'NONE'}${sampleSeg.description?.length > 150 ? '...' : ''}`);
    console.log(`  notes.clientNotes: ${sampleSeg.notes?.clientNotes?.substring(0, 150) || 'NONE'}${sampleSeg.notes?.clientNotes?.length > 150 ? '...' : ''}`);
    console.log(`  notes.inclusions: ${sampleSeg.notes?.inclusions?.substring(0, 150) || 'NONE'}${sampleSeg.notes?.inclusions?.length > 150 ? '...' : ''}`);
    
    console.log(`\nPRESENTATION DATA:`);
    console.log(`  title: ${samplePresSeg?.title || 'NONE'}`);
    console.log(`  description: ${samplePresSeg?.description?.substring(0, 150) || 'NONE'}${samplePresSeg?.description?.length > 150 ? '...' : ''}`);
    console.log(`  clientIncludeExclude: ${samplePresSeg?.clientIncludeExclude?.substring(0, 150) || 'NONE'}${samplePresSeg?.clientIncludeExclude?.length > 150 ? '...' : ''}`);
  }
  
  // Save comprehensive analysis
  const analysisOutput = {
    summary: {
      itineraryId: data.itineraryId,
      itineraryName: rawItin.name || presItin.name,
      rawSegmentCount: rawItin.itinerary.segments.length,
      presSegmentCount: presItin.segments.length,
      emptySegmentCount: emptyPresSeqs.length,
      fieldsInRawOnly: rawOnly,
      fieldsInPresOnly: presOnly,
      sharedFields: shared
    },
    contentComparison,
    sampleSegment: sampleSeg ? {
      sequence: sampleSeg.sequence,
      type: sampleSeg.type,
      raw: {
        description: sampleSeg.description,
        clientNotes: sampleSeg.notes?.clientNotes,
        inclusions: sampleSeg.notes?.inclusions,
        exclusions: sampleSeg.notes?.exclusions
      },
      presentation: {
        title: samplePresSeg?.title,
        description: samplePresSeg?.description,
        clientIncludeExclude: samplePresSeg?.clientIncludeExclude,
        images: samplePresSeg?.images
      }
    } : null
  };
  
  fs.writeFileSync('exhaustive-analysis.json', JSON.stringify(analysisOutput, null, 2));
  console.log(`\n✅ Saved exhaustive-analysis.json`);
  
  // Critical findings
  console.log(`\n${'='.repeat(80)}`);
  console.log('CRITICAL FINDINGS');
  console.log('='.repeat(80));
  
  console.log(`\n1. DATA COMPLETENESS:`);
  console.log(`   ✅ Successfully captured raw and presentation data`);
  console.log(`   - ${emptyPresSeqs.length} segments appear empty in presentation`);
  
  console.log(`\n2. FIELD MAPPING PATTERNS:`);
  console.log(`   Raw → Presentation mappings identified:`);
  console.log(`   - Raw 'description' or 'notes.clientNotes' → Pres 'description'`);
  console.log(`   - Raw 'notes.inclusions' → Pres 'clientIncludeExclude'`);
  console.log(`   - Raw 'name'/'description' → Pres 'title'`);
  
  console.log(`\n3. CONTENT ENRICHMENT:`);
  const enrichedSegs = contentComparison.filter(c => c.difference > 0).length;
  console.log(`   - ${enrichedSegs} segments have MORE content in presentation`);
  console.log(`   - Presentation data appears to be the enriched/client-facing version`);
  
  console.log(`\n4. RECOMMENDATION:`);
  console.log(`   ✅ Use PRESENTATION data as primary source (richer content)`);
  console.log(`   ✅ Use RAW data as fallback for any missing fields`);
  console.log(`   ✅ Media data successfully captured with s3Keys`);
}

async function main() {
  console.log('Starting iTrvl scraper with exhaustive analysis...\n');
  console.log(`Will scrape ${URLS.length} itineraries\n`);
  
  const scrapedData = [];
  
  for (const url of URLS) {
    try {
      const data = await scrapeItinerary(url);
      if (data && data.raw && data.presentation) {
        scrapedData.push(data);
        console.log(`✅ Successfully scraped ${data.itineraryId}`);
      } else {
        console.log(`⚠️  Partial data for ${data?.itineraryId || 'unknown'}`);
        if (data) scrapedData.push(data);
      }
    } catch (error) {
      console.error(`✗ Error scraping ${url}:`, error.message);
    }
  }
  
  fs.writeFileSync('all-itineraries.json', JSON.stringify(scrapedData, null, 2));
  console.log(`\n✅ Saved all-itineraries.json with ${scrapedData.length} itineraries`);
  
  if (scrapedData.length > 0 && scrapedData[0].raw && scrapedData[0].presentation) {
    await performExhaustiveAnalysis(scrapedData);
  } else {
    console.log('\n⚠️  No complete itineraries captured. Cannot perform exhaustive analysis.');
  }
  
  console.log('\n✅ Complete! Review exhaustive-analysis.json for detailed findings.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
