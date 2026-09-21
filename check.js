import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { Resend } from 'resend';
import { CONFIG } from './config.js';
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
const POLL_SECONDS = Number(process.env.POLL_SECONDS ?? 30);
const DEEP_EVERY = Number(process.env.DEEP_EVERY ?? 4); // store-level check cadence

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One pass over every source. Returns the offers that just became buyable.
async function cycle(state, deep) {
  const hits = [];

  for (const source of SOURCES) {
    const s = (state.sources[source.id] ??= {});
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
      const priceOk = offer.price != null && offer.price <= CONFIG.maxPrice;
      const hit = Boolean(offer.inStock && priceOk);
      const prev = state.offers[offer.key] ?? {};
      const cooledDown = hoursSince(prev.lastAlertAt) * 60 > CONFIG.alertCooldownMinutes;

      if (hit && !prev.hit) {
        console.log(`  HIT ${source.label} · ${offer.channel} · ${offer.price}`);
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

function mailer() {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  if (!to) throw new Error('NOTIFY_EMAIL not set');
  return { resend: new Resend(apiKey), to };
}

const money = (n) => `$${Number(n).toFixed(2)}`;

async function sendStockAlert(hits) {
  const { resend, to } = mailer();
  const best = hits[0];
  const rows = hits
    .map(
      (h) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #eee;">
          <div style="font-weight:700;color:#111;">${h.retailer} — ${money(h.price)}</div>
          <div style="color:#444;padding-top:4px;">${h.channel}</div>
          ${h.note ? `<div style="color:#888;padding-top:4px;">${h.note}</div>` : ''}
          <div style="padding-top:10px;">
            <a href="${h.url}" style="color:#0b5cff;font-weight:700;">Open product page →</a>
          </div>
        </td>
      </tr>`
    )
    .join('');

  const { error } = await resend.emails.send({
    from: 'PS5 Pro Alert <onboarding@resend.dev>',
    to,
    subject: `PS5 Pro in stock — ${best.retailer} ${money(best.price)}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:15px;line-height:1.5;max-width:560px;margin:0 auto;padding:28px;">
        <div style="font-size:15px;font-weight:700;color:#0a7d32;padding-bottom:6px;">PS5 Pro available</div>
        <div style="color:#444;padding-bottom:18px;">Stock can disappear in minutes.</div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        <div style="padding-top:26px;">
          <a href="${best.url}" style="display:inline-block;padding:14px 26px;background:#0a7d32;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">Buy now</a>
        </div>
        <div style="color:#999;padding-top:30px;border-top:1px solid #eee;margin-top:26px;">
          Price ceiling ${money(CONFIG.maxPrice)} · checked every 10 minutes
        </div>
      </div>`,
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

async function sendHealthAlert(unhealthy) {
  const { resend, to } = mailer();
  const rows = unhealthy
    .map(
      (u) =>
        `<li style="padding-bottom:8px;"><strong>${u.label}</strong> — no successful read in ${u.hours.toFixed(0)}h (${u.error})</li>`
    )
    .join('');
  const { error } = await resend.emails.send({
    from: 'PS5 Pro Alert <onboarding@resend.dev>',
    to,
    subject: 'PS5 Pro monitor — a source stopped responding',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:15px;line-height:1.5;max-width:560px;margin:0 auto;padding:28px;">
        <div style="font-weight:700;color:#b34700;padding-bottom:12px;">The monitor is partly blind</div>
        <ul style="color:#333;padding-left:18px;">${rows}</ul>
        <div style="color:#666;padding-top:14px;">Other sources are still being checked. This warning repeats at most once a day.</div>
      </div>`,
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
