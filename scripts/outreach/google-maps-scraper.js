/**
 * Google Maps Mental Health Clinic Scraper
 * Uses Places API (New) - Text Search with hardcoded coordinates
 * Usage: node google-maps-scraper.js
 * Requires: GOOGLE_PLACES_API_KEY in .env.local
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local not found. Run from your empathai project root.');
    process.exit(1);
  }
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

loadEnv();

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY not found in .env.local');
  process.exit(1);
}

// Hardcoded coordinates — no geocoding API needed
const LOCATIONS = [
  { city: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { city: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { city: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
  { city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  { city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  { city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
  { city: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  { city: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
  { city: 'Portland', state: 'OR', lat: 45.5051, lng: -122.6750 },
  { city: 'Minneapolis', state: 'MN', lat: 44.9778, lng: -93.2650 },
  { city: 'Raleigh', state: 'NC', lat: 35.7796, lng: -78.6382 },
  { city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 }
];

const QUERIES = [
  'mental health group practice',
  'therapy group practice',
  'counseling group practice',
  'mental health clinic'
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function placesTextSearch(query, lat, lng) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 50000.0
        }
      },
      maxResultCount: 20,
      languageCode: 'en'
    });

    const options = {
      hostname: 'places.googleapis.com',
      path: '/v1/places:searchText',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.error('\n  API Error:', parsed.error.message);
            console.error('  Status:', parsed.error.status);
            resolve(null);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('  Request error:', e.message);
      resolve(null);
    });
    req.write(payload);
    req.end();
  });
}

function parseAddress(address) {
  if (!address) return { street: '', city: '', state: '', zip: '' };
  const parts = address.split(',').map(p => p.trim());
  const stateZip = (parts[parts.length - 2] || '').trim().split(' ');
  return {
    street: parts[0] || '',
    city: parts[1] || '',
    state: stateZip[0] || '',
    zip: stateZip[1] || ''
  };
}

function toCSV(rows) {
  const headers = [
    'Practice Name', 'Street', 'City', 'State', 'Zip',
    'Phone', 'Website', 'Rating', 'Review Count',
    'Place ID', 'Source', 'Email Status'
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const addr = parseAddress(row.formattedAddress);
    const name = row.displayName?.text || '';
    lines.push([
      `"${name.replace(/"/g, '""')}"`,
      `"${addr.street.replace(/"/g, '""')}"`,
      `"${addr.city.replace(/"/g, '""')}"`,
      `"${addr.state.replace(/"/g, '""')}"`,
      `"${addr.zip.replace(/"/g, '""')}"`,
      `"${(row.internationalPhoneNumber || '').replace(/"/g, '""')}"`,
      `"${(row.websiteUri || '').replace(/"/g, '""')}"`,
      `"${row.rating || ''}"`,
      `"${row.userRatingCount || ''}"`,
      `"${(row.id || '').replace(/"/g, '""')}"`,
      `"Google Maps"`,
      `"${row.websiteUri ? 'Needs Enrichment' : 'No Website'}"`
    ].join(','));
  }
  return lines.join('\n');
}

async function main() {
  console.log('EmpathAI — Google Maps Scraper (Places API New)');
  console.log('===============================================');
  console.log(`Searching ${LOCATIONS.length} cities...\n`);

  const allPlaces = new Map();

  for (const loc of LOCATIONS) {
    process.stdout.write(`Searching ${loc.city}, ${loc.state}... `);

    let cityCount = 0;
    for (const query of QUERIES) {
      await sleep(500);
      const result = await placesTextSearch(
        `${query} in ${loc.city} ${loc.state}`,
        loc.lat,
        loc.lng
      );

      if (result && result.places) {
        for (const place of result.places) {
          if (!allPlaces.has(place.id)) {
            allPlaces.set(place.id, {
              ...place,
              searchCity: loc.city,
              searchState: loc.state
            });
            cityCount++;
          }
        }
      }
    }

    console.log(`${cityCount} new (total: ${allPlaces.size})`);
    fs.writeFileSync('google-maps-leads.csv', toCSV(Array.from(allPlaces.values())));
    await sleep(800);
  }

  const places = Array.from(allPlaces.values());
  const withWebsite = places.filter(p => p.websiteUri).length;

  console.log('\n===============================================');
  console.log(`Done!`);
  console.log(`  Total practices: ${allPlaces.size}`);
  console.log(`  With website (enrichable): ${withWebsite}`);
  console.log(`  Saved to: google-maps-leads.csv`);
  console.log('\nNext: node scripts/outreach/email-enrichment.js google-maps-leads.csv --bucket customers');
}

main().catch(console.error);
