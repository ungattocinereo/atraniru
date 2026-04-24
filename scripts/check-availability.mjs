#!/usr/bin/env node

/**
 * Fetches iCal feeds for all apartments and generates a static JSON file
 * with booked/unavailable date ranges for each property.
 *
 * Usage: node scripts/check-availability.mjs
 * Output: public/data/availability.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'availability.json');

// Apartment definitions with their iCal feed URLs.
// Source: greg, 2026-04-24. Each apartment merges all of its OTA feeds
// (Booking.com + Airbnb) into a single set of booked dates.
const apartments = [
  {
    id: 'vintage-room',
    name: 'Vintage Room',
    feeds: [
      'https://ical.booking.com/v1/export/t/ea3e0ad0-f516-43af-a678-dd860ca9e8df.ics',
      'https://www.airbnb.com/calendar/ical/1491803199632820467.ics?t=c7afc2b8c66841ddb0a4a34de5861fb0'
    ]
  },
  {
    id: 'orange-room',
    name: 'Orange Room',
    feeds: [
      'https://ical.booking.com/v1/export/t/acb8b56c-0940-4aeb-ab6d-3de433afab7f.ics',
      'https://www.airbnb.com/calendar/ical/1622640206186838346.ics?t=717921b0057141649a080db157013617'
    ]
  },
  {
    id: 'solo-room',
    name: 'Solo Room',
    feeds: [
      'https://ical.booking.com/v1/export/t/5299de87-de9b-499a-a1a2-311fe09f6774.ics',
      'https://www.airbnb.com/calendar/ical/1623848144637841636.ics?t=59d5a4dd90cb45da90493feafb555e39'
    ]
  },
  {
    id: 'youth-room',
    name: 'Youth Room',
    feeds: [
      'https://ical.booking.com/v1/export/t/940e8ee6-25a3-4966-9eab-c83b54827e78.ics',
      'https://www.airbnb.com/calendar/ical/1624089061068359230.ics?t=7cbf451bfed643a5a403dd2d9489df63'
    ]
  },
  {
    id: 'awesome-view',
    name: 'Apartments with an awesome view',
    feeds: [
      'https://www.airbnb.com/calendar/ical/3456236.ics?t=eb37cdcccf9a4865b675311c819e0fd2'
    ]
  },
  {
    id: 'casa-carina',
    name: 'Casa Carina',
    feeds: [
      'https://www.airbnb.com/calendar/ical/20551225.ics?t=d02159c760e14554aa6b68ff6c99baf6'
    ]
  },
  {
    id: 'harmony-suite',
    name: 'Harmony Suite',
    feeds: [
      'https://www.airbnb.com/calendar/ical/37988248.ics?t=522d3bd9a171444ca1f131daf4c21443'
    ]
  },
  {
    id: 'royal-suite',
    name: 'Royal Suite',
    feeds: [
      'https://www.airbnb.com/calendar/ical/973032288955949308.ics?t=06b2618b55984543b0d88662b90ccffd'
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

async function fetchApartment(apt) {
  const fetched = await Promise.all(apt.feeds.map((url) => fetchFeed(url)));

  let feedsFailed = 0;
  const allEvents = [];
  for (const text of fetched) {
    if (text) {
      allEvents.push(...parseIcal(text));
    } else {
      feedsFailed++;
    }
  }

  const bookedDates = expandBookedDates(allEvents);
  return {
    id: apt.id,
    name: apt.name,
    bookedDates: [...bookedDates].sort(),
    feedsFailed,
    totalFeeds: apt.feeds.length,
    eventsCount: allEvents.length
  };
}

async function main() {
  console.log(`Checking availability for ${apartments.length} apartments...\n`);

  const result = {
    generated: new Date().toISOString(),
    apartments: {}
  };

  // Fetch all apartments in parallel — worst case ~15s (single fetch timeout),
  // not feeds × 15s as the previous serial loop allowed.
  const settled = await Promise.all(apartments.map((apt) => fetchApartment(apt)));

  for (const apt of settled) {
    const { id, ...rest } = apt;
    result.apartments[id] = rest;
    const status = rest.feedsFailed > 0 ? `(${rest.feedsFailed}/${rest.totalFeeds} feed failed)` : '';
    console.log(`  ${rest.name}: ${rest.bookedDates.length} booked days, ${rest.eventsCount} events ${status}`);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${OUTPUT_FILE} (generated ${result.generated})`);
}

main().catch((err) => {
  console.error('Availability fetch failed:', err.message);
  // Never block the build: keep the previous JSON if it exists, otherwise
  // write an empty stub so the page still loads.
  if (!existsSync(OUTPUT_FILE)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(
      OUTPUT_FILE,
      JSON.stringify({ generated: new Date().toISOString(), apartments: {} }, null, 2),
    );
    console.error(`Wrote empty fallback at ${OUTPUT_FILE}`);
  } else {
    console.error(`Keeping previous ${OUTPUT_FILE}`);
  }
  process.exit(0);
});
