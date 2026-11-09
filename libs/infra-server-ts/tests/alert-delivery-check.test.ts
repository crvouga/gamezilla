import { expect, test } from 'bun:test';
import { AlertDeliveryCheck } from '@libs/infra-server-ts/alert-delivery-check';
import {
  canaryPayload,
  mobileAttempt,
} from '@libs/infra-server-ts/alert-delivery-evidence';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const run = {
  repository: 'example/app',
  repositoryId: '1',
  runId: '42',
  runAttempt: '1',
  sha: 'abc',
};
const config = {
  stackUrl: 'https://example.grafana.net',
  apiUrl: 'https://oncall.example/oncall',
  token: 'private-token',
  webhookUrl: 'https://oncall.example/integrations/private',
  hookId: '123',
  integrationId: 'C123',
  routeId: 'R123',
  responderId: 'U123',
  responderUsername: 'example',
  githubToken: 'private-github',
};
const startedAt = 1_700_000_000_000;

function timeline(overrides: Record<string, unknown> = {}) {
  return {
    render_after_resolve_report_json: [
      {
        realm: 'user_notification',
        type: 0,
        author: { pk: 'U123' },
        created_at: new Date(startedAt).toISOString(),
        action: 'sent mobile app message',
        ...overrides,
      },
      {
        realm: 'user_notification',
        author: { pk: 'U123' },
        created_at: new Date(startedAt).toISOString(),
        ...overrides,
        type: 2,
        action: 'notification to example was delivered successfully',
      },
    ],
  };
}

type DeliveryFaults = {
  hookActive?: boolean;
  failedMobile?: boolean;
  missingMobile?: boolean;
  rejectIngestion?: boolean;
};

function mobileTimeline(options: DeliveryFaults) {
  if (options.missingMobile)
    return Response.json({ render_after_resolve_report_json: [] });
  return Response.json(timeline(options.failedMobile ? { type: 3 } : {}));
}

function dispatcher(options: DeliveryFaults = {}) {
  const payloads: ReturnType<typeof canaryPayload>[] = [];
  const http = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/users/U123/'))
        return Response.json({ username: 'example' });
      if (url.startsWith('https://api.github.com/'))
        return Response.json({
          active: options.hookActive ?? true,
          events: ['workflow_run'],
          config: { url: config.webhookUrl },
        });
      if (url === config.webhookUrl) {
        expect(new Headers(init?.headers).has('Authorization')).toBe(false);
        const payload = JSON.parse(String(init?.body)) as ReturnType<
          typeof canaryPayload
        >;
        payloads.push(payload);
        if (
          options.rejectIngestion &&
          payload.workflow_run.conclusion === 'failure'
        )
          return new Response('private details', { status: 503 });
        return new Response('Ok');
      }
      if (url.includes('/api/v1/alert_groups/?')) {
        expect(new Headers(init?.headers).get('X-Grafana-URL')).toBe(
          config.stackUrl
        );
        return Response.json({
          results: [
            {
              id: 'I123',
              integration_id: 'C123',
              route_id: 'R123',
              state: 'firing',
              title: 'Alert delivery check 42/1: failure',
              last_alert: { payload: payloads[0] },
            },
          ],
        });
      }
      if (
        url ===
        `${config.stackUrl}/api/plugins/grafana-irm-app/resources/alertgroups/I123/`
      )
        return mobileTimeline(options);
      if (url.endsWith('/api/v1/alert_groups/I123/'))
        return Response.json({ state: 'resolved' });
      throw new Error('Unexpected request in notification verification');
    },
  };
  return { http, payloads };
}

test('project delivery exercises its integration and reports an attempt separately from handset receipt', async () => {
  const { clock, timers } = createHarnessClock({ startMs: startedAt });
  const { http, payloads } = dispatcher();
  const result = await new AlertDeliveryCheck(config, http, clock, timers).run(
    run
  );
  expect(result).toEqual({
    groupId: 'I123',
    runUrl: 'https://github.com/example/app/actions/runs/42',
    responderId: 'U123',
  });
  expect(payloads.map((p) => p.workflow_run.conclusion)).toEqual([
    'failure',
    'success',
  ]);
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('an absent project hook prevents a misleading direct-integration pass', async () => {
  const { clock, timers } = createHarnessClock({ startMs: startedAt });
  const { http, payloads } = dispatcher({ hookActive: false });
  await expect(
    new AlertDeliveryCheck(config, http, clock, timers).run(run)
  ).rejects.toThrow('absent, inactive or misrouted');
  expect(payloads).toHaveLength(0);
});

test('mobile failures fail verification but still resolve only the canary', async () => {
  const { clock, timers } = createHarnessClock({ startMs: startedAt });
  const { http, payloads } = dispatcher({ failedMobile: true });
  await expect(
    new AlertDeliveryCheck(config, http, clock, timers).run(run)
  ).rejects.toThrow('failed personal notification');
  expect(payloads.map((p) => p.workflow_run.conclusion)).toEqual([
    'failure',
    'success',
  ]);
});

test('missing mobile evidence reaches a finite deadline and cleans up its incident', async () => {
  const { clock, timers } = createHarnessClock({ startMs: startedAt });
  const { http, payloads } = dispatcher({ missingMobile: true });
  let settled = false;
  const result = new AlertDeliveryCheck(config, http, clock, timers)
    .run(run)
    .then(
      () => 'unexpected pass',
      (error: unknown) => String(error)
    )
    .finally(() => {
      settled = true;
    });
  for (let tick = 0; tick < 70 && !settled; tick += 1) {
    for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    if (!settled) clock.advance(1_000);
  }
  expect(settled).toBe(true);
  expect(await result).toContain('timed out: mobile notification attempt');
  expect(payloads.map((p) => p.workflow_run.conclusion)).toEqual([
    'failure',
    'success',
  ]);
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('ingestion failure cannot leak the webhook or remote response body and still sends recovery', async () => {
  const { clock, timers } = createHarnessClock({ startMs: startedAt });
  const { http, payloads } = dispatcher({ rejectIngestion: true });
  await expect(
    new AlertDeliveryCheck(config, http, clock, timers).run(run)
  ).rejects.toThrow(
    'Alert delivery API returned HTTP 503 (IRM integration failure alert)'
  );
  expect(payloads.map((p) => p.workflow_run.conclusion)).toEqual([
    'failure',
    'success',
  ]);
});

test('unrelated people, earlier attempts and non-mobile notices are not mobile evidence', () => {
  expect(
    mobileAttempt(timeline({ author: { pk: 'OTHER' } }), 'U123', startedAt)
  ).toBe(false);
  expect(
    mobileAttempt(
      timeline({ created_at: new Date(startedAt - 1).toISOString() }),
      'U123',
      startedAt
    )
  ).toBe(false);
  expect(() =>
    mobileAttempt(timeline({ action: 'sent email' }), 'U123', startedAt)
  ).toThrow('another channel');
});

// regression: alert-canary-queued-push-judged-delivered
test('a queued mobile push is not accepted before its successful send outcome', () => {
  const queued = timeline().render_after_resolve_report_json.filter(
    (entry) => entry.type === 0
  );
  expect(
    mobileAttempt(
      { render_after_resolve_report_json: queued },
      'U123',
      startedAt
    )
  ).toBe(false);
});

test('another channel cannot supply the success of a mobile attempt', () => {
  const entries = [
    ...timeline().render_after_resolve_report_json,
    ...timeline({ action: 'sent email' }).render_after_resolve_report_json,
  ];
  expect(() =>
    mobileAttempt(
      { render_after_resolve_report_json: entries },
      'U123',
      startedAt
    )
  ).toThrow('another channel');
});

// regression: alert-canary-attempt-masks-failure
test('a triggered attempt cannot mask its subsequent failure', () => {
  const records = [
    ...timeline().render_after_resolve_report_json,
    ...timeline({ type: 3, action: 'failed to send push notification' })
      .render_after_resolve_report_json,
  ];
  expect(() =>
    mobileAttempt(
      { render_after_resolve_report_json: records },
      'U123',
      startedAt
    )
  ).toThrow('failed personal notification');
});

test('canary groups cannot collide with a real GitHub run or another run attempt', () => {
  assertProperty(
    'alert canary groups are isolated from real runs and other attempts',
    fc.property(
      fc.integer({ min: 1, max: 1_000_000 }),
      fc.integer({ min: 1, max: 100 }),
      (id, attempt) => {
        const current = {
          ...run,
          runId: String(id),
          runAttempt: String(attempt),
        };
        const failure = canaryPayload(current, 'failure');
        const recovery = canaryPayload(current, 'success');
        expect(failure.workflow_run.id).toBe(recovery.workflow_run.id);
        expect(failure.workflow_run.id).not.toBe(current.runId);
        expect(failure.workflow_run.id).not.toBe(
          canaryPayload(
            { ...current, runAttempt: String(attempt + 1) },
            'failure'
          ).workflow_run.id
        );
      }
    )
  );
});

// regression: alert-canary-deprecated-oncall-plugin
test('a missing IRM route names the failing step and still sends recovery', async () => {
  const { clock, timers } = createHarnessClock({ startMs: startedAt });
  const { http, payloads } = dispatcher();
  const missingTimeline = {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/resources/alertgroups/')
        ? Promise.resolve(new Response('Plugin not found', { status: 404 }))
        : http.fetch(input, init),
  };
  await expect(
    new AlertDeliveryCheck(config, missingTimeline, clock, timers).run(run)
  ).rejects.toThrow(
    'Alert delivery API returned HTTP 404 (IRM incident timeline)'
  );
  expect(payloads.map((p) => p.workflow_run.conclusion)).toEqual([
    'failure',
    'success',
  ]);
});
