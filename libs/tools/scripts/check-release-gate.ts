#!/usr/bin/env bun
// goal:the-bar:1
// @io-wall-ok — composition root
/**
 * Release gate (`//#ci:release-gate`): `//#deploy` must not contain any
 * verification leaf that is absent from `//#check`, because every check that
 * gates a release must also gate a PR merge. The only exceptions are leaves
 * that unavoidably mutate shared environments (provision, migrate, deploy,
 * smoke, and billing sync).
 *
 * Reads `turbo.json` from the repo root, parses `dependsOn` of `//#check` and
 * `//#deploy`, and compares them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const TURBO_PATH = 'turbo.json';

/** Leaves that mutate shared deploy environments and are exempt from the gate. */
const DEPLOY_ONLY_EXEMPTIONS = new Set([
  '@libs/secrets#provision',
  '@libs/db#provision',
  '@libs/object-store#provision',
  '@libs/pubsub#provision',
  '@libs/db#migrate',
  '@apps/room-server#deploy',
  '@apps/server#deploy',
  '@apps/product#deploy',
  '@libs/billing#billing:sync',
  '@apps/server#smoke',
]);

interface TurboJson {
  tasks?: Record<string, { dependsOn?: string[] }>;
}

function readTurboJson(): TurboJson {
  const path = join(ROOT, TURBO_PATH);
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as TurboJson;
}

function getDependsOn(turbo: TurboJson, taskKey: string): string[] {
  const task = turbo.tasks?.[taskKey];
  if (!task?.dependsOn) {
    console.error(`release gate: ${taskKey} not found or has no dependsOn`);
    process.exit(1);
  }
  return task.dependsOn;
}

function isVerificationLeaf(dep: string): boolean {
  // Filter out other //# tasks (meta-tasks) and exempt deploy-only leaves
  if (dep.startsWith('//#')) return false;
  if (DEPLOY_ONLY_EXEMPTIONS.has(dep)) return false;
  return true;
}

export function validateReleaseGate(
  checkDeps: string[],
  deployDeps: string[]
): string[] {
  const checkSet = new Set(checkDeps);
  const errors: string[] = [];

  for (const dep of deployDeps) {
    if (!isVerificationLeaf(dep)) continue;
    if (!checkSet.has(dep)) {
      errors.push(
        `${dep} is in //#deploy but not in //#check — every release check must also gate PR merges`
      );
    }
  }

  return errors;
}

if (import.meta.main) {
  const turbo = readTurboJson();
  const checkDeps = getDependsOn(turbo, '//#check');
  const deployDeps = getDependsOn(turbo, '//#deploy');

  const errors = validateReleaseGate(checkDeps, deployDeps);

  if (errors.length > 0) {
    console.error('release gate failed:');
    for (const err of errors) console.error(`  ${err}`);
    process.exit(1);
  }

  console.log('ok: all //#deploy verification leaves are also in //#check');
}
