// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and may add
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures:
//
//   base       = tvl_usd x categoryMultiple(category)
//   anchor     = BASE_MULTIPLE (0.30), the multiple a median protocol in a median category gets
//   categoryMultiple = clamp(anchor x ageFactor x scaleFactor, CALIB_FLOOR, CALIB_CAP), where
//     ageFactor   = clamp(sqrt(category median age / global median age), CALIB_AGE_MIN, CALIB_AGE_MAX)
//     scaleFactor = clamp(sqrt(category median TVL / global median TVL), CALIB_SCALE_MIN, CALIB_SCALE_MAX)
//     (medians over the snapshot's rankable pre-token protocols; a category with no known age
//      gets ageFactor 1)
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   reach      = 1 + REACH_PER_CHAIN x min(chains - 1, REACH_MAX_EXTRA)
//   standing   = STANDING_FLOOR + STANDING_RANGE x (the protocol's TVL percentile inside its own
//                category, among the snapshot's rankable pre-token protocols)
//   implied    = max(1, round(base x growthMult x maturity x reach x standing))
//
// The calibration is radar-3's change from radar-2's single anchor: one multiple for every
// category priced a young lending market and a mature one as the same business. Categories whose
// protocols are older and larger have demonstrably sustained more value per TVL dollar, so their
// multiple sits above the anchor; young, small categories sit below it. The factors are damped
// (square roots) and clamped, so no category's multiple runs away from the anchor on one median.
// Reach prices distribution: a protocol already live on several chains has more surfaces a token
// launch can be priced on. Standing prices category leadership: inside one vertical, the protocol
// that already holds the category's TVL is the one its token would be benchmarked against. All of
// it is computed from the snapshot alone. No protocol name is ever special-cased: the same function
// scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  reach_per_chain: number;
  reach_max_extra: number;
  standing_floor: number;
  standing_range: number;
  calib_floor: number;
  calib_cap: number;
  calib_age_min: number;
  calib_age_max: number;
  calib_scale_min: number;
  calib_scale_max: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  reach_per_chain: 0.04,
  reach_max_extra: 5,
  standing_floor: 0.9,
  standing_range: 0.2,
  calib_floor: 0.15,
  calib_cap: 0.6,
  calib_age_min: 0.8,
  calib_age_max: 1.25,
  calib_scale_min: 0.85,
  calib_scale_max: 1.2,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    reach_multiplier: number;
    standing_multiplier: number;
    category_percentile: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  reach_multiplier: number;
  standing_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  category_multiples: Record<string, number>;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Each rankable pre-token protocol's TVL percentile inside its own category (0..1, 0.5 when alone). */
export function categoryPercentiles(protocols: SnapshotProtocol[]): Map<string, number> {
  const groups = new Map<string, SnapshotProtocol[]>();
  for (const p of protocols) {
    if (!isRankable(p)) continue;
    const key = p.category ?? '';
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  const out = new Map<string, number>();
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.tvl_usd - b.tvl_usd || (a.slug < b.slug ? -1 : 1));
    sorted.forEach((p, i) => out.set(p.slug, sorted.length <= 1 ? 0.5 : i / (sorted.length - 1)));
  }
  return out;
}

/** The middle of a non-empty list of numbers. */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Each category's calibrated base multiple, from the snapshot's rankable pre-token population.
 * The key is the category name ('' for a protocol with none). Every multiple is the anchor moved
 * by the category's damped, clamped age and scale factors, rounded to four decimals so the value
 * the dashboard publishes is the value the board was scored with.
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): Map<string, number> {
  const rankable = snapshot.protocols.filter(isRankable);
  const globalAges = rankable.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((v): v is number => v !== null);
  const globalMedianAge = globalAges.length > 0 ? medianOf(globalAges) : model.unknown_age_days;
  const globalMedianTvl = rankable.length > 0 ? medianOf(rankable.map((p) => p.tvl_usd)) : 1;
  const groups = new Map<string, SnapshotProtocol[]>();
  for (const p of rankable) {
    const key = p.category ?? '';
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  const out = new Map<string, number>();
  for (const [key, list] of groups) {
    const ages = list.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((v): v is number => v !== null);
    const ageFactor = ages.length === 0 || globalMedianAge <= 0
      ? 1
      : clamp(Math.sqrt(medianOf(ages) / globalMedianAge), model.calib_age_min, model.calib_age_max);
    const scaleFactor = globalMedianTvl <= 0
      ? 1
      : clamp(Math.sqrt(medianOf(list.map((p) => p.tvl_usd)) / globalMedianTvl), model.calib_scale_min, model.calib_scale_max);
    out.set(key, round4(clamp(model.base_multiple * ageFactor * scaleFactor, model.calib_floor, model.calib_cap)));
  }
  return out;
}

/** The multipliers and the implied value one protocol gets under `model` and its category multiple. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants, categoryPercentile = 0.5, baseMultiple: number = model.base_multiple): { implied: number; growthPct: number; growthMult: number; maturityMult: number; reachMult: number; standingMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const reachMult = 1 + model.reach_per_chain * Math.min(Math.max(protocol.chains.length - 1, 0), model.reach_max_extra);
  const standingMult = model.standing_floor + model.standing_range * Math.min(1, Math.max(0, categoryPercentile));
  const base = protocol.tvl_usd * baseMultiple;
  // The implied value is computed from the multipliers as published (rounded to 4 decimals in each
  // row), so the dashboard's recompute from the same published inputs lands on the same number.
  const implied = Math.max(1, Math.round(base * round4(growthMult) * round4(maturityMult) * round4(reachMult) * round4(standingMult)));
  return { implied, growthPct, growthMult, maturityMult, reachMult, standingMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const percentiles = categoryPercentiles(snapshot.protocols);
  const multiples = categoryMultiples(snapshot, model);
  // Each chosen protocol's TVL rank inside its own category on this board (1 = largest), and the
  // category's size on the board. The farm plans quote both, and the dashboard recomputes them from
  // the same board rows, so the two sides cannot drift.
  const byCategory = new Map<string, SnapshotProtocol[]>();
  for (const p of chosen.values()) {
    const key = p.category ?? '';
    const list = byCategory.get(key) ?? [];
    list.push(p);
    byCategory.set(key, list);
  }
  const categoryRank = new Map<string, { rank: number; size: number }>();
  for (const list of byCategory.values()) {
    const sorted = [...list].sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
    sorted.forEach((p, i) => categoryRank.set(p.slug, { rank: i + 1, size: sorted.length }));
  }
  const scored = [...chosen.values()].map((p) => {
    const pct = percentiles.get(p.slug) ?? 0.5;
    const baseMultiple = multiples.get(p.category ?? '') ?? model.base_multiple;
    const { implied, growthPct, growthMult, maturityMult, reachMult, standingMult, age } = impliedValue(p, snapshot.as_of, model, pct, baseMultiple);
    return { p, implied, growthPct, growthMult, maturityMult, reachMult, standingMult, pct, age, baseMultiple };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: s.baseMultiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      reach_multiplier: round4(s.reachMult),
      standing_multiplier: round4(s.standingMult),
      category_percentile: round4(s.pct),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age, categoryRank.get(s.p.slug) ?? { rank: 1, size: 1 }).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('nft') || c.includes('gaming')) return `Buy one floor asset in ${name}'s market on ${chain} and hold it in the farm wallet.`;
  if (c.includes('launchpad')) return `Commit $${capital} to one open sale on ${name} and keep the allocation record.`;
  if (c.includes('oracle') || c.includes('index')) return `Deposit $${capital} into ${name}'s main product on ${chain} and keep the position open.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** What one transaction costs on the protocol's first chain, in plain terms. */
function gasNote(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'Ethereum mainnet gas runs $5-15 in busy hours, so batch actions into one visit';
  if (['arbitrum', 'optimism', 'base', 'zksync era', 'linea', 'scroll', 'mantle', 'blast', 'mode'].includes(c)) return `${chain} is a low-fee network, about $0.10-1 per transaction`;
  if (c === 'solana') return 'Solana fees are under $0.05 per transaction';
  if (['bsc', 'polygon', 'avalanche', 'fantom', 'gnosis', 'celo'].includes(c)) return `${chain} fees are low, usually under $1 per transaction`;
  return `keep about $5 of the ${chain} gas token ready for fees`;
}

/** A second, different action type for mid-hold, by category: breadth reads as real usage. */
function secondActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp')) return `Borrow a small amount against the supplied position on ${name}, then repay it a week later.`;
  if (c.includes('dex')) return `Make two swaps through ${name}'s own interface, a week apart, instead of only holding liquidity.`;
  if (c.includes('bridge')) return `Bridge a second, smaller amount back the other way through ${name} so both directions are on record.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim and re-stake the rewards on ${name} once, so the wallet shows a compounding action.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield')) return `Move a small part of the position into a second ${name} vault so the wallet holds two products.`;
  return `Use one more feature of ${name} than the deposit itself, such as a vote, a claim page visit with a signature, or a second product.`;
}

/** A seven-day change the way the plans quote it: +12.3%, -4.0%. */
function pctText(change: number): string {
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

/** The week's-signal step: momentum, a dip, or a steady week, from the protocol's own change_7d. */
function signalStep(p: SnapshotProtocol, capital: number): FarmStep {
  const change = p.change_7d;
  if (change !== null && change >= 5) {
    return {
      text: `Move while the week is warm: ${p.name}'s TVL grew ${pctText(change)} in seven days, so open the position early in the week rather than after the crowd.`,
      cost: 'no extra capital; the same position, opened sooner',
      time: '10 minutes, this week',
    };
  }
  if (change !== null && change <= -15) {
    return {
      text: `Stage the entry: ${p.name}'s TVL fell ${pctText(change)} this week, so split the $${capital} into two buys a few days apart instead of one.`,
      cost: `the same $${capital}, in two buys`,
      time: '15 minutes, twice this week',
    };
  }
  if (change !== null) {
    return {
      text: `Enter at a normal pace: ${p.name}'s TVL moved ${pctText(change)} this week, neither a rush nor a fire sale, so the standard weekly rhythm applies.`,
      cost: 'no extra capital; the same position',
      time: '10 minutes, this week',
    };
  }
  return {
    text: `Enter at a normal pace: the snapshot records no seven-day change for ${p.name}, so the standard weekly rhythm applies.`,
    cost: 'no extra capital; the same position',
    time: '10 minutes, this week',
  };
}

/** The breadth step: a multi-chain split when the protocol runs on three or more chains. */
function breadthStep(p: SnapshotProtocol): FarmStep {
  if (p.chains.length >= 3) {
    return {
      text: `Split the position across ${p.name}'s chains: keep the main share on ${p.chains[0]}, and place a smaller share on ${p.chains[1]} and on ${p.chains[2]}, so the wallet is active wherever the protocol is.`,
      cost: 'about $3 of gas per extra chain, once',
      time: '20 minutes, in the first week',
    };
  }
  return {
    text: secondActionFor(p),
    cost: 'about $2 of gas, once',
    time: '10 minutes, in the second week',
  };
}

/** The standing step: category leaders get the retroactive angle; everyone else gets the claim check. */
function standingStep(p: SnapshotProtocol, ctx: { rank: number; size: number }): FarmStep {
  if (ctx.rank === 1 && ctx.size > 1) {
    return {
      text: `${p.name} holds the largest TVL of the ${ctx.size} ${p.category ?? 'its category'} protocols on this board, so keep the position documented from day one: category leaders are where a retroactive allocation usually looks first.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    };
  }
  return {
    text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
    cost: 'no fee to check, and never pay to claim',
    time: '10 minutes',
  };
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record — its category picks the actions, its chains the gas and the
 * breadth step, its TVL the capital, its age the hold, its seven-day change the entry timing, and
 * its TVL rank inside its category on the board the standing step — never from a hand-written list
 * of names. The dashboard regenerates the identical plan in the page from the same record.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, ctx: { rank: number; size: number } = { rank: 1, size: 1 }): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const holdText = age !== null && age >= 1000
    ? `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot; ${p.name} has run ${age} days without a token, and long histories are what retroactive snapshots reward.`
    : `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital; ${gasNote(chain)}`,
      time: '15 minutes to set up',
    },
    signalStep(p, capital),
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    breadthStep(p),
    {
      text: holdText,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    standingStep(p, ctx),
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    reach_multiplier: row.model.reach_multiplier,
    standing_multiplier: row.model.standing_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    category_multiples: Object.fromEntries(categoryMultiples(snapshot, model)),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
