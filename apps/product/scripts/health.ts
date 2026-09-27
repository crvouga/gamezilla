#!/usr/bin/env bun
// @io-wall-ok — CLI: `@apps/product#health`, the live health of one environment.
/**
 * Runs every feature of this package's `liveDomains` (`specs/health/`,
 * `specs/journeys/`) against the environment `SECRETS_ENV` names — its
 * Workers, database, bucket, broker, secrets and infrastructure, and the
 * critical journeys in a real browser. The last step of every deploy and the
 * Health workflow's schedule.
 *
 * The environment picks the scenarios (tags):
 *   @production     only against production environments
 *   @oauth-relay    only against the relay environment
 *   @observability  not with OBSERVABILITY_ENABLED=0
 *
 *   health                                     everything
 *   health specs/health/sign-in.feature        one feature (repo-relative)
 *   health --tags '@domain:journeys'           narrowed further by tags
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isProductionEnv, oauthRelayEnv } from '@libs/infra/public/env-file';
import { ENV_FILES, envFile } from '@libs/infra/public/envs';
import { stubFileName, stubSource } from '@pkgs/gherkin/stubs';

const PACKAGE_DIR = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(PACKAGE_DIR, '../..');
const STUB_DIR = join(PACKAGE_DIR, '.cache/spec-live');
const STEPS_ENTRY = join(PACKAGE_DIR, 'tests/steps/index.ts');
/** Per scenario: a broker built from scratch gets ten minutes to come up. */
const SCENARIO_TIMEOUT_MS = 15 * 60 * 1000;

type Cli = {
  readonly featurePaths: readonly string[];
  readonly tags: string | undefined;
  readonly bunArgs: readonly string[];
};

function parseCli(argv: readonly string[]): Cli {
  const featurePaths: string[] = [];
  const bunArgs: string[] = [];
  let tags: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--tags') tags = argv[++i];
    else if (arg.startsWith('--tags=')) tags = arg.slice('--tags='.length);
    else if (arg.endsWith('.feature')) featurePaths.push(arg);
    else bunArgs.push(arg);
  }
  return { featurePaths, tags, bunArgs };
}

function liveDomains(): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')
  ) as { readonly liveDomains?: readonly string[] };
  return manifest.liveDomains ?? [];
}

function allFeatures(): readonly string[] {
  return liveDomains().flatMap((domain) => {
    const dir = join(REPO_ROOT, 'specs', domain);
    if (!existsSync(dir)) return [];
    return [...new Bun.Glob('*.feature').scanSync({ cwd: dir })]
      .sort()
      .map((file) => join(dir, file));
  });
}

function selectFeatures(cli: Cli): readonly string[] {
  const all = allFeatures();
  if (cli.featurePaths.length === 0) return all;
  return cli.featurePaths.map((given) => {
    const abs = resolve(REPO_ROOT, given);
    if (!all.includes(abs)) {
      console.error(
        `health: ${given} is not in liveDomains (${liveDomains().join(', ')})`
      );
      process.exit(1);
    }
    return abs;
  });
}

/** The tag expression this environment runs: what it cannot run is excluded. */
export function environmentTags(args: {
  readonly production: boolean;
  readonly relay: boolean;
  readonly observability: boolean;
}): readonly string[] {
  return [
    ...(args.production ? [] : ['not @production']),
    ...(args.relay ? [] : ['not @oauth-relay']),
    ...(args.observability ? [] : ['not @observability']),
  ];
}

function writeStubs(features: readonly string[]): readonly string[] {
  rmSync(STUB_DIR, { recursive: true, force: true });
  mkdirSync(STUB_DIR, { recursive: true });
  const bridge = Bun.resolveSync('@pkgs/gherkin/bun-test', import.meta.dir);
  return features.map((featurePath) => {
    const featureUri = relative(REPO_ROOT, featurePath);
    const file = join(STUB_DIR, stubFileName(featureUri));
    writeFileSync(
      file,
      stubSource({
        packageName: '@apps/product',
        featurePath,
        featureUri,
        stepsEntry: STEPS_ENTRY,
        bridge,
      })
    );
    return `./${relative(PACKAGE_DIR, file)}`;
  });
}

if (import.meta.main) {
  const cli = parseCli(process.argv.slice(2));
  const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
  const tags = [
    ...environmentTags({
      production: isProductionEnv(env),
      relay: oauthRelayEnv(Object.values(ENV_FILES)).env === env.env,
      observability:
        (process.env['OBSERVABILITY_ENABLED'] ?? '').trim() !== '0',
    }),
    ...(cli.tags === undefined ? [] : [`(${cli.tags})`]),
  ].join(' and ');
  console.log(`health: ${env.env}${tags.length > 0 ? ` — ${tags}` : ''}`);
  const stubs = writeStubs(selectFeatures(cli));
  if (stubs.length === 0) {
    console.error('health: nothing to run');
    process.exit(1);
  }
  const result = spawnSync(
    'bun',
    [
      'test',
      '--timeout',
      String(SCENARIO_TIMEOUT_MS),
      '--parallel',
      ...cli.bunArgs,
      ...stubs,
    ],
    {
      cwd: PACKAGE_DIR,
      stdio: 'inherit',
      env: { ...process.env, SPEC_TAGS: tags },
    }
  );
  process.exit(result.status ?? 1);
}
