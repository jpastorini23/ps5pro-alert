import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { send, transport, notifyDesktop } from './mailer.js';
import { CONFIG } from './config.js';
import { withinCeiling } from './models.js';
import * as target from './sources/target.js';
import * as psdirect from './sources/psdirect.js';
import * as bestbuy from './sources/bestbuy.js';

// Local runs read credentials from .env; CI passes them as secrets.
const ENV_FILE = new URL('./.env', import.meta.url);
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Target's API refuses datacenter IPs (HTTP 435), so GitHub Actions sets
// SKIP_SOURCES=target and the Mac covers it. Skipping is explicit rather than
// inferred, so a real Target outage still raises the health alarm locally.
const SKIP = (process.env.SKIP_SOURCES ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const SOURCES = [target, psdirect, bestbuy].filter((s) => !SKIP.includes(s.id));
// The Mac runner and CI keep separate state so they never fight over the file.
const STATE_FILE = new URL(process.env.STATE_FILE ?? './state.json', import.meta.url);
const DRY_RUN = process.env.DRY_RUN === '1';
const now = () => new Date();
const iso = (d) => d.toISOString();
const hoursSince = (t) => (t ? (Date.now() - new Date(t)) / 3.6e6 : Infinity);

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    return { offers: {}, sources: {} };
  }
}

const LOOP_SECONDS = Number(process.env.LOOP_SECONDS ?? 570); // stop before the next cron
const POLL_SECONDS = Number(process.env.POLL_SECONDS ?? 10);
const DEEP_EVERY = Number(process.env.DEEP_EVERY ?? 12); // store-level check cadence

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastPolled = new Map();

// One pass over every source. Returns the offers that just became buyable.
async function cycle(state, deep) {
  const hits = [];

  for (const source of SOURCES) {
    const s = (state.sources[source.id] ??= {});

    // Each source sets its own floor so the fast one is not slowed to the
    // pace of the slow ones, and the slow ones are not hammered.
    const floor = (source.minIntervalSeconds ?? 0) * 1000;
    if (floor && lastPolled.get(source.id) && Date.now() - lastPolled.get(source.id) < floor) {
      continue;
    }
    lastPolled.set(source.id, Date.now());

    let offers;
    try {
      const result = await source.check({ deep });
      if (result && result.skipped) {
        // Not configured is not a failure.
        if (s.skipped !== result.skipped) s.skipped = result.skipped;
        delete s.downSince;
        delete s.lastError;
        continue;
      }
      offers = result;
      delete s.skipped;
      delete s.lastError;
      delete s.downSince; // A success clears the outage; nothing else is written.
    } catch (err) {
      s.lastError = err.message;
      s.downSince ??= iso(now());
      console.error(`  ! ${source.label}: ${err.message}`);
      continue;
    }

    for (const offer of offers) {
      const hit = Boolean(offer.inStock && withinCeiling(offer.model, offer.price));
      const prev = state.offers[offer.key] ?? {};
      const cooledDown = hoursSince(prev.lastAlertAt) * 60 > CONFIG.alertCooldownMinutes;

      if (hit && !prev.hit) {
        console.log(`  HIT ${offer.model.label} · ${source.label} · ${offer.channel} · $${offer.price}`);
        if (cooledDown) {
          hits.push({ ...offer, retailer: source.label });
          prev.lastAlertAt = iso(now());
        } else {
          console.log('       (within cooldown, not emailing)');
        }
      }
      prev.hit = hit;
      state.offers[offer.key] = prev;
    }
  }
  return hits;
}

// Sources that have been failing long enough to warrant one warning email.
function healthWarnings(state) {
  const out = [];
  for (const source of SOURCES) {
    const s = state.sources[source.id] ?? {};
    if (!s.lastError) continue;
    const down = hoursSince(s.downSince);
    if (down > CONFIG.healthWarnAfterHours && hoursSince(s.lastHealthAlertAt) > CONFIG.healthRepeatHours) {
      out.push({ label: source.label, error: s.lastError, hours: down });
      s.lastHealthAlertAt = iso(now());
    }
  }
  return out;
}

async function run() {
  const state = await readState();
  state.offers ??= {};
  state.sources ??= {};

  const deadline = Date.now() + LOOP_SECONDS * 1000;
  let n = 0;
  let alerts = 0;

  do {
    const deep = n % DEEP_EVERY === 0;
    const hits = await cycle(state, deep);
    if (hits.length) {
      alerts += hits.length;
      console.log(`  -> emailing ${hits.length} offer(s)`);
      if (!DRY_RUN) {
        try {
          await sendStockAlert(hits);
        } catch (err) {
          console.error('  ! email failed:', err.message);
        }
      }
    }
    n++;
    if (Date.now() + POLL_SECONDS * 1000 < deadline) await sleep(POLL_SECONDS * 1000);
    else break;
  } while (Date.now() < deadline);

  const unhealthy = healthWarnings(state);
  if (unhealthy.length) {
    console.log(`Health warning for ${unhealthy.length} source(s)`);
    if (!DRY_RUN) await sendHealthAlert(unhealthy);
  }

  console.log(`\n${n} poll cycle(s), ${alerts} alert(s) sent.`);
  if (!DRY_RUN) await writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

const money = (n) => `$${Number(n).toFixed(2)}`;

// A widely-available console can hit a dozen stores at once. Show the few
// that matter and count the rest, so the mail stays readable.
function summarise(hits) {
  const shown = [];
  const extra = new Map();
  for (const model of new Set(hits.map((h) => h.model.label))) {
    const group = hits
      .filter((h) => h.model.label === model)
      .sort((a, b) => a.price - b.price || (/Ship/i.test(b.channel) ? 1 : -1));
    shown.push(...group.slice(0, 3));
    if (group.length > 3) extra.set(model, group.length - 3);
  }
  return { shown, extra };
}

export async function sendStockAlert(hits) {
  const { shown, extra } = summarise(hits);
  const best = shown[0];
  const text = [
    `${best.model.label} is available. Stock can disappear in minutes.`,
    '',
    ...shown.map((h) =>
      [
        `${h.model.label} — ${h.retailer} — ${money(h.price)}`,
        `  ${h.channel}`,
        h.note ? `  ${h.note}` : null,
        `  ${h.url}`,
      ]
        .filter(Boolean)
        .join('\n')
    ),
    ...[...extra].map(([label, n]) => `+${n} more ${label} locations`),
    '',
    `Ceiling ${money(best.model.maxPrice)}.`,
  ].join('\n');

  const rows = shown
    .map(
      (h) => `
      <tr><td style="padding:14px 0;border-bottom:1px solid #eee;">
        <div style="font-weight:700;color:#111;">${h.model.label} — ${h.retailer} — ${money(h.price)}</div>
        <div style="color:#444;padding-top:4px;">${h.channel}</div>
        ${h.note ? `<div style="color:#888;padding-top:4px;">${h.note}</div>` : ''}
        <div style="padding-top:10px;"><a href="${h.url}" style="color:#0b5cff;font-weight:700;">Open product page →</a></div>
      </td></tr>`
    )
    .join('') +
    [...extra]
      .map(
        ([label, n]) =>
          `<tr><td style="padding:10px 0;color:#888;">+${n} more ${label} locations</td></tr>`
      )
      .join('');

  await notifyDesktop(
    `${best.model.label} in stock — ${best.retailer}`,
    `${money(best.price)} · ${best.channel}`
  );

  await send({
    subject: `${best.model.label} in stock — ${best.retailer} ${money(best.price)}`,
    text,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:15px;line-height:1.5;max-width:560px;margin:0 auto;padding:28px;">
        <div style="font-weight:700;color:#0a7d32;padding-bottom:6px;">${best.model.label} available</div>
        <div style="color:#444;padding-bottom:18px;">Stock can disappear in minutes.</div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        <div style="padding-top:26px;"><a href="${best.url}" style="display:inline-block;padding:14px 26px;background:#0a7d32;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">Buy now</a></div>
        <div style="color:#999;padding-top:30px;border-top:1px solid #eee;margin-top:26px;">Ceiling ${money(best.model.maxPrice)} · checked continuously</div>
      </div>`,
  });
}

async function sendHealthAlert(unhealthy) {
  const lines = unhealthy.map(
    (u) => `${u.label} — no successful read in ${u.hours.toFixed(0)}h (${u.error})`
  );
  await send({
    subject: 'PS5 Pro monitor — a source stopped responding',
    text: ['The monitor is partly blind:', '', ...lines, '', 'Other sources are still being checked. This warning repeats at most once a day.'].join('\n'),
    html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;padding:28px;max-width:560px;">
        <div style="font-weight:700;color:#b34700;padding-bottom:12px;">The monitor is partly blind</div>
        <ul style="color:#333;padding-left:18px;">${unhealthy
          .map((u) => `<li style="padding-bottom:8px;"><strong>${u.label}</strong> — no successful read in ${u.hours.toFixed(0)}h (${u.error})</li>`)
          .join('')}</ul>
        <div style="color:#666;padding-top:14px;">Other sources are still being checked. This warning repeats at most once a day.</div>
      </div>`,
  });
}

// TEST_ALERT=1 sends one clearly-labelled alert so delivery can be proven
// without waiting for a restock.
if (process.env.TEST_ALERT === '1') {
  await sendStockAlert([
    {
      retailer: '[TEST] Target',
      model: CONFIG.models[0],
      channel: 'This is a test, not a real restock',
      price: 899.99,
      url: 'https://www.target.com/p/playstation-5-pro-console/-/A-93620188',
      note: 'Delivery test of the alert path',
    },
  ]);
  console.log('Test alert sent.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
