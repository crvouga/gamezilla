/**
 * Live checks that a Grafana Cloud token still works — used by
 * `specs/runtime/request-records.feature` (`apps/product/tests/steps/traces.steps.ts`). The stack, policies and tokens themselves
 * are OpenTofu resources (`libs/infra-shared/tofu/modules/observability`).
 */
import type { HttpClient } from '@pkgs/http-client-shared/types';

function basicAuth(user: string, token: string): string {
  return `Basic ${btoa(`${user}:${token}`)}`;
}

async function probe(
  http: HttpClient,
  url: string,
  init: RequestInit
): Promise<boolean> {
  try {
    const res = await http.fetch(url, init);
    return res.ok;
  } catch {
    return false;
  }
}

/** `true` when `token` may write OTLP traces to `url` (empty batch). */
export function probeIngest(
  http: HttpClient,
  url: string,
  user: string,
  token: string
): Promise<boolean> {
  return probe(http, url, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(user, token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resourceSpans: [] }),
  });
}

/** `true` when `token` may query Tempo at `url`. */
export function probeQuery(
  http: HttpClient,
  url: string,
  user: string,
  token: string
): Promise<boolean> {
  return probe(http, `${url}/api/v2/search/tags?scope=span`, {
    headers: { Authorization: basicAuth(user, token) },
  });
}
