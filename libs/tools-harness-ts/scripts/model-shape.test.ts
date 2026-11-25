import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { campaignBindings } from '../conformance/campaigns';
import { modelShapeProblems } from './model-shape';
import { specCampaigns } from './spec-campaigns';
import { REPO_ROOT } from './spec-packages';

test('registered campaign modules have their own checks and must run in the gate', () => {
  // regression: model-shape-campaign-discovery
  // regression: conformance-campaign-coverage
  const cache = join(REPO_ROOT, '.cache');
  mkdirSync(cache, { recursive: true });
  const root = mkdtempSync(join(cache, 'model-shape-'));
  try {
    const product = join(root, 'apps/product-ts');
    const system = join(root, 'specs/system');
    mkdirSync(product, { recursive: true });
    mkdirSync(system, { recursive: true });
    writeFileSync(
      join(product, 'package.json'),
      JSON.stringify({
        name: '@apps/product-ts',
        quintCampaignDomains: ['system'],
        scripts: {
          test: 'bun test tests/quint/simulation.test.ts tests/quint/effectiveness.test.ts',
          'test:contract': 'bun test tests/quint/model-checks.test.ts',
        },
      })
    );
    const task = {
      inputs: ['$TURBO_ROOT$/specs/system/**', '$TURBO_ROOT$/specs/billing/**'],
    };
    writeFileSync(
      join(product, 'turbo.json'),
      JSON.stringify({
        tasks: { test: task, 'test:contract': task },
      })
    );
    writeFileSync(
      join(system, 'access-sync.qnt'),
      '// @spec-interpretation\n// Sources: specs/billing\nmodule access_sync {}\n'
    );

    const campaigns = new Set(
      specCampaigns(root).map((campaign) => campaign.domain)
    );
    expect([...campaigns]).toEqual(['system']);
    expect(modelShapeProblems(campaigns, root, new Set())).toEqual([]);
    expect(modelShapeProblems(new Set(), root, new Set())).toContain(
      'specs/system/access-sync.qnt:1: an aggregate needs action init [missing-init]'
    );

    const gated = campaignBindings(
      new Set(['@apps/product-ts#test', '@apps/product-ts#test:contract']),
      root
    );
    expect(gated.problems).toEqual([]);
    expect(gated.specs).toEqual([
      {
        path: 'specs/system/access-sync.qnt',
        context: 'system',
        kind: 'dynamics',
        bound: true,
        harness: false,
        live: false,
      },
    ]);
    const ungated = campaignBindings(new Set(), root);
    expect(ungated.problems).toContain(
      'specs/system/: the release gate does not run @apps/product-ts#test:contract'
    );
    expect(ungated.specs[0]?.bound).toBe(false);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});
