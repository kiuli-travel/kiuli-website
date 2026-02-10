const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || '';

async function testLinkDestinations() {
  console.log('Testing linkDestinations...');
  console.log('Timestamp:', new Date().toISOString());
  console.log('');

  const tests = [
    { countries: [{ country: 'Kenya' }], expect: 1 },
    { countries: [{ country: 'Tanzania' }, { country: 'Kenya' }], expect: 2 },
    { countries: [{ country: 'FakeCountry' }], expect: 0 },
    { countries: [], expect: 0 },
  ];

  let passed = 0;

  for (const test of tests) {
    const ids = [];
    for (const item of test.countries) {
      const url = PAYLOAD_API_URL + '/api/destinations?where[name][equals]=' + encodeURIComponent(item.country) + '&limit=1';
      const res = await fetch(url, { headers: { 'Authorization': 'users API-Key ' + PAYLOAD_API_KEY } });
      const data = await res.json();
      if (data.docs && data.docs[0]) ids.push(data.docs[0].id);
    }
    const ok = ids.length === test.expect;
    console.log('Input:', JSON.stringify(test.countries));
    console.log('Expected:', test.expect, 'Got:', ids.length, ok ? 'PASS' : 'FAIL');
    console.log('');
    if (ok) passed++;
  }

  console.log('Result:', passed + '/4 tests passed');
  process.exit(passed === 4 ? 0 : 1);
}

testLinkDestinations();
