import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import {
  ObservabilitySecretName as Name,
  type ObservabilitySecretKey,
} from '../public/secret-names';
import {
  type GrafanaAccessPolicy,
  GrafanaCloudApi,
  type GrafanaStack,
} from './grafana-cloud-api';

export type GrafanaCloudTracesConfig = {
  readonly grafanaStackSlug: string;
  readonly grafanaRegion: string;
  readonly ingestPolicyName: string;
  readonly queryPolicyName: string;
};

export type EnsureGrafanaCloudTracesInput = {
  readonly http: HttpClient;
  readonly timers: Timers;
  readonly apiToken: string;
  readonly config: GrafanaCloudTracesConfig;
  /** Current secrets env values (Infisical `prd`). */
  readonly stored: ReadonlyMap<string, string>;
  readonly log: (line: string) => void;
};

export type EnsureGrafanaCloudTracesResult = {
  /** Desired values for every observability secret the stack owns. */
  readonly secrets: Readonly<Record<ObservabilitySecretKey, string>>;
};

const STACK_READY_POLLS = 60;
const STACK_READY_INTERVAL_MS = 5_000;
const INGEST_SCOPES = ['traces:write'] as const;
const QUERY_SCOPES = ['traces:read'] as const;

function sleep(timers: Timers, ms: number): Promise<void> {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

async function ensureStack(
  api: GrafanaCloudApi,
  input: EnsureGrafanaCloudTracesInput
): Promise<GrafanaStack> {
  const slug = input.config.grafanaStackSlug;
  let stack = await api.getStack(slug);
  if (stack === null) {
    input.log(`· creating Grafana Cloud stack ${slug}`);
    stack = await api.createStack({ slug, region: input.config.grafanaRegion });
  }
  for (let i = 0; stack.status !== 'active'; i++) {
    if (i >= STACK_READY_POLLS) {
      throw new Error(
        `Grafana Cloud stack ${slug} not active: ${stack.status}`
      );
    }
    await sleep(input.timers, STACK_READY_INTERVAL_MS);
    stack = (await api.getStack(slug)) ?? stack;
  }
  return stack;
}

async function ensurePolicy(
  api: GrafanaCloudApi,
  stack: GrafanaStack,
  name: string,
  scopes: readonly string[]
): Promise<GrafanaAccessPolicy> {
  const existing = await api.findAccessPolicy(stack.regionSlug, name);
  const same =
    existing !== null &&
    existing.scopes.length === scopes.length &&
    scopes.every((s) => existing.scopes.includes(s));
  if (same) return existing;
  return api.upsertAccessPolicy({
    region: stack.regionSlug,
    existingId: existing?.id ?? null,
    name,
    scopes,
    stackId: stack.id,
  });
}

/** Replace every token minted for `policy` with one fresh token. */
async function rotateToken(
  api: GrafanaCloudApi,
  stack: GrafanaStack,
  policy: GrafanaAccessPolicy
): Promise<string> {
  const tokenName = `${policy.name}-token`;
  for (const token of await api.listTokens(stack.regionSlug, policy.id)) {
    if (token.name === tokenName) {
      await api.deleteToken(stack.regionSlug, token.id);
    }
  }
  return api.createToken({
    region: stack.regionSlug,
    accessPolicyId: policy.id,
    name: tokenName,
  });
}

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

async function keepOrRotate(options: {
  readonly label: string;
  readonly log: (line: string) => void;
  readonly stored: string;
  readonly works: (token: string) => Promise<boolean>;
  readonly rotate: () => Promise<string>;
}): Promise<string> {
  if (options.stored.length > 0 && (await options.works(options.stored))) {
    options.log(`✓ ${options.label} token valid`);
    return options.stored;
  }
  options.log(`· minting ${options.label} token`);
  return options.rotate();
}

export function otlpTracesUrl(otlpHttpUrl: string): string {
  const base = otlpHttpUrl.replace(/\/+$/, '');
  const otlp = base.endsWith('/otlp') ? base : `${base}/otlp`;
  return `${otlp}/v1/traces`;
}

/**
 * Reconcile Grafana Cloud for traces: stack, write-only ingest policy,
 * read-only query policy, and live tokens. Stored tokens are kept while they
 * still authenticate; otherwise they are rotated.
 */
export async function ensureGrafanaCloudTraces(
  input: EnsureGrafanaCloudTracesInput
): Promise<EnsureGrafanaCloudTracesResult> {
  const api = new GrafanaCloudApi(input.http, input.apiToken);
  const cfg = input.config;
  const stack = await ensureStack(api, input);
  input.log(`✓ Grafana Cloud stack — ${stack.slug} (${String(stack.id)})`);

  const ingest = await ensurePolicy(
    api,
    stack,
    cfg.ingestPolicyName,
    INGEST_SCOPES
  );
  const query = await ensurePolicy(
    api,
    stack,
    cfg.queryPolicyName,
    QUERY_SCOPES
  );
  input.log(`✓ access policies — ${ingest.name}, ${query.name}`);

  const collectorUrl = otlpTracesUrl(await api.getOtlpHttpUrl(stack.slug));
  const collectorUser = String(stack.id);
  const tempoUrl = `${stack.htInstanceUrl.replace(/\/+$/, '')}/tempo`;
  const tempoUser = String(stack.htInstanceId);
  const stored = (name: string): string => input.stored.get(name)?.trim() ?? '';

  const collectorToken = await keepOrRotate({
    label: 'ingest',
    log: input.log,
    stored: stored(Name.collectorToken),
    works: (t) => probeIngest(input.http, collectorUrl, collectorUser, t),
    rotate: () => rotateToken(api, stack, ingest),
  });
  const tempoToken = await keepOrRotate({
    label: 'query',
    log: input.log,
    stored: stored(Name.tempoToken),
    works: (t) => probeQuery(input.http, tempoUrl, tempoUser, t),
    rotate: () => rotateToken(api, stack, query),
  });

  return {
    secrets: {
      [Name.grafanaCloudApiToken]: input.apiToken,
      [Name.collectorUrl]: collectorUrl,
      [Name.collectorUser]: collectorUser,
      [Name.collectorToken]: collectorToken,
      [Name.tempoUrl]: tempoUrl,
      [Name.tempoUser]: tempoUser,
      [Name.tempoToken]: tempoToken,
    },
  };
}
