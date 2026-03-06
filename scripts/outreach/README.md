# EmpathAI Outreach Scripts

Three scripts to build your lead lists and enrich with emails.
All output is CSV ready to paste into Mailmeteor.

## Setup

Run all scripts from your empathai project root:
cd /Users/joshuanelson/empathai

Make sure your .env.local has:
GOOGLE_PLACES_API_KEY=your_google_key
APOLLO_API_KEY=your_apollo_key

## Script 1 — Psychology Today Scraper
Finds group mental health practices listed on Psychology Today.

# Scrape all US states (takes 20-30 min)
node scripts/outreach/psych-today-scraper.js

# Scrape one state only (faster, good for testing)
node scripts/outreach/psych-today-scraper.js --state NY

Output: psych-today-leads.csv

## Script 2 — Google Maps Scraper
Finds mental health clinics across 40 major US cities.

node scripts/outreach/google-maps-scraper.js

Output: google-maps-leads.csv

## Script 3 — Email Enrichment
Takes a CSV from either scraper and finds owner emails via Apollo.io.

# Customers
node scripts/outreach/email-enrichment.js psych-today-leads.csv --bucket customers

# Angels
node scripts/outreach/email-enrichment.js --bucket angels

# VCs
node scripts/outreach/email-enrichment.js --bucket vcs

Output: customers-ready-to-send.csv, angels-ready-to-send.csv, vcs-ready-to-send.csv

## Recommended workflow
1. node scripts/outreach/psych-today-scraper.js --state NY
2. node scripts/outreach/email-enrichment.js psych-today-leads.csv --bucket customers
3. Review customers-ready-to-send.csv
4. Import into mailmeteor.com and send in batches of 30/day

## Finding investors manually
Angels: https://wellfound.com/role/investors?markets=health-care
VCs: https://www.crunchbase.com/discover/principal.investors?categories=mental-health
Add names to ANGEL_INVESTORS and VC_INVESTORS arrays in email-enrichment.js
