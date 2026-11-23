# How radar-3 scores a protocol

This note is the long-form companion to the model panel inside the dashboard. It records what the
model reads, what each multiplier means, and — just as important — what the model refuses to do.

## The question

The snapshot freezes a universe of protocols at one moment. Some already have a token; the rest do
not. The radar's job is to rank the tokenless ones by the market value each would plausibly carry
if it issued a token against the business it has already built — and to say, for each one, what a
person would concretely do to earn a share of that issue.

## What the model reads

Only the snapshot. For each protocol: its TVL, its seven-day TVL change, the date it was first
tracked (its age), the chains it runs on, and its category. Nothing is fetched, nothing is looked
up by name, and no protocol is mentioned anywhere in the scoring code. If a protocol leads the
board, it leads because its own figures put it there.

## The formula

```
implied value = TVL × category multiple × growth × maturity × reach × standing
category multiple = clamp(0.30 × age factor × scale factor, 0.15, 0.60)
```

- **The category multiple** is radar-3's calibration, replacing radar-2's single anchor. The 0.30
  anchor survives as the centre: it is the multiple a median protocol in a median category gets.
  Each category's own multiple moves from there by two factors read off the snapshot's pre-token
  population — the square root of its median age against the global median age (clamped to
  0.80–1.25) and the square root of its median TVL against the global median TVL (clamped to
  0.85–1.20). The reasoning: a category whose protocols are older and larger has demonstrably
  sustained more value per dollar of TVL, so a token issued against that business is priced on a
  higher multiple; a young, small category has not yet shown that, and is priced lower. The square
  roots damp the move and the clamps fence it, so one unusual median cannot price a whole category
  at twice or half the anchor on its own. A category with no recorded ages gets an age factor of
  exactly 1 — absence of evidence is priced as neutral, never as young or old.
- **Growth** reads the seven-day change. It is clamped to −60%…+120% before use, because the
  snapshot contains a handful of protocols whose week is a data artefact (a chain migration reads
  as a forty-fold jump), and an unclamped read would let one artefact own the board. Inside the
  clamp, each point of weekly change moves the multiplier by half a point.
- **Maturity** rises with age from 0.6 toward 1.0 over three years. A protocol that has held TVL
  for years without issuing has demonstrated the staying power a token price rests on; a
  three-week-old protocol has not, whatever its TVL says today.
- **Reach** adds 4% per additional chain, capped at five. Distribution is real value: the same
  TVL spread over four chains reaches more users than the same TVL on one.
- **Standing** places the protocol inside its own category, by TVL percentile among rankable
  pre-token peers, and moves the result ±10%. Category context matters because a mid-size lending
  protocol and a mid-size bridge are not the same business.

The multipliers are stored on each board row rounded to four decimals, and the implied value is
computed from those rounded multipliers. That is deliberate: the dashboard recomputes every row in
the reader's browser from the published multipliers, and the recompute must land on exactly the
number `board.json` carries. Precision that cannot survive republication is not precision.

## Who gets ranked

The board ranks 200 protocols: every watchlist protocol (the snapshot's own selection of large,
established, tokenless protocols), then the strongest early protocols below the watchlist floor
until the board is full. Protocols that already have a token are never ranked — they are shown in
the dashboard's separate live-token view, because their market value is a fact, not an estimate,
and mixing facts into an estimate table would flatter the estimates.

## The farm plans

Each row carries an eight-step plan generated from that protocol's own record: its category decides
the core action (deposit, lend, provide liquidity, stake, bridge), its first chain decides the gas
note, its TVL decides the suggested capital band, its age decides the suggested holding period.
Three steps read the protocol's own situation rather than its category: the entry-timing step
quotes its actual seven-day change (ride a warm week, stage into a falling one, keep a normal pace
otherwise), the breadth step splits the position across its real chain list when it runs on three
or more chains, and the standing step speaks to the category leader — the protocol holding the
largest TVL in its category on the board — about documenting the position for a retroactive
allocation, while long-running protocols (1,000+ days without a token) get the loyalty angle in
their hold step. The dashboard regenerates each plan in the page from the same record, so the plan
a reader sees is the plan `board.json` carries, word for word.

## What the model refuses to do

- It does not special-case any protocol by name, slug, or category beyond the standing percentile
  every protocol in that category receives by the same rule.
- It does not use data from outside the snapshot: no prices, no social signals, no rumours of
  announced tokens.
- It does not hide its working: every multiplier on every row is published, in `board.json` and in
  the dashboard's detail view, next to the figure it produced.
