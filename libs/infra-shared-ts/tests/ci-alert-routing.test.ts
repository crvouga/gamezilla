// @io-wall-ok — reads the declarative resources; templates run in process.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Template } from '@huggingface/jinja';
import { evaluate } from '@libs/infra-shared-ts/hcl-eval';
import { parseConfig } from '@libs/infra-shared-ts/hcl-parse';
import { sourceFiles } from '@libs/infra-shared-ts/infra-source';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const config = parseConfig(
  readFileSync(
    join(import.meta.dir, '../tofu/modules/alert-routing/ci.tf'),
    'utf8'
  )
);
const env = {
  names: { local: {} as Record<string, string> },
  files: sourceFiles(new Map()),
};
for (const [name, expression] of config.blocks.find((b) => b.type === 'locals')!
  .body.attributes)
  env.names.local[name] = evaluate(expression, env) as string;
const integration = config.blocks.find(
  (b) => b.labels[0] === 'grafana_oncall_integration'
)!;
const templates = integration.body.blocks.find(
  (b) => b.type === 'templates'
)!.body;
const route = config.blocks.find(
  (b) => b.labels[0] === 'grafana_oncall_route'
)!.body;

function render(name: string, payload: object, routing = false): string {
  const expression = (routing ? route : templates).attributes.get(name)!;
  return new Template(evaluate(expression, env) as string)
    .render({ payload })
    .trim();
}

function event(overrides: Record<string, unknown> = {}, action = 'completed') {
  return {
    action,
    repository: { id: 1, full_name: 'example/app' },
    workflow_run: {
      id: 10,
      run_attempt: 1,
      path: '.github/workflows/deploy.yml',
      name: 'Release',
      head_branch: 'main',
      event: 'push',
      conclusion: 'failure',
      html_url: 'https://github.com/example/app/actions/runs/10',
      ...overrides,
    },
  };
}

const truth = (value: string) => value.toLowerCase() === 'true';

test('all four main workflows notify on failed completion, including setup failures and timeouts', () => {
  for (const file of ['deploy', 'verify-nightly', 'health', 'verify-pr']) {
    for (const conclusion of [
      'failure',
      'timed_out',
      'action_required',
      'startup_failure',
    ]) {
      const payload = event({
        path: `.github/workflows/${file}.yml`,
        conclusion,
      });
      expect(truth(render('routing_regex', payload, true))).toBe(true);
      expect(truth(render('resolve_signal', payload))).toBe(false);
      expect(render('source_link', payload)).toBe(
        payload.workflow_run.html_url
      );
    }
  }
});

test('branch rehearsals, PRs, progress, cancellation and webhook pings never notify or clear a failure', () => {
  const failedKey = render('grouping_key', event());
  for (const payload of [
    {},
    { zen: 'initial webhook ping' },
    event({ head_branch: 'fix' }),
    event({ event: 'pull_request' }),
    event({ event: 'pull_request_target' }),
    event({ path: '.github/workflows/unrelated.yml' }),
    event({ conclusion: null }, 'in_progress'),
    event({}, 'requested'),
    ...['cancelled', 'skipped', 'neutral'].map((conclusion) =>
      event({ conclusion })
    ),
  ]) {
    expect(truth(render('routing_regex', payload, true))).toBe(false);
    expect(truth(render('resolve_signal', payload))).toBe(true);
    expect(render('grouping_key', payload)).not.toBe(failedKey);
  }
});

test('successful reruns resolve through the same route, while distinct runs keep distinct alerts', () => {
  const failedKey = render('grouping_key', event());
  const success = event({ conclusion: 'success', run_attempt: 2 });
  expect(render('grouping_key', success)).toBe(failedKey);
  expect(truth(render('routing_regex', success, true))).toBe(true);
  expect(truth(render('resolve_signal', success))).toBe(true);
  expect(render('grouping_key', event({ id: 11 }))).not.toBe(failedKey);
});

test('GitHub delivers directly over TLS and CI reuses the mobile push chain', () => {
  const hook = readFileSync(
    join(import.meta.dir, '../tofu/stacks/bootstrap/ci-alerts.tf'),
    'utf8'
  );
  expect(hook).toContain('events     = ["workflow_run"]');
  expect(hook).toContain(
    'url          = module.alert_routing[0].ci_webhook_url'
  );
  expect(hook).toContain('insecure_ssl = false');
  expect(hook).toContain('local.routing_ready ? 1 : 0');
  expect(
    evaluate(route.attributes.get('escalation_chain_id')!, {
      ...env,
      names: {
        ...env.names,
        grafana_oncall_escalation_chain: { push: { id: 'mobile-push' } },
      },
    })
  ).toBe('mobile-push');
});

test('arbitrary branch failures cannot notify or collide with a main alert', () => {
  assertProperty(
    'CI alerts are confined to main',
    fc.property(
      fc.string().filter((branch) => branch !== 'main'),
      fc.integer({ min: 1, max: 1_000_000 }),
      (head_branch, id) => {
        const branch = event({ head_branch, id });
        expect(truth(render('routing_regex', branch, true))).toBe(false);
        expect(render('grouping_key', branch)).not.toBe(
          render('grouping_key', event({ id }))
        );
      }
    )
  );
});
