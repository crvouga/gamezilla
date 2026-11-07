#!/usr/bin/env node
// Shared by the ui-overhaul and ui-ux-overhaul skills; both copies must stay byte-identical.
// Commands:
//   init      --skill <name> --roster claude,codex --minimum 9 [--product <text>] --out run.json
//   manifest  --dir <evidence dir> --round <n> --sha <commit>
//   prompt    --run run.json --round round.json --out question.txt
//   verdict   --run run.json --round round.json --session <council session dir> [--format json|markdown]
import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUPPORTED_MEMBERS = ['claude', 'codex', 'gemini'];
export const VERDICT = {
  pass: 'PASS',
  anotherRound: 'ANOTHER_ROUND',
  incomplete: 'INCOMPLETE',
};

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const promptPath = join(packageDir, 'council-review-prompt.md');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `cannot read JSON ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function rubricSha256() {
  return sha256(readFileSync(promptPath, 'utf8'));
}

export function parseRoster(value) {
  const roster = String(value ?? '')
    .split(/[\s,]+/)
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  if (roster.length === 0)
    throw new Error('the council roster is empty: ask the user who reviews');
  const unsupported = roster.filter(
    (name) => !SUPPORTED_MEMBERS.includes(name)
  );
  if (unsupported.length > 0) {
    throw new Error(
      `agent-council cannot run ${unsupported.join(', ')} (it supports ${SUPPORTED_MEMBERS.join(', ')}): ask the user to change the roster`
    );
  }
  return [...new Set(roster)];
}

export function parseMinimum(value) {
  const minimum = Number(value);
  if (
    value === undefined ||
    value === '' ||
    !Number.isFinite(minimum) ||
    minimum < 0 ||
    minimum > 10
  ) {
    throw new Error(
      'the minimum rating must be a number from 0 to 10: ask the user for it'
    );
  }
  return minimum;
}

export function configSha256(run) {
  return sha256(
    JSON.stringify({
      skill: run.skill,
      roster: run.roster,
      minimum: run.minimum,
      rubric: run.rubricSha256,
    })
  );
}

export function initRun({ skill, roster, minimum, product = '' }) {
  if (!skill) throw new Error('--skill is required');
  const run = {
    skill,
    roster: parseRoster(roster),
    minimum: parseMinimum(minimum),
    rubricSha256: rubricSha256(),
    product,
    createdAt: new Date().toISOString(),
  };
  return { ...run, configSha256: configSha256(run) };
}

function listFiles(dir) {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? listFiles(path) : [path];
    })
    .sort();
}

export function buildManifest({ dir, round, sha }) {
  if (!sha || !/^[0-9a-f]{7,40}$/.test(sha))
    throw new Error('--sha must be a commit SHA');
  const files = listFiles(dir)
    .filter((path) => !path.endsWith('manifest.json'))
    .map((path) => ({
      path: relative(dir, path),
      sha256: sha256(readFileSync(path)),
    }));
  if (files.length === 0) throw new Error(`no evidence files under ${dir}`);
  const digest = sha256(JSON.stringify(files));
  return {
    evidenceId: `r${round}-${sha.slice(0, 7)}-${digest.slice(0, 8)}`,
    sha,
    round: Number(round),
    files,
  };
}

const PLACEHOLDER = /\{\{([A-Z_]+)\}\}/g;

export function renderPrompt(run, round) {
  const template = readFileSync(promptPath, 'utf8');
  const prompt = template.slice(
    template.indexOf('<!-- prompt:start -->') + '<!-- prompt:start -->'.length,
    template.indexOf('<!-- prompt:end -->')
  );
  const values = {
    PRODUCT: run.product || 'the product under review',
    ROUND: String(round.round),
    KIND: round.kind,
    START_SHA: round.startSha ?? '(none: baseline)',
    CANDIDATE_SHA: round.candidateSha,
    EVIDENCE_ID: round.evidenceId,
    EVIDENCE_DIR: round.evidenceDir,
    BEFORE_DIR: round.beforeDir ?? '(none: baseline)',
    JOURNEYS:
      (round.journeys ?? []).map((journey) => `- ${journey}`).join('\n') ||
      '- (see the evidence index)',
    SCREENS:
      (round.screens ?? []).map((screen) => `- ${screen}`).join('\n') ||
      '- (see the evidence index)',
    CHANGES: round.changes || '(baseline: nothing changed yet)',
    SCORE_BEFORE: round.rescoreBefore ? 'yes' : 'no',
  };
  const missing = [];
  const rendered = prompt.replace(PLACEHOLDER, (_, key) => {
    if (!(key in values) || values[key] === undefined) missing.push(key);
    return values[key] ?? '';
  });
  if (missing.length > 0)
    throw new Error(`round.json lacks ${[...new Set(missing)].join(', ')}`);
  return rendered.trim() + '\n';
}

function textOf(opinion) {
  const text = (
    typeof opinion.response === 'string'
      ? opinion.response
      : Object.values(opinion)
          .filter((value) => typeof value === 'string')
          .join('\n')
  ).replace(/[*`_]/g, '');
  const headings = [...text.matchAll(/^#+\s*Ratings\s*$/gim)];
  return headings.length > 0 ? text.slice(headings.at(-1).index) : text;
}

function score(text, label) {
  const match = text.match(
    new RegExp(`^\\s*${label}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*(?:/\\s*10)?`, 'im')
  );
  if (!match) return undefined;
  const value = Number(match[1]);
  return value >= 0 && value <= 10 ? value : undefined;
}

function field(text, label) {
  return text
    .match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im'))?.[1]
    ?.trim();
}

export function parseOpinion(opinion) {
  const text = textOf(opinion);
  return {
    candidate: field(text, 'CANDIDATE'),
    evidence: field(text, 'EVIDENCE'),
    designAfter: score(text, 'DESIGN AFTER'),
    uxAfter: score(text, 'UX AFTER'),
    designBefore: score(text, 'DESIGN BEFORE'),
    uxBefore: score(text, 'UX BEFORE'),
    scope: field(text, 'SCOPE')?.toLowerCase(),
    topFix: field(text, 'TOP FIX'),
  };
}

function sameSha(a, b) {
  if (!a || !b) return false;
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return (
    left.length >= 7 &&
    right.length >= 7 &&
    (left.startsWith(right) || right.startsWith(left))
  );
}

export function readSession(sessionDir) {
  const stage1 = join(sessionDir, 'stage1');
  if (!existsSync(stage1)) return {};
  return Object.fromEntries(
    readdirSync(stage1)
      .filter((name) => /^opinion_[a-z]+\.json$/.test(name))
      .map((name) => [
        name.slice('opinion_'.length, -'.json'.length),
        readJson(join(stage1, name)),
      ])
  );
}

function evaluateMembers(run, round, opinions, { rows, incomplete, failing }) {
  const carried = round.carriedBefore;
  const carriedApplies = Boolean(
    carried &&
      sameSha(carried.sha, round.startSha) &&
      carried.evidenceId &&
      carried.evidenceId === round.beforeEvidenceId
  );

  for (const member of run.roster) {
    const opinion = opinions[member];
    const row = {
      member,
      designBefore: null,
      designAfter: null,
      uxBefore: null,
      uxAfter: null,
      meets: false,
      topFix: null,
      problem: null,
    };
    rows.push(row);
    if (!opinion) {
      row.problem = 'no review in the council session';
    } else if (opinion.status !== 'ok') {
      row.problem = `review ${opinion.status ?? 'missing'}${opinion.error ? `: ${opinion.error}` : ''}`;
    } else {
      const parsed = parseOpinion(opinion);
      row.topFix = parsed.topFix ?? null;
      if (!sameSha(parsed.candidate, round.candidateSha))
        row.problem = `reviewed ${parsed.candidate ?? 'no stated commit'}, not ${round.candidateSha}`;
      else if (parsed.evidence !== round.evidenceId)
        row.problem = `reviewed evidence ${parsed.evidence ?? 'not stated'}, not ${round.evidenceId}`;
      else if (parsed.designAfter === undefined || parsed.uxAfter === undefined)
        row.problem = 'design or UX score missing or unreadable';
      else if (!parsed.topFix)
        row.problem = 'no most important remaining fix named';
      else {
        row.designAfter = parsed.designAfter;
        row.uxAfter = parsed.uxAfter;
        if (round.kind !== 'baseline') {
          if (
            parsed.designBefore !== undefined &&
            parsed.uxBefore !== undefined
          ) {
            row.designBefore = parsed.designBefore;
            row.uxBefore = parsed.uxBefore;
          } else if (carriedApplies && carried.scores?.[member]) {
            row.designBefore = carried.scores[member].design;
            row.uxBefore = carried.scores[member].ux;
          } else {
            row.problem =
              'no comparable before score: the previous ratings are for another revision or evidence set, so re-score the before set';
          }
        }
        if (!row.problem && !parsed.scope?.startsWith('respected'))
          failing.push(
            `${member} says the scope was ${parsed.scope ?? 'not assessed'}`
          );
        row.meets =
          row.designAfter >= run.minimum && row.uxAfter >= run.minimum;
        if (!row.problem && !row.meets)
          failing.push(
            `${member} rated design ${row.designAfter} and UX ${row.uxAfter}; both must be at least ${run.minimum}`
          );
      }
    }
    if (row.problem) {
      row.meets = false;
      incomplete.push(`${member}: ${row.problem}`);
    }
  }
}

export function evaluateRound(run, round, opinions) {
  const incomplete = [];
  const failing = [];
  const rows = [];

  if (configSha256(run) !== run.configSha256)
    incomplete.push(
      'run.json was edited after init: the roster, minimum or rubric changed'
    );
  if (round.configSha256 !== run.configSha256)
    incomplete.push(
      'round.json was made for a different roster, minimum or rubric'
    );
  if (run.rubricSha256 !== rubricSha256())
    incomplete.push(
      'council-review-prompt.md changed during the run: the rubric must stay fixed'
    );
  if (!round.candidateSha || !round.evidenceId)
    incomplete.push('round.json needs candidateSha and evidenceId');

  const checks = Array.isArray(round.checks) ? round.checks : [];
  if (checks.length === 0)
    incomplete.push('no check results recorded for the candidate');
  for (const check of checks) {
    if (check.status === 'fail') failing.push(`check ${check.name} failed`);
    else if (check.status !== 'pass')
      incomplete.push(
        `check ${check.name} is ${check.status ?? 'unknown'}, not pass`
      );
  }
  if (round.scopeRespected === false)
    failing.push(
      `scope audit failed: ${round.scopeNotes || 'see round notes'}`
    );
  else if (round.scopeRespected !== true)
    incomplete.push('scope audit not recorded');

  evaluateMembers(run, round, opinions, { rows, incomplete, failing });

  const ignored = Object.keys(opinions).filter(
    (member) => !run.roster.includes(member)
  );
  const verdict =
    incomplete.length > 0
      ? VERDICT.incomplete
      : failing.length > 0
        ? VERDICT.anotherRound
        : VERDICT.pass;
  return {
    verdict,
    finished: verdict === VERDICT.pass,
    round: round.round,
    candidateSha: round.candidateSha,
    minimum: run.minimum,
    rows,
    incomplete,
    failing,
    ignored,
  };
}

const cell = (value) =>
  value === null || value === undefined ? '—' : String(value);

export function renderMarkdown(result) {
  const lines = [
    '| Member | Design before | Design after | UX before | UX after | Meets minimum? |',
    '| --- | --- | --- | --- | --- | --- |',
    ...result.rows.map(
      (row) =>
        `| ${row.member} | ${cell(row.designBefore)} | ${cell(row.designAfter)} | ${cell(row.uxBefore)} | ${cell(row.uxAfter)} | ${row.problem ? 'No (review missing)' : row.meets ? 'Yes' : 'No'} |`
    ),
    '',
    `**Verdict: ${result.verdict}** (minimum ${result.minimum}/10 for both design and UX from every member, on ${result.candidateSha})`,
  ];
  for (const reason of [...result.incomplete, ...result.failing])
    lines.push(`- ${reason}`);
  if (result.ignored.length > 0)
    lines.push(
      `- Not on the roster, so not counted: ${result.ignored.join(', ')}`
    );
  return lines.join('\n') + '\n';
}

function flags(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith('--'))
      out[argv[index].slice(2)] = argv[index + 1]?.startsWith('--')
        ? 'true'
        : argv[(index += 1)];
  }
  return out;
}

function main(argv) {
  const [command, ...rest] = argv;
  const options = flags(rest);
  const required = (...names) => {
    const missing = names.filter((name) => !options[name]);
    if (missing.length > 0)
      throw new Error(`${command} needs --${missing.join(', --')}`);
  };
  switch (command) {
    case 'init': {
      required('skill', 'out');
      const run = initRun(options);
      writeFileSync(options.out, JSON.stringify(run, null, 2) + '\n');
      process.stdout.write(JSON.stringify(run, null, 2) + '\n');
      return 0;
    }
    case 'manifest': {
      required('dir', 'round', 'sha');
      const manifest = buildManifest(options);
      writeFileSync(
        join(options.dir, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n'
      );
      process.stdout.write(manifest.evidenceId + '\n');
      return 0;
    }
    case 'prompt': {
      required('run', 'round', 'out');
      writeFileSync(
        options.out,
        renderPrompt(readJson(options.run), readJson(options.round))
      );
      return 0;
    }
    case 'verdict': {
      required('run', 'round', 'session');
      const result = evaluateRound(
        readJson(options.run),
        readJson(options.round),
        readSession(options.session)
      );
      process.stdout.write(
        options.format === 'markdown'
          ? renderMarkdown(result)
          : JSON.stringify(result, null, 2) + '\n'
      );
      return result.finished
        ? 0
        : result.verdict === VERDICT.incomplete
          ? 3
          : 2;
    }
    default:
      process.stderr.write(
        'usage: council-round.mjs init|manifest|prompt|verdict [options]\n'
      );
      return 64;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `council-round: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
