/**
 * Live checks of the trail itself: that it is current, that every record says
 * which environment it came from, and that the requests which need an
 * account name that account. They read what the deployed app has already
 * written to Tempo, so they prove the pipeline end to end rather than that a
 * token is accepted. Used by `specs/runtime/request-records.feature`
 * (`apps/product-ts/tests/steps/traces.steps.ts`).
 */
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { PROBE_ENVIRONMENT } from '@pkgs/observability-root-shared-ts/deployment-environment';

export type TrailAccess = {
  readonly tempoUrl: string;
  readonly tempoUser: string;
  readonly tempoToken: string;
};

export type TrailWindow = {
  readonly nowMs: number;
  readonly lookbackMs: number;
};

const SEARCH_LIMIT = 50;

/** Routes that only answer someone the app knows. */
const SIGNED_IN_ROUTES = '/api/(query|mutations)';

function authorization(access: TrailAccess): string {
  return `Basic ${btoa(`${access.tempoUser}:${access.tempoToken}`)}`;
}

function bounds(window: TrailWindow): string {
  const end = Math.ceil(window.nowMs / 1000);
  const start = Math.floor((window.nowMs - window.lookbackMs) / 1000);
  return `start=${String(start)}&end=${String(end)}`;
}

async function getJson(
  http: HttpClient,
  access: TrailAccess,
  path: string
): Promise<unknown> {
  const response = await http.fetch(
    `${access.tempoUrl.replace(/\/$/, '')}${path}`,
    { headers: { Authorization: authorization(access) } }
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Tempo answered ${String(response.status)} for ${path.split('?')[0]}`
    );
  }
  return response.json();
}

type SearchBody = {
  readonly traces?: readonly { readonly startTimeUnixNano?: string }[];
};

async function search(
  http: HttpClient,
  access: TrailAccess,
  find: { readonly query: string; readonly window: TrailWindow }
): Promise<NonNullable<SearchBody['traces']>> {
  const body = (await getJson(
    http,
    access,
    `/api/search?q=${encodeURIComponent(find.query)}&${bounds(find.window)}&limit=${String(SEARCH_LIMIT)}`
  )) as SearchBody;
  return body.traces ?? [];
}

/**
 * How long ago the newest scheduled outbox drain of this environment started,
 * or null when there is none in the window. The drain runs every minute with
 * no one using the app, so silence means the trail stopped, not that it was
 * quiet.
 */
export async function newestTrailAgeMs(
  http: HttpClient,
  access: TrailAccess,
  input: { readonly environment: string } & TrailWindow
): Promise<number | null> {
  const traces = await search(http, access, {
    query: `{ name = "outbox.drain" && resource.deployment.environment.name = ${JSON.stringify(input.environment)} }`,
    window: input,
  });
  const starts = traces
    .map((trace) => Number(trace.startTimeUnixNano ?? 0) / 1_000_000)
    .filter((ms) => ms > 0);
  return starts.length === 0 ? null : input.nowMs - Math.max(...starts);
}

/** The environment names the trail currently holds records for. */
export async function trailEnvironments(
  http: HttpClient,
  access: TrailAccess,
  window: TrailWindow
): Promise<readonly string[]> {
  const body = (await getJson(
    http,
    access,
    `/api/v2/search/tag/${encodeURIComponent('resource.deployment.environment.name')}/values?${bounds(window)}`
  )) as { readonly tagValues?: readonly { readonly value?: unknown }[] };
  return (body.tagValues ?? [])
    .map((entry) => entry.value)
    .filter((value): value is string => typeof value === 'string');
}

/**
 * Environment names that no deployment owns. A record under one would be
 * missed by every per-environment query, dashboard and objective.
 */
export function unknownEnvironments(
  found: readonly string[],
  deployed: readonly string[]
): readonly string[] {
  const known = new Set([...deployed, PROBE_ENVIRONMENT]);
  return found.filter((name) => !known.has(name)).sort();
}

export type SignedInRequests = {
  /** Answered with success on a route that needs an account. */
  readonly answered: number;
  /** Of those, how many do not say whose request it was. */
  readonly nameless: number;
};

/**
 * Whether the requests that need an account say whose they were. Without it
 * the team cannot go from a person to what happened to them.
 */
export async function signedInRequests(
  http: HttpClient,
  access: TrailAccess,
  input: { readonly environment: string } & TrailWindow
): Promise<SignedInRequests> {
  const base = `name = "http.server.request" && resource.deployment.environment.name = ${JSON.stringify(input.environment)} && span.http.route =~ ${JSON.stringify(SIGNED_IN_ROUTES)} && span.http.response.status_code = 200`;
  const [answered, named] = await Promise.all([
    search(http, access, { query: `{ ${base} }`, window: input }),
    search(http, access, {
      query: `{ ${base} && span.user.id != nil }`,
      window: input,
    }),
  ]);
  return {
    answered: answered.length,
    nameless: Math.max(0, answered.length - named.length),
  };
}

export type BackgroundWork = {
  /** Scheduled drains of the outbox that finished in the window. */
  readonly runs: number;
  /** Of those, how many ended in an error. */
  readonly failed: number;
};

/**
 * How the scheduled outbox drain, which delivers everything the app does after
 * answering, has been ending. It runs every minute, so a window of a few
 * minutes holds a few runs; a drain failing most of the time was invisible
 * while no one used the one thing it was blocking.
 */
export async function backgroundWork(
  http: HttpClient,
  access: TrailAccess,
  input: { readonly environment: string } & TrailWindow
): Promise<BackgroundWork> {
  const base = `name = "outbox.drain" && resource.deployment.environment.name = ${JSON.stringify(input.environment)}`;
  const [runs, failed] = await Promise.all([
    search(http, access, { query: `{ ${base} }`, window: input }),
    search(http, access, {
      query: `{ ${base} && status = error }`,
      window: input,
    }),
  ]);
  return { runs: runs.length, failed: failed.length };
}
