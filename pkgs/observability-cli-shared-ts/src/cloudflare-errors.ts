import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { allowlistedAttributes } from '@pkgs/observability-root-shared-ts/redaction';
import type { TimeRange } from '@pkgs/observability-root-shared-ts/types';

type NativeEvent = {
  readonly timestamp: number;
  readonly $metadata: {
    readonly id: string;
    readonly service?: string;
    readonly requestId?: string;
    readonly error?: string;
    readonly message?: string;
  };
  readonly $workers?: {
    readonly outcome?: string;
    readonly scriptName?: string;
    readonly scriptVersion?: { readonly id?: string };
    readonly eventType?: string;
  };
};

/** Read retained runtime failures independently of application exporters. Never returns request bodies. */
export async function readCloudflareErrors(args: {
  readonly http: HttpClient;
  readonly accountId: string;
  readonly token: string;
  readonly service: string;
  readonly range: TimeRange;
  readonly signal: AbortSignal;
}): Promise<{ readonly count: number; readonly records: readonly unknown[] }> {
  const response = await args.http.fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(args.accountId)}/workers/observability/telemetry/query`,
    {
      method: 'POST',
      signal: args.signal,
      headers: {
        Authorization: `Bearer ${args.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        queryId: 'runtime-failure-investigation',
        view: 'events',
        timeframe: { from: args.range.startMs, to: args.range.endMs },
        limit: 100,
        parameters: {
          datasets: ['cloudflare-workers'],
          filterCombination: 'and',
          filters: [
            {
              key: '$metadata.service',
              operation: 'eq',
              type: 'string',
              value: args.service,
            },
            {
              kind: 'group',
              filterCombination: 'or',
              filters: [
                { key: '$metadata.error', operation: 'exists', type: 'string' },
                {
                  key: '$workers.outcome',
                  operation: 'not_in',
                  type: 'string',
                  value: 'ok,canceled',
                },
              ],
            },
          ],
        },
      }),
    }
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Cloudflare runtime errors unavailable: HTTP ${response.status}`
    );
  }
  const result = (await response.json()) as {
    success: boolean;
    result?: { events?: { count?: number; events?: NativeEvent[] } };
  };
  if (!result.success || result.result?.events === undefined)
    throw new Error('Cloudflare runtime query returned no event result');
  const events = result.result.events.events ?? [];
  return {
    count: result.result.events.count ?? events.length,
    records: events.map(nativeDiagnostic),
  };
}

function nativeDiagnostic(event: NativeEvent): unknown {
  const metadata = event.$metadata;
  const workers = event.$workers;
  return {
    eventId: metadata.id,
    timestampMs: event.timestamp,
    service: metadata.service ?? workers?.scriptName,
    requestId: metadata.requestId,
    build: workers?.scriptVersion?.id,
    eventType: workers?.eventType,
    outcome: workers?.outcome,
    diagnostic: allowlistedAttributes({
      [ATTR.EXCEPTION_MESSAGE]:
        metadata.error ??
        metadata.message ??
        workers?.outcome ??
        'Runtime failure',
    }),
  };
}
