# PS5 Pro stock alert

Watches the PlayStation 5 Pro at US retailers and emails **only** when it is
actually buyable at or below the price ceiling. Silent otherwise — no run
reports, no heartbeat mail.

## What it watches

| Source | Channels | Access |
|---|---|---|
| Target | Ship to address + pickup at 3 San Francisco stores | Public store API, no key |
| PlayStation Direct (Sony) | Ship to a US address | Public page, no key |
| Best Buy | Ship to address + stores within 25 mi of 94103 | Official Developer API, free key required |

Walmart, Costco, GameStop, Newegg, B&H and Amazon all reject automated
requests with a bot wall, so they are not covered.

## Where it runs, and why it runs in two places

Target's API answers a home connection but returns **HTTP 435 to datacenter
IPs**, so GitHub Actions cannot see Target at all. Verified on a real runner.

| Runner | Covers | Uptime |
|---|---|---|
| This Mac (launchd, every 10 min) | Target + Sony + Best Buy | Whenever the Mac is awake |
| GitHub Actions (every 10 min) | Sony + Best Buy | 24/7 |

Target is the source that was seen restocking, so the Mac runner is the
important one. The two keep separate state files and never conflict.

## Timing

A restock observed on 2026-09-21 lasted **under one minute**. A plain
10-minute check would have missed it. So each scheduled run polls in a loop
for ~9.5 minutes (every 30s) and exits before the next one starts, giving
effectively continuous coverage.

## Setup

1. Get a Resend API key at <https://resend.com/api-keys>.
2. In this repo: **Settings → Secrets and variables → Actions → New repository secret**.
3. Add `RESEND_API_KEY` = the key from step 1.
4. Add `NOTIFY_EMAIL` = the address alerts should go to.
5. Optional but recommended — add Best Buy:
   - Sign up at <https://developer.bestbuy.com/> (free, instant).
   - Add the key as the secret `BESTBUY_API_KEY`.
6. Confirm delivery works once:
   ```bash
   RESEND_API_KEY=xxx NOTIFY_EMAIL=you@example.com npm run test-email
   ```

> Resend without a verified sending domain only delivers to the email address
> that owns the Resend account. If step 6 fails, that is the reason — verify a
> domain, or use the Resend account that owns the destination address.

## Run it on this Mac

1. `cp .env.example .env` and fill in the two values.
2. `./local/install.sh`

That installs a launchd agent that runs every 10 minutes and survives
reboots. It only runs while the Mac is awake — plug in and set
**System Settings → Lock Screen → Turn display off** to *Never* if you want
overnight coverage.

```bash
tail -f monitor.log                                          # watch it
launchctl unload ~/Library/LaunchAgents/com.juancruz.ps5pro-alert.plist   # stop it
npm run dry                                                  # one-off, sends nothing
```

## Tuning

Everything lives in `config.js` or is overridable by environment variable.

| Variable | Default | Meaning |
|---|---|---|
| `MAX_PRICE` | `950` | Ignore anything above this — blocks scalper listings |
| `POLL_SECONDS` | `30` | Seconds between polls inside one run |
| `LOOP_SECONDS` | `570` | How long one run keeps polling |
| `DEEP_EVERY` | `4` | Check store-level stock every Nth poll |
| `ALERT_COOLDOWN_MIN` | `30` | Minimum gap between alerts for the same offer |
| `HEALTH_WARN_HOURS` | `8` | Warn if a source has been failing this long |

To go back to one check every 10 minutes, set `LOOP_SECONDS=1`.

## Failure behaviour

If a source stops responding for more than 8 hours the monitor sends **one**
warning email per day, so it can never go dark without you finding out. Other
sources keep working meanwhile.

`state.json` is written only when something genuinely changes, so the repo
does not accumulate a commit every ten minutes.
