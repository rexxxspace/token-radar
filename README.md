# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/rexxxspace/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/rexxxspace/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token-launch radar for the make.fun `token-radar-01` bounty: every pre-token protocol in a sealed
DefiLlama snapshot, ranked by an implied value computed from the snapshot's own figures, each with a
concrete farm plan.

## Run it

```
node main.ts --input <snapshot.json> --output <dir>
```

Node 22, standard library only. It writes `board.json` (the ranked board), `data.js` (the dashboard's
dataset), `dashboard/` and `screenshots/` (copied from this repo), and `dossier.json` (built with the
vendored `vendor/makefun-board.ts`, which is the kit's file, unchanged).

## The model (radar-3)

One function scores every protocol; no name is special-cased.

```
implied = round( tvl_usd x category multiple
               x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)          growth
               x (0.6 + min(age_days, 1095) / 1095 x 0.4)               maturity
               x (1 + 0.04 x min(chains - 1, 5))                        reach
               x (0.90 + 0.20 x category TVL percentile) )              standing

category multiple = clamp( 0.30 x age factor x scale factor, 0.15, 0.60 )
  age factor   = clamp( sqrt(category median age / global median age), 0.80, 1.25 )
  scale factor = clamp( sqrt(category median TVL / global median TVL), 0.85, 1.20 )
```

- **Category multiple** — radar-3's calibration: the 0.30 anchor is what a median protocol in a
  median category gets. Categories whose protocols are older and larger have sustained more value
  per TVL dollar, so their multiple sits above the anchor; young, small categories sit below it.
  The medians come from the snapshot's own pre-token population — nothing is priced by hand.
- **Growth** — seven-day TVL change, clamped so one wild week cannot dominate.
- **Maturity** — days since first listing: how long the protocol has run with no token.
- **Reach** — each extra chain it already runs on is another surface a launch can be priced on.
- **Standing** — its TVL percentile inside its own category: category leaders are the benchmark a
  token gets priced against.

Each row publishes its category multiple and its four multipliers rounded to four decimals, and the
implied value is computed from those published figures — so the dashboard's in-page recompute lands
on exactly the number `board.json` carries, for every row.

The board covers the whole 40-protocol watchlist (the floor) and adds the 160 strongest pre-token
protocols below the floor as the early radar. Live-token protocols are set aside and shown at their
real market caps in the dashboard's Live token view.

## The dashboard

`dashboard/` is a static site with no network calls: it reads `data.js`, renders the ranked board,
and recomputes every row's implied value and farm plan in the page, so what the screenshots show is
exactly what `board.json` carries. Search, category filter, sortable columns, a per-protocol detail
drawer with the full model breakdown, and a live-token view.

Below the board, a landscape section (computed by `lib/insights.ts` from the same snapshot) shows
where the pre-token value concentrates: the ten leading categories with their leaders, the week's
fastest movers, the watchlist protocols that have waited longest for a token, and the chains with
the deepest pre-token footprints.

## Farm plans

Each row's plan is derived from its own record — category decides the action, the first chain
decides the gas note, TVL decides the capital, age decides the hold — eight steps, each with a cost
and a duration. Three steps read the protocol itself: its seven-day change sets the entry timing,
its chain list sets a multi-chain split when it runs on three or more chains, and the category
leader gets the retroactive-documentation step.

---

Entered on [make.fun](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
