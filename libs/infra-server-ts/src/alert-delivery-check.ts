import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { createDeadlineFetch } from '@pkgs/http-client-shared-ts/deadline-fetch';
import type { HttpClient, HttpFetch } from '@pkgs/http-client-shared-ts/types';
import {
  type AlertCanary,
  array,
  canaryGroup,
  canaryPayload,
  mobileAttempt,
  record,
} from './alert-delivery-evidence';

export type AlertDeliveryConfiguration = {
  readonly stackUrl: string;
  readonly apiUrl: string;
  readonly token: string;
  readonly webhookUrl: string;
  readonly hookId: string;
  readonly integrationId: string;
  readonly routeId: string;
  readonly responderId: string;
  readonly responderUsername: string;
  readonly githubToken: string;
};

/** Live operational check. Offline gates supply an in-process HTTP dispatcher. */
export class AlertDeliveryCheck {
  private readonly fetch: HttpFetch;

  constructor(
    private readonly config: AlertDeliveryConfiguration,
    http: HttpClient,
    private readonly clock: Clock,
    private readonly timers: Timers
  ) {
    this.fetch = createDeadlineFetch({
      fetch: http.fetch,
      timers,
      timeoutMs: 10_000,
    });
  }

  /** `step` names the request in errors; URLs may carry credentials and never do. */
  private async request(
    step: string,
    url: string,
    init: RequestInit
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetch(url, { ...init, redirect: 'error' });
    } catch {
      // Neither credentials, webhook URLs nor remote response bodies enter logs.
      throw new Error(
        `Alert delivery API request failed or exceeded its deadline (${step})`
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `Alert delivery API returned HTTP ${response.status} (${step})`
      );
    }
    const body = await response.text();
    if (body.length > 1_000_000)
      throw new Error(`Alert delivery API response too large (${step})`);
    if (init.method === 'POST') return null;
    if (body.trim() === '') return null;
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new Error(`Alert delivery API returned invalid JSON (${step})`);
    }
  }

  // Grafana Cloud serves IRM's internal API from the IRM app; the
  // standalone OnCall plugin is deprecated and absent from the stack.
  private irmApp(step: string, path: string): Promise<unknown> {
    return this.request(
      step,
      `${this.config.stackUrl}/api/plugins/grafana-irm-app/resources${path}`,
      {
        headers: { Authorization: `Bearer ${this.config.token}` },
      }
    );
  }

  private publicApi(step: string, path: string): Promise<unknown> {
    return this.request(step, `${this.config.apiUrl}/api/v1${path}`, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'X-Grafana-URL': this.config.stackUrl,
      },
    });
  }

  private async hook(run: AlertCanary): Promise<void> {
    const result = record(
      await this.request(
        'GitHub project webhook',
        `https://api.github.com/repos/${run.repository}/hooks/${this.config.hookId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.githubToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      )
    );
    if (
      result['active'] !== true ||
      !array(result['events']).includes('workflow_run') ||
      record(result['config'])['url'] !== this.config.webhookUrl
    )
      throw new Error(
        'The project workflow_run webhook is absent, inactive or misrouted'
      );
  }

  private async send(
    run: AlertCanary,
    conclusion: 'failure' | 'success'
  ): Promise<void> {
    await this.request(
      `IRM integration ${conclusion} alert`,
      this.config.webhookUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(canaryPayload(run, conclusion)),
      }
    );
  }

  private async until<T>(
    read: () => Promise<T | undefined>,
    label: string
  ): Promise<T> {
    const deadline = this.clock.now() + 60_000;
    while (this.clock.now() < deadline) {
      const value = await read();
      if (value !== undefined && this.clock.now() <= deadline) return value;
      if (this.clock.now() >= deadline) break;
      await new Promise<void>((resolve) =>
        this.timers.setTimeout(resolve, 2_000)
      );
    }
    throw new Error(`Alert delivery check timed out: ${label}`);
  }

  async run(
    run: AlertCanary
  ): Promise<{ groupId: string; runUrl: string; responderId: string }> {
    const payload = canaryPayload(run, 'failure');
    await this.hook(run);
    const responder = record(
      await this.publicApi(
        'IRM responder',
        `/users/${encodeURIComponent(this.config.responderId)}/`
      )
    );
    if (responder['username'] !== this.config.responderUsername)
      throw new Error('IRM responder does not match the configured username');
    const startedAt = this.clock.now();
    let groupId = '';
    try {
      await this.send(run, 'failure');
      const group = await this.until(
        async () =>
          canaryGroup(
            await this.publicApi(
              'IRM incident search',
              `/alert_groups/?integration_id=${encodeURIComponent(this.config.integrationId)}&search=${encodeURIComponent(payload.workflow_run.name)}`
            ),
            {
              payload,
              integrationId: this.config.integrationId,
              routeId: this.config.routeId,
            }
          ),
        'incident creation'
      );
      if (
        typeof group['id'] !== 'string' ||
        !/^[A-Za-z0-9]+$/.test(group['id'])
      )
        throw new Error('IRM returned an invalid canary group ID');
      groupId = group['id'];
      await this.until(
        async () =>
          mobileAttempt(
            await this.irmApp(
              'IRM incident timeline',
              `/alertgroups/${groupId}/`
            ),
            this.config.responderId,
            startedAt
          )
            ? true
            : undefined,
        'mobile notification attempt'
      );
    } finally {
      // Also clean up if ingestion succeeded but its acknowledgement was lost.
      await this.send(run, 'success');
      if (groupId !== '')
        await this.until(async () => {
          const group = record(
            await this.publicApi(
              'IRM incident state',
              `/alert_groups/${groupId}/`
            )
          );
          return group['state'] === 'resolved' ? true : undefined;
        }, 'incident resolution');
    }
    return {
      groupId,
      runUrl: payload.workflow_run.html_url,
      responderId: this.config.responderId,
    };
  }
}
