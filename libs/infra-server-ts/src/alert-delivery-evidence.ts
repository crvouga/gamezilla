/** Evidence is about this canary only; unrelated notifications never satisfy it. */
export type AlertCanary = {
  readonly repository: string;
  readonly repositoryId: string;
  readonly runId: string;
  readonly runAttempt: string;
  readonly sha: string;
};

export function canaryPayload(
  run: AlertCanary,
  conclusion: 'failure' | 'success'
) {
  for (const value of [run.repositoryId, run.runId, run.runAttempt]) {
    if (!/^\d+$/.test(value))
      throw new Error('Canary requires GitHub run identity');
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(run.repository))
    throw new Error('Canary requires a GitHub repository');
  return {
    action: 'completed',
    repository: { id: run.repositoryId, full_name: run.repository },
    workflow_run: {
      // A different namespace prevents a synthetic recovery resolving a real failure.
      id: `alert-delivery-${run.runId}-${run.runAttempt}`,
      name: `Alert delivery check ${run.runId}/${run.runAttempt}`,
      html_url: `https://github.com/${run.repository}/actions/runs/${run.runId}`,
      head_sha: run.sha,
      head_branch: 'main',
      path: '.github/workflows/deploy.yml',
      event: 'workflow_dispatch',
      conclusion,
      run_attempt: Number(run.runAttempt),
    },
  };
}

export type CanaryPayload = ReturnType<typeof canaryPayload>;

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Alert verification received an invalid API response');
  return value as Record<string, unknown>;
}

export function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value))
    throw new Error('Alert verification received an invalid API collection');
  return value;
}

export function canaryGroup(
  value: unknown,
  expected: { payload: CanaryPayload; integrationId: string; routeId: string }
): Record<string, unknown> | undefined {
  return array(record(value)['results'])
    .map(record)
    .find((group) => {
      if (group['integration_id'] !== expected.integrationId) return false;
      const payload = record(record(group['last_alert'])['payload']);
      const run = record(payload['workflow_run']);
      if (run['id'] !== expected.payload.workflow_run.id) return false;
      if (
        group['route_id'] !== expected.routeId ||
        group['title'] !== `${expected.payload.workflow_run.name}: failure` ||
        run['html_url'] !== expected.payload.workflow_run.html_url ||
        record(payload['repository'])['id'] !== expected.payload.repository.id
      )
        throw new Error('Canary reached IRM with incorrect routing or content');
      if (group['state'] === 'resolved') return false;
      if (!['new', 'firing', 'acknowledged'].includes(String(group['state'])))
        throw new Error(
          'Canary incident is suppressed or has an unknown state'
        );
      return true;
    });
}

/** IRM's send outcome still does not establish handset display or sound. */
export function mobileAttempt(
  value: unknown,
  userId: string,
  startedAt: number
): boolean {
  const entries = array(record(value)['render_after_resolve_report_json'])
    .map(record)
    .filter((entry) => {
      if (entry['realm'] !== 'user_notification') return false;
      const author = record(entry['author']);
      if (author['pk'] !== userId) return false;
      const at = Date.parse(String(entry['created_at']));
      return Number.isFinite(at) && at >= startedAt;
    });
  if (entries.some((entry) => entry['type'] === 3))
    throw new Error('IRM reports a failed personal notification');
  const attempts = entries.filter(
    (entry) =>
      entry['type'] === 0 &&
      !String(entry['action']).startsWith('escalation triggered')
  );
  if (attempts.some((entry) => !/mobile|push/i.test(String(entry['action']))))
    throw new Error(
      'IRM notification success cannot be attributed to mobile: another channel also attempted delivery'
    );
  return attempts.some((attempt) =>
    entries.some(
      (entry) =>
        entry['type'] === 2 &&
        Date.parse(String(entry['created_at'])) >=
          Date.parse(String(attempt['created_at']))
    )
  );
}
