// Insights: the landscape around the ranked board, computed from the same snapshot.
//
// The board answers "which pre-token protocols carry the most implied value". These aggregates
// answer the questions a reader asks next: which categories hold the pre-token value, which chains
// it sits on, where the week's momentum is, and which watchlist protocols have run longest without
// a token. Everything here is a fold over the snapshot's own records and the board the model
// already scored — no outside data, no hand-picked names.

import type { BoardRow, Snapshot, SnapshotProtocol } from './model.ts';
import { isPreToken } from './model.ts';

/** One category's pre-token landscape. */
export interface CategoryInsight {
  category: string;
  protocols: number;
  board_rows: number;
  tvl_usd: number;
  implied_usd: number;
  base_multiple: number;
  median_age_days: number | null;
  mean_growth_pct: number | null;
  leader_slug: string;
  leader_name: string;
}

/** One chain's pre-token footprint. */
export interface ChainInsight {
  chain: string;
  protocols: number;
  tvl_usd: number;
  board_rows: number;
}

/** A protocol moving fastest this week, by the snapshot's seven-day change. */
export interface MomentumRow {
  slug: string;
  name: string;
  change_7d: number;
  tvl_usd: number;
  implied_value_usd: number;
}

/** The whole landscape block the dashboard renders and the dossier carries as data.js content. */
export interface Insights {
  categories: CategoryInsight[];
  chains: ChainInsight[];
  momentum: MomentumRow[];
  longest_waiting: { slug: string; name: string; age_days: number; tvl_usd: number }[];
  totals: {
    pre_token_protocols: number;
    pre_token_tvl_usd: number;
    board_implied_usd: number;
    categories_covered: number;
    chains_covered: number;
  };
}

/** The middle value of a list of day counts, or null when no age is known. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** The mean of the finite seven-day changes, rounded to two decimals, or null when none is known. */
function meanGrowth(protocols: SnapshotProtocol[]): number | null {
  const known = protocols.map((p) => p.change_7d).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (known.length === 0) return null;
  return Math.round((known.reduce((a, b) => a + b, 0) / known.length) * 100) / 100;
}

/**
 * Per-category aggregates over the snapshot's pre-token protocols, with the board's implied value
 * folded in. Sorted by implied value so the dashboard's category table reads as a ranking of
 * where the pre-token value concentrates.
 */
export function categoryInsights(snapshot: Snapshot, board: BoardRow[]): CategoryInsight[] {
  const byCategory = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    const key = p.category ?? 'Other';
    const list = byCategory.get(key) ?? [];
    list.push(p);
    byCategory.set(key, list);
  }
  const boardBySlug = new Map(board.map((r) => [r.slug, r]));
  const out: CategoryInsight[] = [];
  for (const [category, list] of byCategory) {
    const rows = list.map((p) => boardBySlug.get(p.slug)).filter((r): r is BoardRow => r !== undefined);
    if (rows.length === 0) continue;
    const leader = rows.reduce((a, b) => (b.implied_value_usd > a.implied_value_usd ? b : a));
    out.push({
      category,
      protocols: list.length,
      board_rows: rows.length,
      tvl_usd: list.reduce((a, p) => a + p.tvl_usd, 0),
      implied_usd: rows.reduce((a, r) => a + r.implied_value_usd, 0),
      base_multiple: rows[0]!.model.base_multiple,
      median_age_days: median(rows.map((r) => r.age_days).filter((v): v is number => v !== null)),
      mean_growth_pct: meanGrowth(list),
      leader_slug: leader.slug,
      leader_name: leader.name,
    });
  }
  return out.sort((a, b) => b.implied_usd - a.implied_usd || (a.category < b.category ? -1 : 1));
}

/** Per-chain footprint: a multi-chain protocol counts once on each chain it names. */
export function chainInsights(snapshot: Snapshot, board: BoardRow[]): ChainInsight[] {
  const boardSlugs = new Set(board.map((r) => r.slug));
  const byChain = new Map<string, ChainInsight>();
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    for (const chain of p.chains) {
      const entry = byChain.get(chain) ?? { chain, protocols: 0, tvl_usd: 0, board_rows: 0 };
      entry.protocols += 1;
      entry.tvl_usd += p.tvl_usd;
      if (boardSlugs.has(p.slug)) entry.board_rows += 1;
      byChain.set(chain, entry);
    }
  }
  return [...byChain.values()]
    .filter((c) => c.board_rows > 0)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.chain < b.chain ? -1 : 1))
    .slice(0, 12);
}

/** The week's fastest movers on the board, by seven-day change, strongest first. */
export function momentumRows(board: BoardRow[], limit = 8): MomentumRow[] {
  return board
    .filter((r) => r.change_7d !== null && Number.isFinite(r.change_7d))
    .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0) || b.implied_value_usd - a.implied_value_usd)
    .slice(0, limit)
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      change_7d: r.change_7d!,
      tvl_usd: r.tvl_usd,
      implied_value_usd: r.implied_value_usd,
    }));
}

/** The watchlist protocols that have waited longest for a token, oldest first. */
export function longestWaiting(snapshot: Snapshot, board: BoardRow[], limit = 5): Insights['longest_waiting'] {
  const watch = new Set(snapshot.watchlist);
  return board
    .filter((r) => watch.has(r.slug) && r.age_days !== null)
    .sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0))
    .slice(0, limit)
    .map((r) => ({ slug: r.slug, name: r.name, age_days: r.age_days!, tvl_usd: r.tvl_usd }));
}

/** The full landscape for one snapshot and its scored board. */
export function buildInsights(snapshot: Snapshot, board: BoardRow[]): Insights {
  const preToken = snapshot.protocols.filter(isPreToken);
  const categories = categoryInsights(snapshot, board);
  return {
    categories,
    chains: chainInsights(snapshot, board),
    momentum: momentumRows(board),
    longest_waiting: longestWaiting(snapshot, board),
    totals: {
      pre_token_protocols: preToken.length,
      pre_token_tvl_usd: preToken.reduce((a, p) => a + p.tvl_usd, 0),
      board_implied_usd: board.reduce((a, r) => a + r.implied_value_usd, 0),
      categories_covered: categories.length,
      chains_covered: new Set(board.flatMap((r) => r.chains)).size,
    },
  };
}
