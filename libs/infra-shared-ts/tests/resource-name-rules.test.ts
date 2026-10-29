import { expect, test } from 'bun:test';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import { envResourceNames } from '@libs/infra-shared-ts/naming';
import type { ResourceKind } from '@pkgs/resource-naming-shared-ts/provider-rules';
import { nameViolations } from '@pkgs/resource-naming-shared-ts/resource-name';

/**
 * Every name OpenTofu receives is one its provider accepts: buckets, Workers,
 * Hyperdrive configs and each label of every hostname. Names are derived from
 * the technical namespace and the environment (`@libs/infra-shared-ts/naming`,
 * placeholders resolved from the product identity), never typed by hand, so
 * this holds for any namespace the identity schema allows.
 */
function declaredNames(): [ResourceKind, string][] {
  const names: [ResourceKind, string][] = [
    ['cloudflare-r2-bucket', GLOBAL.state.bucket],
    ['cloudflare-r2-bucket', GLOBAL.shared_data.bucket],
    ['cloudflare-r2-bucket', GLOBAL.ci_artifacts.bucket],
    ['cloudflare-worker', GLOBAL.auth_relay.worker],
    ...GLOBAL.auth_relay.hostname
      .split('.')
      .map((label): [ResourceKind, string] => ['dns-label', label]),
  ];
  for (const env of Object.values(ENV_FILES)) {
    const resources = envResourceNames(env);
    names.push(
      ['cloudflare-worker', resources.worker],
      ['cloudflare-r2-bucket', resources.bucket],
      ['cloudflare-hyperdrive', resources.hyperdrive],
      ['dns-label', resources.s3_token],
      ...env.worker.retire.map((name): [ResourceKind, string] => [
        'cloudflare-worker',
        name,
      ])
    );
    if (env.worker.transfer_rooms_from !== undefined)
      names.push(['cloudflare-worker', env.worker.transfer_rooms_from]);
    for (const host of Object.values(env.hosts))
      for (const label of host.split('.')) names.push(['dns-label', label]);
  }
  return names;
}

test('every derived infrastructure name satisfies its provider’s naming rules', () => {
  const names = declaredNames();
  expect(names.length).toBeGreaterThan(20);
  const broken = names
    .map(([kind, name]) => ({
      kind,
      name,
      problems: nameViolations(kind, name),
    }))
    .filter((entry) => entry.problems.length > 0);
  expect(broken).toEqual([]);
});
