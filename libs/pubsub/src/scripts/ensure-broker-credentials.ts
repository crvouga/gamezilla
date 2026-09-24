// @io-wall-ok — provision step: Infisical admin store + Railway + broker HTTP.
import { join } from 'node:path';
import { wallTimers } from '@pkgs/clock';
import {
  deployServiceCommit,
  readServiceVariables,
  upsertVariables,
} from '@pkgs/emqx-server/railway/railway-api';
import type { HttpClient } from '@pkgs/http-client';
import type { Logger } from '@pkgs/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { createSecretAdminStore } from '@pkgs/secret-provider';
import {
  deleteStaleApiKeys,
  emqxBrokerVariables,
  resolveEmqxCredentials,
  waitForBroker,
} from '../shared/provision/emqx-broker-credentials';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
/** dev mirrors prd: both secrets envs point at the one Railway broker. */
const SECRETS_ENVS = ['prd', 'dev'] as const;
const BROKER_WAIT_ATTEMPTS = 120;
const BROKER_WAIT_INTERVAL_MS = 5_000;

export type BrokerService = {
  readonly token: string;
  readonly projectId: string;
  readonly environmentId: string;
  readonly serviceId: string;
};

function randomHex(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function variablesDiffer(
  current: Readonly<Record<string, string>>,
  desired: Readonly<Record<string, string>>
): boolean {
  return Object.entries(desired).some(([k, v]) => current[k] !== v);
}

/**
 * Mint broker credentials when missing or public, store them in both secrets
 * envs, hand them to the Railway service, and return once the live broker
 * accepts them (stale API keys removed).
 */
export async function ensureBrokerCredentials(args: {
  readonly service: BrokerService;
  readonly apiUrl: string;
  readonly baseVariables: Readonly<Record<string, string>>;
  readonly http: HttpClient;
  readonly log: Logger;
}): Promise<void> {
  const store = await createSecretAdminStore({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
  });
  const { credentials, rotated } = resolveEmqxCredentials(
    await store.exportSecrets('prd'),
    randomHex
  );
  const variables = {
    ...args.baseVariables,
    ...emqxBrokerVariables(credentials),
  };
  for (const name of rotated) {
    for (const env of SECRETS_ENVS) {
      await store.setSecret(name, variables[name] ?? '', env);
    }
    args.log.info(`· ${name} minted (prd + dev)`);
  }

  const current = await readServiceVariables(args.service);
  if (variablesDiffer(current, variables)) {
    await upsertVariables({ ...args.service, variables, skipDeploys: true });
    const commitSha = process.env['GITHUB_SHA']?.trim();
    await deployServiceCommit({
      ...args.service,
      ...(commitSha ? { commitSha } : {}),
    });
    args.log.info('· Railway variables updated; broker redeploying');
  }

  await waitForBroker({
    http: args.http,
    timers: wallTimers,
    apiUrl: args.apiUrl,
    credentials,
    attempts: BROKER_WAIT_ATTEMPTS,
    intervalMs: BROKER_WAIT_INTERVAL_MS,
  });
  const removed = await deleteStaleApiKeys(args.http, args.apiUrl, credentials);
  if (removed.length > 0)
    args.log.info(`· removed stale API keys: ${removed.join(', ')}`);
  args.log.info('✓ EMQX broker accepts the provisioned credentials');
}
