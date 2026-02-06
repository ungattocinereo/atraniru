#!/usr/bin/env node

/**
 * Fetches iCal feeds for all apartments and generates a static JSON file
 * with booked/unavailable date ranges for each property.
 *
 * Usage: node scripts/check-availability.mjs
 * Output: public/data/availability.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'availability.json');

// Apartment definitions with their iCal feed URLs
const apartments = [
  {
    id: 'awesome-view',
    name: 'Apartments with an awesome view',
    feeds: [
      'https://www.airbnb.com/calendar/ical/3456236.ics?s=b68c893b2de331892cf36544c1c12e63'
    ]
  },
  {
    id: 'solo-room',
    name: 'Solo Room',
    feeds: [
      'https://ical.booking.com/v1/export?t=50eb167d-a617-4f6e-862b-7b474516e903'
    ]
  },
  {
    id: 'central-room',
    name: 'Central Room',
    feeds: [
      'https://ical.booking.com/v1/export?t=66c7dc38-0d5e-45dc-b22a-9d8e075ec149',
      'https://ical.booking.com/v1/export?t=9dc9bc5e-c0d8-4727-9a6d-9a769afc138c'
    ]
  },
  {
    id: 'bunkbed-room',
    name: 'Bunkbed Room',
    feeds: [
      'https://ical.booking.com/v1/export?t=b7023f35-c3ae-44bb-b122-ddc15f4d7e26'
    ]
  },
  {
    id: 'vintage-room',
    name: 'Vintage Room',
    feeds: [
      'https://ical.booking.com/v1/export?t=e7b18790-16b3-4000-b2e0-c4b5076f20d5'
    ]
  },
  {
    id: 'orange-room',
    name: 'Orange Room',
    feeds: [
      'https://ical.booking.com/v1/export?t=ac4e5066-83f2-4720-8d10-dd865612e91d'
    ]
  },
  {
    id: 'casa-carina',
    name: 'Casa Carina',
    feeds: [
      'https://www.airbnb.com/calendar/ical/20551225.ics?s=dbbc3c718fa519684c8b4bc62d4e0708'
    ]
  },
  {
    id: 'harmony-suite',
    name: 'Harmony Suite',
    feeds: [
      'https://www.airbnb.com/calendar/ical/37988248.ics?s=6146074b67a4454d6bb616ce31309606'
    ]
  },
  {
    id: 'royal-suite',
    name: 'Royal Suite',
    feeds: [
      'https://www.airbnb.com/calendar/ical/973032288955949308.ics?s=bca25b1a63503b216e54dd0d673c9e31'
    ]
  },
  {
    id: 'villa-ravello',
    name: 'Villa In Ravello',
    feeds: [
      'https://ical.booking.com/v1/export?t=d1d7f32f-23b9-4914-b348-07719a6bd239'
    ]
  }
];

/**
 * Parse a DTSTART;VALUE=DATE:YYYYMMDD into a Date object (UTC midnight)
 */
function parseIcalDate(dateStr) {
  const y = parseInt(dateStr.substring(0, 4), 10);
  const m = parseInt(dateStr.substring(4, 6), 10) - 1;
  const d = parseInt(dateStr.substring(6, 8), 10);
  return new Date(Date.UTC(y, m, d));
}

/**
 * Format a Date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Parse iCal text into an array of { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', summary: string }
 * DTEND in iCal is exclusive (day after last booked night).
 */
function parseIcal(icalText) {
  const events = [];
  const lines = icalText.replace(/\r\n /g, '').replace(/\r/g, '').split('\n');

  let inEvent = false;
  let dtstart = null;
  let dtend = null;
  let summary = '';

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      dtstart = null;
      dtend = null;
      summary = '';
    } else if (line === 'END:VEVENT') {
      if (inEvent && dtstart && dtend) {
        events.push({
          start: formatDate(parseIcalDate(dtstart)),
          end: formatDate(parseIcalDate(dtend)),
          summary
        });
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        const match = line.match(/(\d{8})/);
        if (match) dtstart = match[1];
      } else if (line.startsWith('DTEND')) {
        const match = line.match(/(\d{8})/);
        if (match) dtend = match[1];
      } else if (line.startsWith('SUMMARY:')) {
        summary = line.substring(8).trim();
      }
    }
  }

  return events;
}

/**
 * From events, build a Set of all booked date strings (YYYY-MM-DD).
 * We expand each event range into individual dates.
 * DTEND is exclusive, so we go from DTSTART to DTEND-1.
 */
function expandBookedDates(events) {
  const dates = new Set();
  for (const event of events) {
    const start = new Date(event.start + 'T00:00:00Z');
    const end = new Date(event.end + 'T00:00:00Z');
    const current = new Date(start);
    while (current < end) {
      dates.add(formatDate(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }
  return dates;
}

/**
 * Fetch a single iCal feed with timeout and error handling
 */
async function fetchFeed(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Atrani.ru Availability Checker/1.0'
      }
    });

    if (!response.ok) {
      console.warn(`  [WARN] HTTP ${response.status} for ${url}`);
      return null;
    }

    const text = await response.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      console.warn(`  [WARN] Invalid iCal response from ${url}`);
      return null;
    }

    return text;
  } catch (err) {
    console.warn(`  [WARN] Failed to fetch ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log('Checking apartment availability...\n');

  const result = {
    generated: new Date().toISOString(),
    apartments: {}
  };

  for (const apt of apartments) {
    console.log(`Fetching: ${apt.name} (${apt.feeds.length} feed(s))`);

    const allEvents = [];
    let feedsFailed = 0;

    for (const feedUrl of apt.feeds) {
      const icalText = await fetchFeed(feedUrl);
      if (icalText) {
        const events = parseIcal(icalText);
        allEvents.push(...events);
        console.log(`  - Got ${events.length} events`);
      } else {
        feedsFailed++;
      }
    }

    const bookedDates = expandBookedDates(allEvents);

    result.apartments[apt.id] = {
      name: apt.name,
      bookedDates: [...bookedDates].sort(),
      feedsFailed,
      totalFeeds: apt.feeds.length,
      eventsCount: allEvents.length
    };

    console.log(`  Total booked dates: ${bookedDates.size}\n`);
  }

  // Write output
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\nAvailability data written to: ${OUTPUT_FILE}`);
  console.log(`Generated at: ${result.generated}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
