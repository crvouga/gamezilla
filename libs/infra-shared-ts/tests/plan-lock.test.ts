import { expect, test } from 'bun:test';
import { DRIFT_STOP_SIGNALS } from '@libs/infra-shared-ts/drift-process-policy';
import { grafanaRetirementArgs } from '@libs/infra-shared-ts/grafana-retirement';
import { planArgs } from '@libs/infra-shared-ts/tofu-command';

const paths = { tofuDir: '/tofu', cacheDir: '/cache' };
const foundation = { stack: 'foundation' as const, env: 'dev' };

// regression: tofu-drift-sigkill-abandons-lock
test('read-only plans refuse the remote state lock so a killed runner cannot abandon it', () => {
  expect(planArgs(paths, foundation, { lock: false })).toContain('-lock=false');
  expect(planArgs(paths, foundation, { lock: true })).not.toContain(
    '-lock=false'
  );
  expect(planArgs(paths, foundation)).not.toContain('-lock=false');
  expect(grafanaRetirementArgs(paths, foundation, { lock: false })).toContain(
    '-lock=false'
  );
  expect(
    grafanaRetirementArgs(paths, foundation, { lock: true })
  ).not.toContain('-lock=false');
});

// regression: tofu-drift-sigkill-abandons-lock
test('drift stop interrupts before force-killing so OpenTofu can release state', () => {
  expect(DRIFT_STOP_SIGNALS).toEqual(['SIGINT', 'SIGKILL']);
});
