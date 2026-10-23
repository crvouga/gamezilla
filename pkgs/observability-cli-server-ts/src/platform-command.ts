import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { ObsArgs } from '@pkgs/observability-cli-shared-ts/args';
import { stringFlag } from '@pkgs/observability-cli-shared-ts/args';
import { readCloudflareErrors } from '@pkgs/observability-cli-shared-ts/cloudflare-errors';
import { resolveRange } from '@pkgs/observability-cli-shared-ts/time';

export async function platformCommand(
  args: ObsArgs,
  ports: {
    readonly http: HttpClient;
    readonly nowMs: number;
    readonly accountId: string | undefined;
    readonly token: string | undefined;
    readonly signal: AbortSignal;
  }
): Promise<{ readonly code: number; readonly text: string }> {
  const service = stringFlag(args, 'service');
  const range = resolveRange(
    ports.nowMs,
    stringFlag(args, 'window') ?? '1h',
    stringFlag(args, 'at')
  );
  const { accountId, token } = ports;
  if (service === undefined || range === undefined)
    return {
      code: 2,
      text: 'usage: bun obs platform --service <worker-name> [--window 1h] [--at UTC-time]',
    };
  if (!accountId || !token)
    return {
      code: 3,
      text: 'obs: platform query requires CLOUDFLARE_ACCOUNT_ID and a token with Workers Observability read access',
    };
  try {
    const result = await readCloudflareErrors({
      http: ports.http,
      accountId,
      token,
      service,
      range,
      signal: ports.signal,
    });
    return {
      code: result.records.length === 0 ? 1 : 0,
      text: JSON.stringify(
        { source: 'cloudflare-runtime', range, ...result },
        null,
        2
      ),
    };
  } catch (error) {
    return {
      code: 3,
      text: error instanceof Error ? error.message : 'Platform query failed',
    };
  }
}
