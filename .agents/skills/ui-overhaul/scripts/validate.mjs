#!/usr/bin/env node
// Replays the stopping rule against the fixtures: only unanimous passage may finish the loop.
// Run: node scripts/validate.mjs   (exit 0 = every case behaved as expected)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateRound, initRun, readSession, renderPrompt, VERDICT } from './council-round.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '..', 'fixtures');
const skill = resolve(here, '..').split(/[\\/]/).at(-1);
const exitCodes = { [VERDICT.pass]: 0, [VERDICT.anotherRound]: 2, [VERDICT.incomplete]: 3 };

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

function load(name) {
  const dir = join(fixtures, name);
  const spec = readJson(join(dir, 'case.json'));
  const run = initRun({
    skill,
    roster: spec.roster.join(','),
    minimum: spec.minimum,
    product: 'a fixture app'
  });
  const round = { ...readJson(join(dir, 'round.json')), configSha256: run.configSha256 };
  return { dir, spec, run, round, opinions: readSession(join(dir, 'session')) };
}

const results = [];
function expect(label, actual, expected, finished) {
  const ok =
    actual.verdict === expected &&
    actual.finished === (expected === VERDICT.pass) &&
    finished === actual.finished;
  results.push({
    label,
    ok,
    expected,
    got: actual.verdict,
    reasons: [...actual.incomplete, ...actual.failing]
  });
}

const cases = readdirSync(fixtures).sort();
for (const name of ['unanimous-pass', 'below-threshold', 'missing-reviewer']) {
  if (!cases.includes(name))
    results.push({ label: name, ok: false, expected: 'fixture', got: 'missing', reasons: [] });
}

for (const name of cases) {
  const { dir, spec, run, round, opinions } = load(name);
  const result = evaluateRound(run, round, opinions);
  expect(name, result, spec.expectedVerdict, result.finished);

  const scratch = mkdtempSync(join(tmpdir(), 'council-round-'));
  writeFileSync(join(scratch, 'run.json'), JSON.stringify(run));
  writeFileSync(join(scratch, 'round.json'), JSON.stringify(round));
  const cli = spawnSync(
    process.execPath,
    [
      join(here, 'council-round.mjs'),
      'verdict',
      '--run',
      join(scratch, 'run.json'),
      '--round',
      join(scratch, 'round.json'),
      '--session',
      join(dir, 'session'),
      '--format',
      'markdown'
    ],
    { encoding: 'utf8' }
  );
  const tableOk =
    cli.stdout.includes(
      '| Member | Design before | Design after | UX before | UX after | Meets minimum? |'
    ) && cli.stdout.includes(`Verdict: ${spec.expectedVerdict}`);
  results.push({
    label: `${name} (CLI exit code and table)`,
    ok: cli.status === exitCodes[spec.expectedVerdict] && tableOk,
    expected: exitCodes[spec.expectedVerdict],
    got: cli.status,
    reasons: cli.stderr ? [cli.stderr.trim()] : []
  });
}

const base = load('unanimous-pass');
const guard = (label, mutate, expected) => {
  const run = clone(base.run);
  const round = clone(base.round);
  const opinions = clone(base.opinions);
  mutate({ run, round, opinions });
  const result = evaluateRound(run, round, opinions);
  expect(`guard: ${label}`, result, expected, result.finished);
};

guard(
  'a member reviewed another revision',
  ({ opinions }) => {
    opinions.codex.response = opinions.codex.response.replace(
      /CANDIDATE: \w+/,
      'CANDIDATE: 0123456789abcdef0123456789abcdef01234567'
    );
  },
  VERDICT.incomplete
);
guard(
  'a member reviewed another evidence set',
  ({ opinions }) => {
    opinions.claude.response = opinions.claude.response.replace(
      /EVIDENCE: \S+/,
      'EVIDENCE: r1-b2c4e6f-00000000'
    );
  },
  VERDICT.incomplete
);
guard(
  'a roster member has no opinion file',
  ({ opinions }) => {
    delete opinions.gemini;
  },
  VERDICT.incomplete
);
guard(
  'a relevant check failed',
  ({ round }) => {
    round.checks[1].status = 'fail';
  },
  VERDICT.anotherRound
);
guard(
  'a check was not run',
  ({ round }) => {
    round.checks[2].status = 'not-run';
  },
  VERDICT.incomplete
);
guard(
  'a member flags a scope violation',
  ({ opinions }) => {
    opinions.codex.response = opinions.codex.response.replace(
      'SCOPE: respected',
      'SCOPE: violated - the Save button moved to the header'
    );
  },
  VERDICT.anotherRound
);
guard(
  'the scope audit failed',
  ({ round }) => {
    round.scopeRespected = false;
  },
  VERDICT.anotherRound
);
guard(
  'before scores carried from another revision',
  ({ round }) => {
    round.carriedBefore.sha = 'ffffffffffffffffffffffffffffffffffffffff';
  },
  VERDICT.incomplete
);
guard(
  'the minimum was changed mid-run',
  ({ run }) => {
    run.minimum = 8;
  },
  VERDICT.incomplete
);
guard(
  'the roster was shrunk mid-run',
  ({ run }) => {
    run.roster = ['claude', 'codex'];
  },
  VERDICT.incomplete
);
guard(
  'a reviewer outside the roster is ignored, not counted',
  ({ opinions }) => {
    opinions.gemini2 = { ...opinions.gemini, agent: 'gemini2' };
  },
  VERDICT.pass
);

try {
  renderPrompt(base.run, base.round);
  results.push({
    label: 'review prompt renders with no unfilled placeholder',
    ok: !/\{\{[A-Z_]+\}\}/.test(renderPrompt(base.run, base.round)),
    expected: 'filled',
    got: 'filled',
    reasons: []
  });
} catch (error) {
  results.push({
    label: 'review prompt renders',
    ok: false,
    expected: 'filled',
    got: String(error),
    reasons: []
  });
}

for (const result of results) {
  process.stdout.write(
    `${result.ok ? 'ok  ' : 'FAIL'} ${result.label}: expected ${result.expected}, got ${result.got}\n`
  );
  if (!result.ok) for (const reason of result.reasons) process.stdout.write(`       ${reason}\n`);
}
const failed = results.filter((result) => !result.ok).length;
process.stdout.write(
  `${results.length - failed}/${results.length} cases behaved as expected (${skill})\n`
);
process.exitCode = failed === 0 ? 0 : 1;
