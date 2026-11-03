// @io-wall-ok — inspect the public workflow/action input contracts.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');
type Step = { uses?: string; with?: Record<string, string> };
type Workflow = { jobs: Record<string, { steps?: Step[] }> };

test('composite identity configuration travels through declared inputs', () => {
  // regression: composite-identity-input-scope
  const auth = readFileSync(
    join(root, '.github/actions/secrets-auth/action.yml'),
    'utf8'
  );
  expect(auth).not.toContain('${{ vars.');
  const setupText = readFileSync(
    join(root, '.github/actions/setup/action.yml'),
    'utf8'
  );
  expect(setupText).not.toContain('${{ vars.');
  expect(setupText).toContain(
    'REPOSITORY_IDENTITY_JSON: ${{ inputs.product-identity-json }}'
  );
  const setup = Bun.YAML.parse(setupText) as {
    inputs: Record<string, { default?: string }>;
    runs: { steps: Array<Step & { name?: string; if?: string }> };
  };
  expect(setup.inputs['product-identity-mode']?.default).toBe('fixture');
  const names = setup.runs.steps.map((step) => step.name);
  expect(names.indexOf('Inject public build identity')).toBeGreaterThan(
    names.indexOf('Inject secrets')
  );
  expect(names.indexOf('Configure deployment identity')).toBeGreaterThan(
    names.indexOf('Inject public build identity')
  );
  expect(
    setup.runs.steps.find(
      (step) => step.name === 'Configure deployment identity'
    )?.if
  ).toBe("inputs.product-identity-mode == 'configured'");
  for (const name of ['verify-pr', 'verify-nightly', 'deploy', 'health']) {
    const workflow = Bun.YAML.parse(
      readFileSync(join(root, `.github/workflows/${name}.yml`), 'utf8')
    ) as Workflow;
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        if (step.uses !== './.github/actions/setup') continue;
        expect(step.with?.['product-identity-json'], name).toBe(
          '${{ vars.PRODUCT_IDENTITY_JSON }}'
        );
        if (name === 'deploy' || name === 'health')
          expect(step.with?.['product-identity-mode'], name).toBe('configured');
      }
    }
  }
});

test('configured builds check source spellings after identity materialization', () => {
  const rootGraph = JSON.parse(
    readFileSync(join(root, 'turbo.json'), 'utf8')
  ) as { tasks: Record<string, { dependsOn?: string[] }> };
  const tools = JSON.parse(
    readFileSync(join(root, 'libs/tools-harness-ts/turbo.json'), 'utf8')
  ) as { tasks: Record<string, { dependsOn?: string[]; cache?: boolean }> };
  expect(
    rootGraph.tasks['@libs/tools-harness-ts#configure:brand']?.dependsOn
  ).toContain('@libs/tools-harness-ts#configure:brand-policy');
  expect(tools.tasks['configure:brand-policy']?.dependsOn).toContain(
    '@libs/tools-harness-ts#configure:identity'
  );
  expect(tools.tasks['configure:brand-policy']?.cache).toBe(false);
});

// regression: auth-shard-missing-solver
test('verification installs the pinned solver before running selected tasks', () => {
  const workflow = readFileSync(
    join(root, '.github/workflows/verify-pr.yml'),
    'utf8'
  );
  expect(workflow).toContain("if: steps.browser.outputs.solver == 'true'");
  expect(workflow).toContain('run: mise install java http:apalache');
  expect(workflow.indexOf('run: mise install java http:apalache')).toBeLessThan(
    workflow.indexOf('      - name: verify\n')
  );
});
