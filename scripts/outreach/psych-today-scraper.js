/**
 * Psychology Today Group Practice Scraper
 * Usage: node psych-today-scraper.js
 * Optional: node psych-today-scraper.js --state NY
 */

const https = require('https');
const fs = require('fs');

const args = process.argv.slice(2);
const stateArg = args.indexOf('--state');
const targetState = stateArg !== -1 ? args[stateArg + 1].toLowerCase() : null;

const STATES = targetState ? [targetState] : [
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new-hampshire','new-jersey','new-mexico','new-york','north-carolina',
  'north-dakota','ohio','oklahoma','oregon','pennsylvania','rhode-island',
  'south-carolina','south-dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west-virginia','wisconsin','wyoming'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity'
      }
    };
    const req = https.get(url, options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchPage(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ html: data, status: res.statusCode }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractPractices(html, state) {
  const practices = [];
  const seen = new Set();

  // Match practice listing links
  const patterns = [
    /<a[^>]*href="(\/us\/groups\/[^"?#]+)"[^>]*>([^<]{3,80})<\/a>/g,
    /<a[^>]*href="(\/us\/therapists\/[^"?#]+\/\d+)"[^>]*class="[^"]*profile[^"]*"[^>]*>/g,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      if (!seen.has(url)) {
        seen.add(url);
        practices.push({
          url: 'https://www.psychologytoday.com' + url,
          state: state,
          source: 'Psychology Today'
        });
      }
    }
  }

  // Also extract any practice name/info visible in listings
  const nameRegex = /class="[^"]*profile-title[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g;
  let nameMatch;
  let idx = 0;
  while ((nameMatch = nameRegex.exec(html)) !== null) {
    if (practices[idx]) {
      practices[idx].name = nameMatch[1].trim();
      idx++;
    }
  }

  return practices;
}

function extractListingData(html) {
  const data = {};

  // Name
  const namePatterns = [
    /<h1[^>]*>([^<]{3,100})<\/h1>/,
    /<title>([^|<-]{3,80})[|-]/
  ];
  for (const p of namePatterns) {
    const m = html.match(p);
    if (m) { data.name = m[1].trim(); break; }
  }

  // Phone
  const phoneMatch = html.match(/href="tel:([^"]+)"/);
  if (phoneMatch) data.phone = phoneMatch[1].trim();

  // Website
  const websitePatterns = [
    /href="(https?:\/\/(?!www\.psychologytoday)[^"]+)"[^>]*>[^<]*[Ww]ebsite/,
    /"website"[^>]*href="([^"]+)"/,
    /class="[^"]*website[^"]*"[^>]*href="([^"]+)"/
  ];
  for (const p of websitePatterns) {
    const m = html.match(p);
    if (m && !m[1].includes('psychologytoday')) { data.website = m[1].trim(); break; }
  }

  // Email
  const emailMatch = html.match(/href="mailto:([^"]+)"/);
  if (emailMatch) data.email = emailMatch[1].trim();

  // City/State
  const locationPatterns = [
    /([A-Za-z\s]+),\s*([A-Z]{2})\s+\d{5}/,
    /"addressLocality"\s*:\s*"([^"]+)"/,
    /"addressRegion"\s*:\s*"([^"]+)"/
  ];
  const cityMatch = html.match(locationPatterns[0]);
  if (cityMatch) { data.city = cityMatch[1].trim(); data.stateCode = cityMatch[2]; }

  // Number of therapists
  const therapistMatch = html.match(/(\d+)\s+(?:therapist|clinician|provider)/i);
  if (therapistMatch) data.therapistCount = therapistMatch[1];

  // Practice type
  if (html.includes('Group Practice') || html.includes('group practice')) {
    data.type = 'Group Practice';
  } else {
    data.type = 'Practice';
  }

  return data;
}

async function scrapeState(state) {
  console.log(`\nScraping ${state}...`);
  const practices = [];

  // Try multiple URL patterns Psychology Today uses
  const urls = [
    `https://www.psychologytoday.com/us/therapists/${state}`,
    `https://www.psychologytoday.com/us/groups/${state}`,
  ];

  for (const url of urls) {
    try {
      await sleep(1000);
      const { html, status } = await fetchPage(url);

      if (status === 200 && html.length > 1000) {
        const found = extractPractices(html, state);
        console.log(`  Found ${found.length} listings at ${url}`);

        // Get details for first 8 per URL
        for (const practice of found.slice(0, 8)) {
          try {
            await sleep(1200);
            const detail = await fetchPage(practice.url);
            if (detail.status === 200) {
              const extracted = extractListingData(detail.html);
              Object.assign(practice, extracted);
            }
          } catch (e) {
            // Skip detail fetch errors
          }
          practices.push(practice);
        }
      } else {
        console.log(`  No results at ${url} (status: ${status})`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await sleep(2000);
  return practices;
}

function toCSV(rows) {
  const headers = [
    'Practice Name','Type','City','State','Phone',
    'Website','Email','Therapist Count','Profile URL','Source','Email Status'
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([
      `"${(row.name||'Unknown Practice').replace(/"/g,'""')}"`,
      `"${(row.type||'Practice').replace(/"/g,'""')}"`,
      `"${(row.city||'').replace(/"/g,'""')}"`,
      `"${(row.stateCode||row.state||'').replace(/"/g,'""')}"`,
      `"${(row.phone||'').replace(/"/g,'""')}"`,
      `"${(row.website||'').replace(/"/g,'""')}"`,
      `"${(row.email||'').replace(/"/g,'""')}"`,
      `"${(row.therapistCount||'').toString()}"`,
      `"${(row.url||'').replace(/"/g,'""')}"`,
      `"Psychology Today"`,
      `"${row.email ? 'Found' : row.website ? 'Needs Enrichment' : 'No Contact Info'}"`
    ].join(','));
  }
  return lines.join('\n');
}

async function main() {
  console.log('EmpathAI — Psychology Today Scraper');
  console.log('====================================');
  console.log(`Target: ${targetState || 'all US states'}\n`);

  const allPractices = [];

  for (const state of STATES) {
    const practices = await scrapeState(state);
    allPractices.push(...practices);
    fs.writeFileSync('psych-today-leads.csv', toCSV(allPractices));
    console.log(`  Running total: ${allPractices.length} practices`);
  }

  const withWebsite = allPractices.filter(p => p.website).length;
  const withEmail = allPractices.filter(p => p.email).length;

  console.log('\n====================================');
  console.log(`Done!`);
  console.log(`  Total practices: ${allPractices.length}`);
  console.log(`  With website: ${withWebsite}`);
  console.log(`  With email: ${withEmail}`);
  console.log(`  Saved to: psych-today-leads.csv`);
  console.log('\nNext: node scripts/outreach/email-enrichment.js psych-today-leads.csv --bucket customers');
}

main().catch(console.error);
