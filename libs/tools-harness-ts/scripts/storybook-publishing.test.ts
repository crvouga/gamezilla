import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Storybook builds before fetching its shared Infisical credential', () => {
  const action = Bun.YAML.parse(
    read('.github/actions/publish-storybook/action.yml')
  ) as {
    inputs: Record<string, unknown>;
    runs: {
      steps: { run?: string; uses?: string; with?: Record<string, string> }[];
    };
  };
  expect(action.inputs['project-token']).toBeUndefined();
  const steps = action.runs.steps;
  const build = steps.findIndex(
    (step) => step.run === 'bun run storybook:build'
  );
  const auth = steps.findIndex(
    (step) => step.uses === './.github/actions/secrets-auth'
  );
  const publish = steps.findIndex((step) =>
    step.run?.includes('bun run storybook:publish')
  );
  expect(build).toBeGreaterThan(-1);
  expect(auth).toBeGreaterThan(build);
  expect(publish).toBeGreaterThan(auth);
  expect(steps[auth]?.with?.['environment']).toBe('shared');
  expect(read('.github/workflows/deploy.yml')).not.toContain(
    'secrets.CHROMATIC_PROJECT_TOKEN'
  );
  expect(read('.github/workflows/verify-pr.yml')).not.toContain(
    'secrets.CHROMATIC_PROJECT_TOKEN'
  );
});

test('main publishing waits for the safety gate and can authenticate with OIDC', () => {
  const workflow = Bun.YAML.parse(read('.github/workflows/deploy.yml')) as {
    jobs: Record<
      string,
      { if: string; needs: string; permissions: Record<string, string> }
    >;
  };
  const publishing = workflow.jobs['deploy-storybook'];
  expect(publishing?.needs).toBe('deploy-verify');
  expect(publishing?.if).toBe(
    "${{ !inputs.rehearsal && github.ref == 'refs/heads/main' }}"
  );
  expect(publishing?.permissions['id-token']).toBe('write');
});

test('the README links the main branch of the configured Chromatic project', () => {
  const config = JSON.parse(
    read('pkgs/ui-root-harness-ts/chromatic.config.json')
  ) as { projectId: string };
  const appId = config.projectId.replace(/^Project:/, '');
  expect(read('README.md')).toContain(`https://main--${appId}.chromatic.com/`);
  expect(read('pkgs/ui-root-harness-ts/CHROMATIC.md')).toContain(
    `https://main--${appId}.chromatic.com/`
  );
});
