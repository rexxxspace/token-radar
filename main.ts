// Token Radar entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot, scores the pre-token universe with lib/model.ts, checks the board
// against the gate's own rules before writing anything, then emits the entry's outputs:
//
//   board.json    the ranked board (the deliverable the scorer reads first)
//   data.js       the dashboard's dataset: the board plus lib/insights.ts landscape aggregates
//   dashboard/    copied from this repository, rendered offline from data.js
//   screenshots/  copied from this repository (board, one detail view, one filtered view)
//   dossier.json  written last, by the vendored make.fun library, from the finished output
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, parseSnapshot } from './lib/model.ts';
import { buildInsights } from './lib/insights.ts';
import { buildBrief } from './lib/brief.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's caps, mirrored so a bad hand-in fails here instead of at the gate. */
const DOSSIER_TEXT_MAX = 65_536;
const SCREENSHOT_LIMITS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_LIMITS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** A `--flag value` or `--flag=value` argument, else the fallback. */
function readArg(flag: string, fallback: string): string {
  const args = process.argv.slice(2);
  const at = args.indexOf(`--${flag}`);
  if (at >= 0 && at + 1 < args.length) return args[at + 1]!;
  const inline = args.find((a) => a.startsWith(`--${flag}=`));
  return inline === undefined ? fallback : inline.slice(flag.length + 3);
}

function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

const inputArg = readArg('input', '/input');
const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  process.stderr.write(`token radar: no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const outDir = readArg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);

// data.js carries the radar rows plus the landscape aggregates and the plain-language briefing,
// as one script the page loads.
const insights = buildInsights(snapshot, board);
const briefing = buildBrief(board, insights, new Set(snapshot.watchlist));
writeFileSync(join(outDir, 'data.js'), `window.RADAR=${JSON.stringify({ ...radar, insights, briefing })};\n`);

/** Copy a directory's regular files into the output, skipping dotfiles; returns the names copied. */
function copyInto(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    names.push(name);
  }
  return names;
}

copyInto(join(repoDir, 'dashboard'), join(outDir, 'dashboard'));
const shots = copyInto(join(repoDir, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3) fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier is written last on purpose: the scorer rebuilds it from this output and compares.
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, { text_max_bytes: DOSSIER_TEXT_MAX, screenshots: SCREENSHOT_LIMITS, dashboard: DASHBOARD_LIMITS }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote board.json, data.js (with ${insights.categories.length} category insights), dashboard/, screenshots/ (${shots.length} images) and dossier.json to ${outDir}\n`,
);
