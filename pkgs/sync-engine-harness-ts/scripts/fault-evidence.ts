// @io-wall-ok — evidence entry point; writes the sweep summary and chart under .cache/.
/**
 * Evidence for the offline-first fault sweep: run `--seeds` seeded runs of
 * the workload under every named fault profile and write a summary
 * (`.cache/fault-evidence/summary.json`) and a bar chart
 * (`.cache/fault-evidence/chart.svg`) of runs, fault moves and violations
 * per profile. Deterministic: the same seed range gives the same files.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FaultProfileName } from '@pkgs/sync-engine-harness-ts/fault-profiles';
import { FAULT_PROFILE_NAMES } from '@pkgs/sync-engine-harness-ts/fault-profiles';
import { DEVICES, sweepOnce } from '@pkgs/sync-engine-harness-ts/offline-sweep';
import { seededWorkload } from '@pkgs/sync-engine-harness-ts/offline-workload';

const MAX_STEPS = 14;

type ProfileSummary = {
  readonly profile: FaultProfileName;
  readonly runs: number;
  readonly moves: number;
  readonly writes: number;
  readonly failingSeeds: readonly number[];
  readonly maxConvergedAfterMs: number;
};

function seedsArg(): number {
  const at = process.argv.indexOf('--seeds');
  const raw = at >= 0 ? Number(process.argv[at + 1]) : 200;
  return Number.isInteger(raw) && raw > 0 ? raw : 200;
}

async function summarize(
  profile: FaultProfileName,
  seeds: number
): Promise<ProfileSummary> {
  let moves = 0;
  let writes = 0;
  let maxConvergedAfterMs = 0;
  const failingSeeds: number[] = [];
  for (let seed = 1; seed <= seeds; seed += 1) {
    const steps = seededWorkload(seed, DEVICES.length, MAX_STEPS);
    const outcome = await sweepOnce(profile, seed, steps);
    moves += outcome.moves.length;
    writes += outcome.writes;
    if (outcome.violations.length > 0) failingSeeds.push(seed);
    maxConvergedAfterMs = Math.max(
      maxConvergedAfterMs,
      outcome.convergedAfterMs ?? 0
    );
  }
  return {
    profile,
    runs: seeds,
    moves,
    writes,
    failingSeeds,
    maxConvergedAfterMs,
  };
}

const W = 760;
const ROW = 40;
const LEFT = 110;

function bar(y: number, width: number, fill: string): string {
  return `<rect x="${LEFT}" y="${y}" width="${Math.max(1, width)}" height="14" rx="3" fill="${fill}"/>`;
}

function chart(rows: readonly ProfileSummary[]): string {
  const maxMoves = Math.max(1, ...rows.map((r) => r.moves));
  const h = 70 + rows.length * ROW + 30;
  const body = rows
    .map((r, i) => {
      const y = 60 + i * ROW;
      const span = W - LEFT - 160;
      return [
        `<text x="${LEFT - 10}" y="${y + 12}" text-anchor="end">${r.profile}</text>`,
        bar(y, (r.moves / maxMoves) * span, '#3b6fd8'),
        bar(y + 16, (r.failingSeeds.length / r.runs) * span, '#d8453b'),
        `<text x="${W - 150}" y="${y + 12}">${r.moves} faults</text>`,
        `<text x="${W - 150}" y="${y + 28}">${r.runs - r.failingSeeds.length}/${r.runs} runs pass</text>`,
      ].join('');
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" font-family="sans-serif" font-size="13">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="20" y="28" font-size="16" font-weight="bold">Offline-first invariants per fault profile (${rows[0]?.runs ?? 0} seeded runs each)</text>
<rect x="${LEFT}" y="38" width="12" height="10" fill="#3b6fd8"/><text x="${LEFT + 18}" y="47">fault moves injected</text>
<rect x="${LEFT + 170}" y="38" width="12" height="10" fill="#d8453b"/><text x="${LEFT + 188}" y="47">share of runs breaking an invariant</text>
${body}
</svg>`;
}

const seeds = seedsArg();
const rows: ProfileSummary[] = [];
for (const profile of FAULT_PROFILE_NAMES) {
  rows.push(await summarize(profile, seeds));
}
const out = join(import.meta.dir, '..', '.cache', 'fault-evidence');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'summary.json'), `${JSON.stringify(rows, null, 2)}\n`);
writeFileSync(join(out, 'chart.svg'), chart(rows));
for (const r of rows) {
  console.log(
    `${r.profile}\truns=${r.runs}\tmoves=${r.moves}\twrites=${r.writes}\tfailing=${r.failingSeeds.length}\tmaxConvergeMs=${r.maxConvergedAfterMs}`
  );
}
