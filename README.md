# PS5 stock alert

Watches the PlayStation 5 Pro at US retailers and emails **only** when it is
actually buyable at or below $900. Silent otherwise — no run reports, no
heartbeat mail.

The Digital Edition and the disc Slim are deliberately not watched: both sit
at MSRP in stock almost everywhere, so alerting on them is noise. The Pro is
the only one in short supply.

## What it watches

| Source | Channels | Access |
|---|---|---|
| ~~Target~~ | DISABLED at the user's request — its windows close inside ~60s, so every alert was unactionable by the time he read it | `SKIP_SOURCES=target` |
| Amazon | Ship to a US address | Plain HTTPS, no key |
| PlayStation Direct (Sony) | Ship to a US address | Public page, no key |
| Best Buy | Ship to address + stores within 25 mi of 94103 | Official Developer API, free key required |

Not covered, and why — each was tested, not assumed:

| Retailer | Result |
|---|---|
| Walmart | "Robot or human?" hold-to-confirm challenge, in a real browser too |
| GameStop | Cloudflare hard block (403) |
| Costco | Bot challenge |
| Newegg, B&H, Adorama | 403 |
| Amazon | Search page returns no usable listing data |
| Best Buy (site) | Connection reset even when driven by real Chrome |

Defeating those challenges is out of scope. Best Buy is reachable only
through its official Developer API, which is why the key matters: the one
Best Buy in San Francisco is store #187 at 1717 Harrison St.

Everything is anchored on 424 Clay Street, San Francisco 94111.

## Where it runs, and why it runs in two places

Target's API answers a home connection but returns **HTTP 435 to datacenter
IPs**, so GitHub Actions cannot see Target at all. Verified on a real runner.

| Runner | Covers | Uptime |
|---|---|---|
| This Mac (launchd, every 10 min) | Target + Sony + Best Buy | Whenever the Mac is awake |
| GitHub Actions (every 10 min) | Sony + Best Buy | 24/7 |

Target is the source that was seen restocking, so the Mac runner is the
important one. The two keep separate state files and never conflict.

## Only new, only first-party

Three independent gates, so a reseller cannot slip through by pricing under
the ceiling:

1. **Structural** — Target Plus partner listings are dropped on
   `is_marketplace` and on a non-empty `product_vendors`; Best Buy
   marketplace items are dropped on `marketplace` and on a seller that is
   not Best Buy itself. Sony's own store is first-party by definition.
2. **Condition** — refurbished, renewed, open-box, pre-owned and used
   listings are excluded by name and, at Best Buy, by `condition`.
3. **Price** — anything above `MAX_PRICE` is ignored.

## Timing

A restock observed on 2026-09-21 lasted **under one minute**, so a periodic
check is the wrong shape: the process polls in a loop instead, every 10s for
Target and every 60s for the others.

The Mac runner is a `KeepAlive` agent, not an interval one. An earlier
version used `StartInterval 600` with a 9.5-minute loop, which left a
~10-minute dead gap between runs — launchd will not start the next run until
the current one exits, and only then starts counting the interval. Measured
on 2026-09-23: runs at 11:19, 11:38 and 11:58, roughly half the wall clock
uncovered. `KeepAlive` restarts the process the moment it exits, so coverage
is continuous.

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

A sleeping Mac stops polling, and launchd cannot wake it. Overnight on
2026-09-21 that cost ~70% of the expected runs. To hold it awake while
plugged in:

```bash
./local/keep-awake.sh        # on
./local/keep-awake.sh off    # back to normal
```

```bash
tail -f monitor.log                                          # watch it
launchctl unload ~/Library/LaunchAgents/com.juancruz.ps5pro-alert.plist   # stop it
npm run dry                                                  # one-off, sends nothing
```

## Tuning

Everything lives in `config.js` or is overridable by environment variable.

| Variable | Default | Meaning |
|---|---|---|
| `MAX_PRICE_PRO` | `900` | Ceiling for the PS5 Pro |
| `POLL_SECONDS` | `30` | Seconds between polls inside one run |
| `LOOP_SECONDS` | `570` | How long one run keeps polling |
| `DEEP_EVERY` | `4` | Check store-level stock every Nth poll |
| `ALERT_COOLDOWN_MIN` | `30` | Minimum gap between alerts for the same offer |
| `HEALTH_WARN_HOURS` | `8` | Warn if a source has been failing this long |

To go back to one check every 10 minutes, set `LOOP_SECONDS=1`.

## What happens the moment stock is seen

In this order, fastest signal first:

1. The product page opens in the default browser.
2. A desktop banner fires with a sound.
3. The email goes out, carrying the delivery date the retailer returned as
   proof the offer was real.
4. When that window closes, a second email says so and how long it lasted, so
   reading the first one hours later still tells you whether it is worth trying.

It never adds to a cart and never buys. Automated checkout is off the table:
it needs per-purchase consent, and it means driving a retailer's bot
protection, which risks the account. Set `NO_AUTO_OPEN=1` to stop the page
from opening.

## Failure behaviour

If a source stops responding for more than 8 hours the monitor sends **one**
warning email per day, so it can never go dark without you finding out. Other
sources keep working meanwhile.

`state.json` is written only when something genuinely changes, so the repo
does not accumulate a commit every ten minutes.
