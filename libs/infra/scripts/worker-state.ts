// @io-wall-ok — Cloudflare inventory at the deploy CLI composition root.
import type { EnvFile } from '@libs/infra/public/env-file';
import { WorkerState } from '@libs/infra/public/worker-state';

export function workerState(env: EnvFile): WorkerState {
  const token = process.env['CLOUDFLARE_API_TOKEN']?.trim() ?? '';
  if (token.length === 0) throw new Error('CLOUDFLARE_API_TOKEN is required');
  return new WorkerState(
    { fetch: (input, init) => globalThis.fetch(input, init) },
    env.cloudflare.account_id,
    token
  );
}
