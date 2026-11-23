// Brief: the board's story in a handful of plain sentences.
//
// The dashboard shows the numbers; this module turns the same numbers into the short briefing a
// reader sees first — what leads, where the value concentrates, what is moving, and what has
// waited longest. Every sentence is assembled from the scored board and the landscape aggregates,
// so the brief can never drift from the data under it: change the snapshot and the words change.

import type { BoardRow } from './model.ts';
import type { Insights } from './insights.ts';

/** A dollar figure the way the brief writes it: $856.4M, $12.3M, $950K. */
function money(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${Math.round(value / 1e3)}K`;
  return `$${value}`;
}

/** A count with thousands separators, for protocol and row counts in prose. */
function count(value: number): string {
  return value.toLocaleString('en-US');
}

/** The share of a whole as a whole-number percentage, for concentration claims. */
function share(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

/** The leader sentence: who tops the board and the ground the lead stands on. */
function leaderLine(board: BoardRow[]): string {
  const top = board[0]!;
  const second = board[1];
  const gap = second === undefined ? '' : `, ahead of ${second.name} at ${money(second.implied_value_usd)}`;
  return `${top.name} leads the radar at ${money(top.implied_value_usd)} implied value on ${money(top.tvl_usd)} of TVL${gap}.`;
}

/** The concentration sentence: how much of the board's value the leading categories hold. */
function concentrationLine(insights: Insights): string {
  const top = insights.categories.slice(0, 3);
  const held = top.reduce((a, c) => a + c.implied_usd, 0);
  const names = top.map((c) => c.category).join(', ');
  return `Three categories — ${names} — hold ${share(held, insights.totals.board_implied_usd)} of the board's ${money(insights.totals.board_implied_usd)} total implied value.`;
}

/** The coverage sentence: how much of the pre-token universe the board actually ranks. */
function coverageLine(board: BoardRow[], insights: Insights, watchlist: Set<string>): string {
  const watch = board.filter((r) => watchlist.has(r.slug)).length;
  return `The board ranks ${count(board.length)} protocols (${watch} from the watchlist, ${count(board.length - watch)} early) out of ${count(insights.totals.pre_token_protocols)} pre-token protocols in the snapshot.`;
}

/** The momentum sentence: the week's strongest mover and the size of its move. */
function momentumLine(insights: Insights): string | null {
  const first = insights.momentum[0];
  if (first === undefined) return null;
  const pct = `${first.change_7d >= 0 ? '+' : ''}${first.change_7d.toFixed(1)}%`;
  return `${first.name} is the week's fastest mover at ${pct} over seven days, on ${money(first.tvl_usd)} of TVL.`;
}

/** The patience sentence: the watchlist protocol that has waited longest for its token. */
function patienceLine(insights: Insights): string | null {
  const first = insights.longest_waiting[0];
  if (first === undefined) return null;
  const years = (first.age_days / 365).toFixed(1);
  return `${first.name} has run the longest without a token: ${count(first.age_days)} days (about ${years} years) with ${money(first.tvl_usd)} of TVL.`;
}

/** The method sentence: one line on how the numbers under the brief were produced. */
function methodLine(): string {
  return 'Every figure is recomputed from the snapshot itself — TVL, seven-day change, age and category standing — and each category is priced on its own calibrated multiple, with no hand-picked names or hard-coded winners.';
}

/**
 * The briefing as an ordered list of sentences: leader, concentration, coverage, then the
 * momentum and patience notes when the data carries them, and the method line last.
 */
export function buildBrief(board: BoardRow[], insights: Insights, watchlist: Set<string>): string[] {
  const lines = [leaderLine(board), concentrationLine(insights), coverageLine(board, insights, watchlist)];
  const momentum = momentumLine(insights);
  if (momentum !== null) lines.push(momentum);
  const patience = patienceLine(insights);
  if (patience !== null) lines.push(patience);
  lines.push(methodLine());
  return lines;
}
