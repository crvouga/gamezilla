import type { InfisicalCtx } from './ci-reconcile-types';

export async function infisicalRequest(
  ctx: InfisicalCtx,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; json: unknown }> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  const res = await fetch(`${ctx.domain}${path}`, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}
