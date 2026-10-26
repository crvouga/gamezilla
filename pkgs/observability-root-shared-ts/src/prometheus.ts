/**
 * A read-only client for the Prometheus HTTP API (Grafana Mimir answers it
 * under `<origin>/api/prom`). It speaks instant queries: an instant vector,
 * or the raw samples of a range selector (`probe_success[7d]`).
 *
 * Every failure is a thrown {@link PrometheusQueryError} that says what to
 * fix; no answer is ever read as "zero". The transport is injected: the
 * caller passes a fetch that already owns the request deadline (a deadline
 * fetch over injected timers), and this client bounds the response size.
 */

export type PrometheusFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export type PrometheusOptions = {
  /** The Prometheus API origin, ending `/api/prom`. */
  readonly baseUrl: string;
  /** Basic-auth user (the stack's metrics instance id). */
  readonly user: string;
  /** A token allowed to read metrics. */
  readonly token: string;
  readonly fetch: PrometheusFetch;
  /** Largest answer read, in bytes. Default 1 MiB. */
  readonly maxResponseBytes?: number;
};

export type InstantSample = {
  readonly labels: Readonly<Record<string, string>>;
  /** `NaN` when the expression divided zero by zero. */
  readonly value: number;
};

/** One series of a range selector: every raw sample it holds in the range. */
export type SampledSeries = {
  readonly labels: Readonly<Record<string, string>>;
  readonly points: readonly { readonly atMs: number; readonly value: number }[];
};

export type PrometheusClient = {
  /** The expression evaluated at `atMs`; an empty list means no series matched. */
  instant(query: string, atMs: number): Promise<readonly InstantSample[]>;
  /**
   * A range selector (`x{…}[7d]`) evaluated at `atMs`: the samples each
   * series holds in that range. An empty list means no series matched.
   */
  series(query: string, atMs: number): Promise<readonly SampledSeries[]>;
};

const API_SUFFIX = '/api/prom';
const DEFAULT_MAX_BYTES = 1_048_576;
const EXCERPT = 240;

export class PrometheusQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrometheusQueryError';
  }
}

export function createPrometheusClient(
  options: PrometheusOptions
): PrometheusClient {
  const base = options.baseUrl.trim().replace(/\/+$/, '');
  if (!base.startsWith('https://') && !base.startsWith('http://')) {
    throw new PrometheusQueryError(
      `The Prometheus URL must be an http(s) origin ending ${API_SUFFIX}, got "${options.baseUrl}"`
    );
  }
  if (!base.endsWith(API_SUFFIX)) {
    throw new PrometheusQueryError(
      `The Prometheus URL must end with ${API_SUFFIX} (Mimir's Prometheus API), got "${options.baseUrl}"`
    );
  }
  if (options.user.trim() === '' || options.token.trim() === '') {
    throw new PrometheusQueryError(
      'The Prometheus user and read token must both be set'
    );
  }
  const authorization = `Basic ${btoa(`${options.user}:${options.token}`)}`;
  const limit = options.maxResponseBytes ?? DEFAULT_MAX_BYTES;
  const ask = async (query: string, atMs: number): Promise<string> => {
    const response = await post({
      ...options,
      url: `${base}/api/v1/query`,
      authorization,
      body: new URLSearchParams({
        query,
        time: (atMs / 1000).toFixed(3),
      }).toString(),
    });
    const text = await readBounded(response, limit);
    if (!response.ok) throw rejected(response.status, text);
    return text;
  };
  return {
    async instant(query, atMs) {
      return samples(await ask(query, atMs));
    },
    async series(query, atMs) {
      return matrix(await ask(query, atMs));
    },
  };
}

type PostInput = PrometheusOptions & {
  readonly url: string;
  readonly authorization: string;
  readonly body: string;
};

async function post(input: PostInput): Promise<Response> {
  try {
    return await input.fetch(input.url, {
      method: 'POST',
      headers: {
        authorization: input.authorization,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: input.body,
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new PrometheusQueryError(
      `Prometheus did not answer (${reason}); check OBS_PROMETHEUS_URL and that the stack is reachable`
    );
  }
}

function rejected(status: number, text: string): PrometheusQueryError {
  const hint = hintFor(status);
  return new PrometheusQueryError(
    `Prometheus answered ${String(status)}${hint}: ${text.slice(0, EXCERPT)}`
  );
}

function hintFor(status: number): string {
  if (status === 401 || status === 403) {
    return ' (OBS_PROMETHEUS_USER or the read token OBS_TEMPO_TOKEN is wrong, or the token lacks metrics:read)';
  }
  if (status === 404) {
    return ' (OBS_PROMETHEUS_URL must be the Mimir Prometheus API origin ending /api/prom)';
  }
  if (status === 422 || status === 400) {
    return ' (the query was refused; it may select too many series or too long a range)';
  }
  return '';
}

async function readBounded(response: Response, limit: number): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) {
        throw new PrometheusQueryError(
          `Prometheus answered more than ${String(limit)} bytes; narrow the query`
        );
      }
      chunks.push(next.value);
    }
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

type Answer = {
  readonly status?: unknown;
  readonly error?: unknown;
  readonly errorType?: unknown;
  readonly data?: {
    readonly resultType?: unknown;
    readonly result?: unknown;
  };
};

/** The answer's result list, once it is known to be a `resultType` answer. */
function resultOf(text: string, resultType: 'vector' | 'matrix'): unknown[] {
  let answer: Answer;
  try {
    answer = JSON.parse(text) as Answer;
  } catch {
    throw new PrometheusQueryError(
      `Prometheus answered something that is not JSON: ${text.slice(0, EXCERPT)}`
    );
  }
  if (answer.status !== 'success') {
    throw new PrometheusQueryError(
      `Prometheus reported ${String(answer.errorType ?? 'an error')}: ${String(answer.error ?? 'no detail')}`
    );
  }
  if (answer.data?.resultType !== resultType) {
    throw new PrometheusQueryError(
      `Prometheus answered a ${String(answer.data?.resultType)}, not ${resultType === 'vector' ? 'an instant vector' : 'a range of samples'}`
    );
  }
  const result = answer.data.result;
  if (!Array.isArray(result)) {
    throw new PrometheusQueryError(
      `Prometheus answered a ${resultType} without a list`
    );
  }
  return result;
}

function samples(text: string): readonly InstantSample[] {
  return resultOf(text, 'vector').map(readSample);
}

function matrix(text: string): readonly SampledSeries[] {
  return resultOf(text, 'matrix').map((item) => {
    const entry = item as {
      readonly metric?: Record<string, string>;
      readonly values?: unknown;
    };
    if (!Array.isArray(entry.values)) {
      throw new PrometheusQueryError(
        'Prometheus answered a series without its samples'
      );
    }
    return {
      labels: entry.metric ?? {},
      points: entry.values.map((pair: unknown) => {
        const [at, raw] = Array.isArray(pair) ? pair : [];
        if (typeof at !== 'number' || typeof raw !== 'string') {
          throw new PrometheusQueryError(
            'Prometheus answered a sample without a time and a value'
          );
        }
        return { atMs: Math.round(at * 1000), value: sampleNumber(raw) };
      }),
    };
  });
}

function readSample(item: unknown): InstantSample {
  const entry = item as {
    readonly metric?: Record<string, string>;
    readonly value?: readonly unknown[];
  };
  const raw = entry.value?.[1];
  if (typeof raw !== 'string') {
    throw new PrometheusQueryError(
      'Prometheus answered a sample without a value'
    );
  }
  return { labels: entry.metric ?? {}, value: sampleNumber(raw) };
}

/** Prometheus spells infinities `+Inf` / `-Inf` and a missing ratio `NaN`. */
function sampleNumber(raw: string): number {
  if (raw === '+Inf') return Number.POSITIVE_INFINITY;
  if (raw === '-Inf') return Number.NEGATIVE_INFINITY;
  return Number(raw);
}
