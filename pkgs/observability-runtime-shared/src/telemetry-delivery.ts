import type { Timers } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';

/**
 * The collector refused the batch itself (too large, or a shape it will never
 * accept). Sending the same bytes again cannot succeed, so the sender drops
 * the batch instead of holding every later batch behind it.
 */
export class TelemetryBatchRefused extends Error {
  override readonly name = 'TelemetryBatchRefused';
}

/** 413 Payload Too Large and 422 Unprocessable Content refuse the batch, not the moment. */
const REFUSED_BATCH_STATUSES = new Set([413, 422]);

/** A bounded upload requires a complete acknowledgement before deleting local evidence. */
export async function deliverTelemetry(args: {
  readonly http: HttpClient;
  readonly timers: Timers;
  readonly url: string;
  readonly body: string;
}): Promise<void> {
  const abort = new AbortController();
  let timer: unknown;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = args.timers.setTimeout(() => {
      abort.abort();
      reject(new Error('Telemetry delivery timed out'));
    }, 5000);
  });
  try {
    await Promise.race([requestAcknowledgement(args, abort.signal), deadline]);
  } finally {
    args.timers.clearTimeout(timer);
  }
}

async function requestAcknowledgement(
  args: {
    readonly http: HttpClient;
    readonly url: string;
    readonly body: string;
  },
  signal: AbortSignal
): Promise<void> {
  const response = await args.http.fetch(args.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: args.body,
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (REFUSED_BATCH_STATUSES.has(response.status))
      throw new TelemetryBatchRefused(
        `Telemetry batch refused (${response.status})`
      );
    throw new Error('Telemetry delivery rejected');
  }
  const text = await response.text();
  if (text.length === 0) return;
  const ack = JSON.parse(text) as { partialSuccess?: Record<string, unknown> };
  for (const [name, value] of Object.entries(ack.partialSuccess ?? {})) {
    if (name.startsWith('rejected') && Number(value) !== 0)
      throw new Error('Telemetry records rejected');
  }
}
