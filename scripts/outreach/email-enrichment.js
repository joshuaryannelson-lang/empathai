/**
 * Email Enrichment Script — Contact Page Scraper + Apollo.io
 * 
 * Strategy:
 * 1. First tries to scrape email directly from practice website contact page
 * 2. Falls back to Apollo people/match if name is available
 * 3. Outputs Mailmeteor-ready CSV
 *
 * Usage:
 *   node email-enrichment.js google-maps-leads.csv --bucket customers
 *   node email-enrichment.js psych-today-leads.csv --bucket customers
 *   node email-enrichment.js --bucket angels
 *   node email-enrichment.js --bucket vcs
 */

const https = require('https');
const http = require('http');
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

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

const args = process.argv.slice(2);
const inputFile = args.find(a => a.endsWith('.csv'));
const bucketArg = args.indexOf('--bucket');
const bucket = bucketArg !== -1 ? args[bucketArg + 1] : 'customers';

// ─────────────────────────────────────────
// ADD INVESTOR NAMES HERE
// Find on wellfound.com and crunchbase.com
// ─────────────────────────────────────────
const ANGEL_INVESTORS = [
  { firstName: 'Add', lastName: 'Manually', company: 'Example Fund', website: 'example.com', notes: 'Find via wellfound.com/role/investors?markets=health-care' }
];

const VC_INVESTORS = [
  { firstName: 'Add', lastName: 'Manually', company: 'Rock Health', website: 'rockhealth.com', notes: 'Digital health VC' },
  { firstName: 'Add', lastName: 'Manually', company: 'General Catalyst', website: 'generalcatalyst.com', notes: 'Health focus' },
  { firstName: 'Add', lastName: 'Manually', company: 'a16z Bio', website: 'a16z.com', notes: 'Health tech' },
  { firstName: 'Add', lastName: 'Manually', company: 'Bessemer', website: 'bvp.com', notes: 'Health portfolio' }
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function extractDomain(website) {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? website : 'https://' + website;
    return new URL(url).hostname.replace('www.', '');
  } catch { return null; }
}

// Scrape a URL and return HTML
function fetchHTML(url, maxRedirects = 3) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : 'https://' + url);
      const lib = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        timeout: 8000
      };

      const req = lib.request(options, (res) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsedUrl.protocol}//${parsedUrl.hostname}${res.headers.location}`;
          fetchHTML(redirectUrl, maxRedirects - 1).then(resolve);
          return;
        }

        let data = '';
        res.on('data', chunk => {
          data += chunk;
          if (data.length > 200000) req.destroy(); // Stop at 200kb
        });
        res.on('end', () => resolve(data));
      });

      req.on('error', () => resolve(''));
      req.on('timeout', () => { req.destroy(); resolve(''); });
      req.end();
    } catch {
      resolve('');
    }
  });
}

// Extract emails from HTML
function extractEmails(html) {
  if (!html) return [];

  const emails = new Set();

  // Standard mailto links
  const mailtoRegex = /href="mailto:([^"?]+)"/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1].toLowerCase().trim();
    if (isValidEmail(email)) emails.add(email);
  }

  // Plain text emails
  const plainEmailRegex = /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g;
  while ((match = plainEmailRegex.exec(html)) !== null) {
    const email = match[1].toLowerCase().trim();
    if (isValidEmail(email) && !isJunkEmail(email)) emails.add(email);
  }

  return Array.from(emails);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 100;
}

function isJunkEmail(email) {
  const junk = [
    'example.com', 'test.com', 'domain.com', 'email.com',
    'sentry.io', 'wixpress.com', 'squarespace.com', 'wordpress.com',
    'schema.org', 'w3.org', 'google.com', 'facebook.com',
    'noreply', 'no-reply', 'donotreply', 'support@', 'abuse@',
    'postmaster@', 'webmaster@', 'privacy@', 'legal@'
  ];
  return junk.some(j => email.includes(j));
}

function rankEmails(emails, domain) {
  // Prefer emails that match the practice domain
  // Prefer owner/director/admin type emails over info/contact
  const preferred = ['owner', 'director', 'admin', 'practice', 'hello', 'info', 'contact', 'office'];
  
  const domainEmails = emails.filter(e => e.includes(domain?.split('.')[0] || ''));
  const otherEmails = emails.filter(e => !domainEmails.includes(e));
  
  const sortByPreference = (arr) => arr.sort((a, b) => {
    const aScore = preferred.findIndex(p => a.includes(p));
    const bScore = preferred.findIndex(p => b.includes(p));
    if (aScore === -1 && bScore === -1) return 0;
    if (aScore === -1) return 1;
    if (bScore === -1) return -1;
    return aScore - bScore;
  });

  return [...sortByPreference(domainEmails), ...sortByPreference(otherEmails)];
}

// Try to find email from website
async function scrapeEmailFromWebsite(website) {
  if (!website) return null;
  
  const domain = extractDomain(website);
  const baseUrl = website.startsWith('http') ? website : 'https://' + website;

  // Pages most likely to have contact emails
  const pagesToTry = [
    baseUrl,
    `${baseUrl}/contact`,
    `${baseUrl}/contact-us`,
    `${baseUrl}/about`,
    `${baseUrl}/about-us`,
    `${baseUrl}/team`,
  ];

  for (const pageUrl of pagesToTry) {
    try {
      const html = await fetchHTML(pageUrl);
      if (!html) continue;

      const emails = extractEmails(html);
      if (emails.length > 0) {
        const ranked = rankEmails(emails, domain);
        return ranked[0]; // Return best email found
      }
    } catch {
      // Skip this page
    }
    await sleep(200);
  }

  return null;
}

// Apollo fallback for when we have a name
function apolloMatch(firstName, lastName, domain) {
  if (!APOLLO_API_KEY) return Promise.resolve(null);
  
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      domain,
      reveal_personal_emails: false
    });

    const options = {
      hostname: 'api.apollo.io',
      path: '/v1/people/match',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.person?.email || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(payload);
    req.end();
  });
}

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = [];
    let field = '', inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { fields.push(field); field = ''; }
      else field += char;
    }
    fields.push(field);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (fields[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function toMailmeteorCSV(rows, templateType) {
  const headers = [
    'Email', 'First Name', 'Last Name', 'Practice Name',
    'City', 'State', 'Phone', 'Website',
    'Template', 'Email Status', 'Notes'
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([
      `"${(row.email || '').replace(/"/g, '""')}"`,
      `"${(row.firstName || '').replace(/"/g, '""')}"`,
      `"${(row.lastName || '').replace(/"/g, '""')}"`,
      `"${(row.practiceName || row['Practice Name'] || '').replace(/"/g, '""')}"`,
      `"${(row.city || row['City'] || '').replace(/"/g, '""')}"`,
      `"${(row.state || row['State'] || '').replace(/"/g, '""')}"`,
      `"${(row.phone || row['Phone'] || '').replace(/"/g, '""')}"`,
      `"${(row.website || row['Website'] || '').replace(/"/g, '""')}"`,
      `"${templateType}"`,
      `"${row.email ? 'Ready to Send' : 'No Email Found'}"`,
      `"${(row.notes || '').replace(/"/g, '""')}"`
    ].join(','));
  }
  return lines.join('\n');
}

async function enrichCustomers(rows) {
  console.log(`Enriching ${rows.length} leads via website scraping...\n`);
  const enriched = [];
  let found = 0;
  let scraped = 0;
  let apollo = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const website = row['Website'] || row.website || '';
    const ownerName = row['Owner Name'] || row.ownerName || '';
    const nameParts = ownerName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const domain = extractDomain(website);
    const practiceName = row['Practice Name'] || row.name || '';

    process.stdout.write(`\r  ${i + 1}/${rows.length} — found: ${found} (scraped: ${scraped}, apollo: ${apollo})`);

    // Already has email
    if (row['Email'] && row['Email'].includes('@')) {
      enriched.push({ ...row, email: row['Email'], firstName, lastName, practiceName, notes: 'Direct' });
      found++;
      continue;
    }

    // Try scraping website for email
    if (website) {
      const scrapedEmail = await scrapeEmailFromWebsite(website);
      if (scrapedEmail) {
        enriched.push({ ...row, email: scrapedEmail, firstName, lastName, practiceName, notes: 'Website' });
        found++;
        scraped++;
        continue;
      }
    }

    // Try Apollo if we have name + domain
    if (firstName && lastName && domain && APOLLO_API_KEY) {
      await sleep(300);
      const apolloEmail = await apolloMatch(firstName, lastName, domain);
      if (apolloEmail) {
        enriched.push({ ...row, email: apolloEmail, firstName, lastName, practiceName, notes: 'Apollo' });
        found++;
        apollo++;
        continue;
      }
    }

    // No email found
    enriched.push({
      ...row,
      email: '',
      firstName,
      lastName,
      practiceName,
      notes: domain ? `Try manually: https://hunter.io/domain-search/${domain}` : 'No website'
    });
  }

  console.log(`\n\n  Results:`);
  console.log(`  Found via website scraping: ${scraped}`);
  console.log(`  Found via Apollo: ${apollo}`);
  console.log(`  Total with email: ${found}/${rows.length}`);

  return enriched;
}

async function enrichInvestors(list, type) {
  console.log(`Enriching ${list.length} ${type} investors...`);
  const enriched = [];

  for (const inv of list) {
    const domain = extractDomain(inv.website);

    // Try website scraping first
    if (inv.website) {
      const scrapedEmail = await scrapeEmailFromWebsite(inv.website);
      if (scrapedEmail) {
        enriched.push({ email: scrapedEmail, firstName: inv.firstName, lastName: inv.lastName, practiceName: inv.company, city: '', state: '', phone: '', website: inv.website || '', notes: 'Website' });
        continue;
      }
    }

    // Try Apollo
    if (domain && APOLLO_API_KEY) {
      await sleep(400);
      const apolloEmail = await apolloMatch(inv.firstName, inv.lastName, domain);
      if (apolloEmail) {
        enriched.push({ email: apolloEmail, firstName: inv.firstName, lastName: inv.lastName, practiceName: inv.company, city: '', state: '', phone: '', website: inv.website || '', notes: 'Apollo' });
        continue;
      }
    }

    enriched.push({ email: '', firstName: inv.firstName, lastName: inv.lastName, practiceName: inv.company, city: '', state: '', phone: '', website: inv.website || '', notes: inv.notes || 'Add manually' });
  }

  return enriched;
}

async function main() {
  console.log('EmpathAI — Email Enrichment (Website Scraper + Apollo)');
  console.log('======================================================');
  console.log(`Bucket: ${bucket}\n`);

  let enriched = [], templateType = '', outputFile = '';

  if (bucket === 'customers') {
    if (!inputFile || !fs.existsSync(inputFile)) {
      console.error(`ERROR: Input CSV not found: ${inputFile}`);
      console.error('Usage: node email-enrichment.js google-maps-leads.csv --bucket customers');
      process.exit(1);
    }
    const rows = parseCSV(fs.readFileSync(inputFile, 'utf8'));
    console.log(`Loaded ${rows.length} rows from ${inputFile}\n`);
    enriched = await enrichCustomers(rows);
    templateType = 'practice-owner-cold';
    outputFile = 'customers-ready-to-send.csv';

  } else if (bucket === 'angels') {
    enriched = await enrichInvestors(ANGEL_INVESTORS, 'angel');
    templateType = 'angel-investor-cold';
    outputFile = 'angels-ready-to-send.csv';

  } else if (bucket === 'vcs') {
    enriched = await enrichInvestors(VC_INVESTORS, 'VC');
    templateType = 'vc-cold';
    outputFile = 'vcs-ready-to-send.csv';

  } else {
    console.error(`Unknown bucket: ${bucket}. Use: customers | angels | vcs`);
    process.exit(1);
  }

  fs.writeFileSync(outputFile, toMailmeteorCSV(enriched, templateType));

  const withEmail = enriched.filter(r => r.email).length;
  const withoutEmail = enriched.length - withEmail;

  console.log(`\nSaved to: ${outputFile}`);
  console.log(`Ready to send: ${withEmail} | Still need email: ${withoutEmail}`);
  console.log('\nFor remaining leads, use:');
  console.log('  https://hunter.io/domain-search — paste domain, get emails');
  console.log('\nImport CSV into mailmeteor.com and send 30/day max.');
}

main().catch(console.error);
