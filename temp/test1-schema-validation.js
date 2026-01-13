const fs = require('fs');

console.log('='.repeat(80));
console.log('TEST 1: SCHEMA VALIDATION');
console.log('='.repeat(80));
console.log('\nPurpose: Determine which schema.org type actually validates for Google\n');

// Load scraped iTrvl data
const scrapedData = JSON.parse(fs.readFileSync('./all-itineraries.json', 'utf8'));
const firstItin = scrapedData[0];
const pres = firstItin.presentation;
const raw = firstItin.raw;

console.log(`Using itinerary: ${pres.itineraryName}\n`);

// Extract key data
const itineraryData = {
  name: pres.itineraryName,
  description: pres.segments.find(s => s.type === 'stay')?.description || 'Luxury safari experience',
  startDate: pres.startDate,
  endDate: pres.endDate,
  nights: pres.nights,
  travelers: pres.pax,
  accommodations: pres.accommodations || [],
  price: raw.itinerary?.estimatedSell || null,
  locations: []
};

// Extract locations from segments
pres.segments.forEach(seg => {
  if (seg.location && seg.country) {
    itineraryData.locations.push({
      name: seg.location,
      country: seg.country
    });
  }
});

// Remove duplicate locations
itineraryData.locations = [...new Map(
  itineraryData.locations.map(item => [item.name, item])
).values()];

console.log('Extracted Data:');
console.log(`  - Name: ${itineraryData.name}`);
console.log(`  - Duration: ${itineraryData.nights} nights`);
console.log(`  - Travelers: ${itineraryData.travelers}`);
console.log(`  - Locations: ${itineraryData.locations.length}`);
console.log(`  - Accommodations: ${itineraryData.accommodations.length}`);
console.log(`  - Price: ${itineraryData.price ? '$' + (itineraryData.price / 100).toFixed(2) : 'N/A'}`);
console.log('');

// SCHEMA 1: TouristTrip
function generateTouristTripSchema(data) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "name": data.name,
    "description": data.description,
    "touristType": "Luxury Safari",
    "itinerary": []
  };

  // Add locations as itinerary items
  data.locations.forEach((loc, idx) => {
    schema.itinerary.push({
      "@type": "Place",
      "name": loc.name,
      "address": {
        "@type": "PostalAddress",
        "addressCountry": loc.country
      }
    });
  });

  // Add offer if price exists
  if (data.price) {
    schema.offers = {
      "@type": "Offer",
      "priceCurrency": "USD",
      "price": (data.price / 100).toFixed(2),
      "availability": "https://schema.org/InStock"
    };
  }

  return schema;
}

// SCHEMA 2: Trip
function generateTripSchema(data) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Trip",
    "name": data.name,
    "description": data.description,
    "itinerary": []
  };

  // Add itinerary places
  data.locations.forEach(loc => {
    schema.itinerary.push({
      "@type": "Place",
      "name": loc.name,
      "address": {
        "@type": "PostalAddress",
        "addressCountry": loc.country
      }
    });
  });

  return schema;
}

// SCHEMA 3: Product
function generateProductSchema(data) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": data.name,
    "description": data.description,
    "brand": {
      "@type": "Brand",
      "name": "Kiuli Safaris"
    },
    "sku": `KIULI-${Date.now()}` // Generate placeholder SKU
  };

  if (data.price) {
    schema.offers = {
      "@type": "Offer",
      "priceCurrency": "USD",
      "price": (data.price / 100).toFixed(2),
      "availability": "https://schema.org/InStock",
      "url": "https://kiuli.com"
    };
  }

  return schema;
}

// Generate all three schemas
const touristTripSchema = generateTouristTripSchema(itineraryData);
const tripSchema = generateTripSchema(itineraryData);
const productSchema = generateProductSchema(itineraryData);

// Save schemas
fs.writeFileSync('./schema-touristtrip.json', 
  JSON.stringify(touristTripSchema, null, 2));
fs.writeFileSync('./schema-trip.json', 
  JSON.stringify(tripSchema, null, 2));
fs.writeFileSync('./schema-product.json', 
  JSON.stringify(productSchema, null, 2));

console.log('✅ Generated 3 schema variations:\n');
console.log('1. schema-touristtrip.json');
console.log('2. schema-trip.json');
console.log('3. schema-product.json\n');

// Validate structure
function validateSchema(schema, type) {
  const issues = [];
  
  if (!schema['@context']) issues.push('Missing @context');
  if (!schema['@type']) issues.push('Missing @type');
  if (!schema.name) issues.push('Missing name');
  
  if (type === 'TouristTrip') {
    if (!schema.itinerary || schema.itinerary.length === 0) {
      issues.push('TouristTrip should have itinerary');
    }
  }
  
  if (type === 'Product') {
    if (!schema.sku) issues.push('Product requires SKU');
    if (!schema.brand) issues.push('Product should have brand');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

const validation = {
  touristTrip: validateSchema(touristTripSchema, 'TouristTrip'),
  trip: validateSchema(tripSchema, 'Trip'),
  product: validateSchema(productSchema, 'Product')
};

console.log('Structure Validation:');
console.log(`  TouristTrip: ${validation.touristTrip.valid ? '✅ Valid' : '❌ ' + validation.touristTrip.issues.join(', ')}`);
console.log(`  Trip: ${validation.trip.valid ? '✅ Valid' : '❌ ' + validation.trip.issues.join(', ')}`);
console.log(`  Product: ${validation.product.valid ? '✅ Valid' : '❌ ' + validation.product.issues.join(', ')}`);
console.log('');

// Generate report
const report = {
  testName: 'Schema Validation',
  testedAt: new Date().toISOString(),
  itinerary: {
    id: firstItin.itineraryId,
    name: pres.itineraryName
  },
  schemas: {
    touristTrip: {
      file: 'schema-touristtrip.json',
      structureValid: validation.touristTrip.valid,
      issues: validation.touristTrip.issues,
      pros: [
        'Designed specifically for tourism',
        'Supports itinerary items',
        'Can include offers/pricing'
      ],
      cons: [
        'Limited Google rich result support',
        'Newer schema type (2018)',
        'May not trigger visual enhancements in search'
      ]
    },
    trip: {
      file: 'schema-trip.json',
      structureValid: validation.trip.valid,
      issues: validation.trip.issues,
      pros: [
        'Generic trip type',
        'Well-established schema',
        'Simple structure'
      ],
      cons: [
        'Minimal rich result features',
        'Basic information only',
        'No pricing support'
      ]
    },
    product: {
      file: 'schema-product.json',
      structureValid: validation.product.valid,
      issues: validation.product.issues,
      pros: [
        'Can trigger offer snippets',
        'Shows pricing in search results',
        'Well-supported by Google',
        'Rich result features available'
      ],
      cons: [
        'Requires SKU (we generated placeholder)',
        'May not be semantically perfect for trips',
        'Designed for physical/digital products'
      ]
    }
  },
  nextSteps: [
    '1. Copy each schema file content',
    '2. Go to: https://validator.schema.org/',
    '3. Paste the JSON and click "RUN TEST"',
    '4. Check for errors/warnings',
    '5. Go to: https://search.google.com/test/rich-results',
    '6. Test which schema triggers rich results',
    '7. Document which schema Google actually supports'
  ],
  recommendation: 'Test all three in Google Rich Results Test. The one that passes validation AND triggers rich snippets is the winner.'
};

fs.writeFileSync('./test1-report.json', 
  JSON.stringify(report, null, 2));

console.log('='.repeat(80));
console.log('NEXT STEPS');
console.log('='.repeat(80));
console.log('\n1. Open https://validator.schema.org/');
console.log('2. Copy/paste each schema JSON file');
console.log('3. Note which ones validate without errors');
console.log('\n4. Open https://search.google.com/test/rich-results');
console.log('5. Test each schema');
console.log('6. See which triggers rich results\n');
console.log('✅ Saved test1-report.json\n');
