// @io-wall-ok — offline OpenTofu contract against its built-in provider.
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { releasePlanExclusions } from '@libs/infra-shared-ts/grafana-retirement';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const failingRule = 'module.observability_views[0].terraform_data.fast';
const runtime = 'terraform_data.runtime';

// regression: release-grafana-alert-rule-write
test('the saved product plan omits Grafana views while full foundation reconciliation detects their changes', () => {
  const cache = join(import.meta.dir, '../.cache');
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(join(cache, 'release-foundation-'));
  const tofu = execFileSync('mise', ['which', 'tofu'], {
    encoding: 'utf8',
  }).trim();
  const run = (args: string[]) =>
    execFileSync(tofu, args, { cwd: dir, encoding: 'utf8' });
  try {
    mkdirSync(join(dir, 'views'));
    writeFileSync(
      join(dir, 'views/main.tf'),
      'resource "terraform_data" "fast" { input = "alert rules" }\n'
    );
    writeFileSync(
      join(dir, 'main.tf'),
      'resource "terraform_data" "runtime" {}\nmodule "observability_views" {\n  count = 1\n  source = "./views"\n}\n'
    );
    run(['init', '-input=false', '-no-color']);
    const changes = (mode: string | undefined) => {
      run([
        'plan',
        '-input=false',
        '-out=saved',
        ...releasePlanExclusions('apply', 'foundation', mode),
      ]);
      const plan = JSON.parse(run(['show', '-json', 'saved'])) as {
        resource_changes: { address: string }[];
      };
      return plan.resource_changes.map((resource) => resource.address).sort();
    };
    expect(changes('true')).toEqual([runtime]);
    expect(changes('false')).toEqual([failingRule, runtime]);
    expect(releasePlanExclusions('drift', 'foundation', 'true')).toEqual([]);
    expect(releasePlanExclusions('apply', 'edge', 'true')).toEqual([]);
    expect(releasePlanExclusions('plan', 'foundation', 'true')).toEqual([]);
  } finally {
    removeTree(dir);
  }
});
