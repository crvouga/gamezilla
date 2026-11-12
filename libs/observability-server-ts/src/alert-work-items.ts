/**
 * Health's open alerts as work items: one per failing objective per
 * environment (`<env>:<slo>`), self-contained, so whoever picks one up — a
 * person or a coding agent without the secret store — has what is broken in
 * plain words, the numbers, the objective file, the runbook, the evidence
 * the investigate command found (grouped and counted), how to look further,
 * and the command that proves it fixed.
 *
 * Pure: the Health workflow's evidence step
 * (`scripts/health-alerts.ts`) gathers the failures and runs the queries;
 * `bun alerts` (`scripts/alerts.ts`) reads the result back from the run.
 */

import type {
  BurnReading,
  ObjectiveFailure,
} from '@pkgs/openslo-shared-ts/failure';
import { failureId } from '@pkgs/openslo-shared-ts/failure';

/** A trace a `bun obs --json` search lists (its wire shape). */
export type TraceRef = {
  readonly traceId: string;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly errorCount: number;
  readonly rootName: string;
};

/** A span of a `bun obs trace --json` answer, as far as messages need it. */
type ObsSpan = {
  readonly name: string;
  readonly status: string;
  readonly statusMessage?: string;
  readonly events?: readonly {
    readonly name: string;
    readonly attributes?: Readonly<Record<string, unknown>>;
  }[];
};

export type EvidenceRoute = {
  readonly route: string;
  readonly traces: number;
  readonly errorTraces: number;
  readonly slowestMs: number;
};

export type EvidenceMessage = {
  readonly message: string;
  readonly count: number;
};

export type EvidenceTrace = {
  readonly traceId: string;
  readonly route: string;
  readonly durationMs: number;
  readonly errorCount: number;
  readonly startedAt: string;
};

export type AlertEvidence = {
  /** The read-only query run for it, exactly as run. */
  readonly command: string | null;
  /** `collected`: traces found; `empty`: none in the window; otherwise why there is none. */
  readonly status: 'collected' | 'empty' | 'unavailable' | 'skipped';
  readonly note: string | null;
  readonly routes: readonly EvidenceRoute[];
  readonly messages: readonly EvidenceMessage[];
  readonly traces: readonly EvidenceTrace[];
  readonly truncated: readonly string[];
};

export type WorkItemCheck = {
  /** The evidence obligation (`objective:<slo>:<name>`, `alert:<slo>:<policy>`). */
  readonly id: string;
  readonly kind: 'objective' | 'alert';
  readonly name: string;
  readonly severity: string | null;
  readonly detail: string;
};

export type WorkItem = {
  /** `<env>:<slo>`, stable across runs while the objective keeps failing. */
  readonly id: string;
  readonly environment: string;
  readonly slo: string;
  readonly title: string;
  /** The objective file that defines it. */
  readonly specUri: string;
  readonly whatIsBroken: string;
  readonly owner: string | null;
  readonly runbook: string | null;
  /** The investigate command as a person with the secret store runs it. */
  readonly investigate: string | null;
  readonly checks: readonly WorkItemCheck[];
  readonly numbers: {
    readonly window: string;
    readonly target: number | null;
    readonly observed: number | null;
    readonly considered: number | null;
    readonly budgetRemaining: number | null;
    readonly burnRates: readonly (BurnReading & { readonly policy: string })[];
  };
  readonly evidence: AlertEvidence;
  /** Commands that show more, in order. */
  readonly inspect: readonly string[];
  /** What proves it fixed. */
  readonly provesFixed: readonly string[];
};

export type WorkItemsDocument = {
  readonly version: 1;
  readonly generatedAt: string;
  /** The environments whose objectives were checked. */
  readonly environments: readonly string[];
  readonly items: readonly WorkItem[];
};

/** Commands the evidence step may run: read-only `bun obs` searches. */
const READ_ONLY_COMMANDS = new Set(['errors', 'slow', 'last']);
const EXAMPLE_TRACES = 5;
const MESSAGE_CHARS = 300;
const SEVERITY_RANK: Readonly<Record<string, number>> = { page: 0, ticket: 1 };

/** Failures grouped into work-item ids, in first-seen order. */
export function groupFailures(
  failures: readonly ObjectiveFailure[]
): ReadonlyMap<string, readonly ObjectiveFailure[]> {
  const groups = new Map<string, ObjectiveFailure[]>();
  for (const failure of failures) {
    const id = workItemId(failure);
    groups.set(id, [...(groups.get(id) ?? []), failure]);
  }
  return groups;
}

export function workItemId(failure: ObjectiveFailure): string {
  return `${failure.environment ?? 'unknown'}:${failure.slo}`;
}

function sinceMs(command: string): number {
  const match = /--since\s+(\d+)([smhdw])/.exec(command);
  if (match === null) return 0;
  const unit = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800 }[
    match[2] as 's' | 'm' | 'h' | 'd' | 'w'
  ];
  return Number(match[1]) * unit * 1000;
}

/** The investigate command with the longest look back among the failures' responses. */
export function investigateCommand(
  failures: readonly ObjectiveFailure[]
): string | null {
  const commands = failures.flatMap((f) =>
    f.response === null ? [] : [f.response.command]
  );
  return (
    [...commands].sort(
      (a, b) => sinceMs(b) - sinceMs(a) || (a < b ? -1 : 1)
    )[0] ?? null
  );
}

/**
 * The `bun obs` arguments the evidence step runs for a command, with
 * `--json`; `null` for anything but a read-only search.
 */
export function evidenceArgs(command: string | null): readonly string[] | null {
  if (command === null) return null;
  const words = command.trim().split(/\s+/);
  if (words[0] !== 'bun' || words[1] !== 'obs') return null;
  const args = words.slice(2);
  if (!READ_ONLY_COMMANDS.has(args[0] ?? '')) return null;
  return args.includes('--json') ? args : [...args, '--json'];
}

/** Arguments that open one example trace in the same environment. */
export function traceArgs(
  searchArgs: readonly string[],
  traceId: string
): readonly string[] {
  const kept: string[] = [];
  for (let i = 0; i < searchArgs.length; i++) {
    const arg = searchArgs[i] ?? '';
    if (arg === '--source' || arg === '--env') {
      kept.push(arg, searchArgs[i + 1] ?? '');
      i++;
    }
  }
  return ['trace', traceId, ...kept, '--json'];
}

/** Secrets, credentials and personal data a message might carry, masked. */
export function redact(text: string): string {
  return text
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1***@')
    .replace(/\b(bearer|basic|token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 ***')
    .replace(
      /((?:^|[?&;\s,{"'])(?:access_token|api_?key|apikey|auth|key|password|passwd|pwd|secret|sig|signature|token)["']?\s*[=:]\s*["']?)[^&\s;,"'}]+/gi,
      '$1***'
    )
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '***')
    .replace(/\b(?:sk|rk|pk|whsec)_(?:live|test)_[A-Za-z0-9]+/g, '***')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}/g, '***')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(/[A-Za-z0-9_+=-]{32,}/g, (run) =>
      /[0-9]/.test(run) && /[A-Za-z]/.test(run) && !/^[0-9a-f]{32}$/.test(run)
        ? '***'
        : run
    );
}

function clip(text: string): string {
  const one = redact(text).replace(/\s+/g, ' ').trim();
  return one.length > MESSAGE_CHARS ? `${one.slice(0, MESSAGE_CHARS)}…` : one;
}

type ObsJson<T> = { readonly data?: T };
type SearchData = {
  readonly traces?: readonly TraceRef[];
  readonly truncations?: readonly string[];
};
type TraceData = { readonly spans?: readonly ObsSpan[] };

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** The search's traces, or `null` when its output is not obs JSON. */
export function searchTraces(stdout: string): {
  readonly traces: readonly TraceRef[];
  readonly truncated: readonly string[];
} | null {
  const parsed = parseJson<ObsJson<SearchData>>(stdout);
  if (parsed?.data === undefined || !Array.isArray(parsed.data.traces))
    return null;
  return {
    traces: parsed.data.traces,
    truncated: (parsed.data.truncations ?? []).map(clip),
  };
}

/** The traces worth opening: errors first, then the slowest. */
export function exampleTraces(
  traces: readonly TraceRef[]
): readonly TraceRef[] {
  return [...traces]
    .sort(
      (a, b) =>
        b.errorCount - a.errorCount ||
        b.durationMs - a.durationMs ||
        (a.traceId < b.traceId ? -1 : 1)
    )
    .slice(0, EXAMPLE_TRACES);
}

function spanMessage(span: ObsSpan): string {
  const exception = span.events?.find((e) => e.name === 'exception');
  const fromEvent = exception?.attributes?.['exception.message'];
  if (typeof fromEvent === 'string' && fromEvent !== '') return fromEvent;
  if (span.statusMessage !== undefined && span.statusMessage !== '')
    return span.statusMessage;
  return `${span.name} failed`;
}

/** Error messages of the opened traces' failing spans. */
export function traceMessages(traceOutputs: readonly string[]): string[] {
  return traceOutputs.flatMap((stdout) => {
    const spans = parseJson<ObsJson<TraceData>>(stdout)?.data?.spans ?? [];
    return spans.filter((s) => s.status === 'error').map(spanMessage);
  });
}

/** Group a search's traces by route and messages by text, most first. */
export function summarizeEvidence(input: {
  readonly command: string;
  readonly traces: readonly TraceRef[];
  readonly truncated: readonly string[];
  readonly messages: readonly string[];
}): AlertEvidence {
  const routes = new Map<string, EvidenceRoute>();
  for (const ref of input.traces) {
    const route = clip(ref.rootName || '(unnamed)');
    const prior = routes.get(route);
    routes.set(route, {
      route,
      traces: (prior?.traces ?? 0) + 1,
      errorTraces: (prior?.errorTraces ?? 0) + (ref.errorCount > 0 ? 1 : 0),
      slowestMs: Math.max(prior?.slowestMs ?? 0, ref.durationMs),
    });
  }
  const messages = new Map<string, number>();
  for (const message of input.messages.map(clip))
    messages.set(message, (messages.get(message) ?? 0) + 1);
  return {
    command: input.command,
    status: input.traces.length === 0 ? 'empty' : 'collected',
    note: null,
    routes: [...routes.values()].sort(
      (a, b) =>
        b.errorTraces - a.errorTraces ||
        b.traces - a.traces ||
        (a.route < b.route ? -1 : 1)
    ),
    messages: [...messages]
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count || (a.message < b.message ? -1 : 1)),
    traces: exampleTraces(input.traces).map((ref) => ({
      traceId: ref.traceId,
      route: clip(ref.rootName || '(unnamed)'),
      durationMs: ref.durationMs,
      errorCount: ref.errorCount,
      startedAt: new Date(ref.startedAtMs).toISOString(),
    })),
    truncated: input.truncated,
  };
}

/** Evidence that could not be gathered, and why (redacted). */
export function missingEvidence(
  command: string | null,
  status: 'unavailable' | 'skipped',
  note: string
): AlertEvidence {
  return {
    command,
    status,
    note: clip(note),
    routes: [],
    messages: [],
    traces: [],
    truncated: [],
  };
}

function percent(share: number | null): string {
  if (share === null) return 'unknown';
  return `${String(Number((share * 100).toPrecision(6)))}%`;
}

function rank(failures: readonly ObjectiveFailure[]): number {
  return Math.min(
    ...failures.map((f) =>
      f.check.kind === 'alert' ? (SEVERITY_RANK[f.check.severity] ?? 2) : 3
    )
  );
}

function plainWords(
  environment: string,
  title: string,
  failures: readonly ObjectiveFailure[]
): string {
  const sentences: string[] = [];
  const objective = failures.find((f) => f.check.kind === 'objective');
  if (objective !== undefined) {
    sentences.push(
      `In ${environment}, "${title}" is below its promise: over the last ${objective.window}, ${percent(objective.observed)} of ${String(objective.considered ?? 0)} counted events were good, and the promise is ${percent(objective.target)}.`
    );
  }
  for (const failure of failures) {
    if (failure.check.kind !== 'alert') continue;
    const reading = failure.readings
      .filter((r) => r.burn !== null)
      .sort((a, b) => (b.burn ?? 0) - (a.burn ?? 0))[0];
    const pace =
      reading === undefined
        ? 'is firing'
        : `is firing: bad events are spending the error budget ${String(Number((reading.burn ?? 0).toPrecision(3)))}x faster than allowed over ${reading.lookbackWindow} (it fires at ${String(reading.threshold)}x)`;
    sentences.push(
      `${objective === undefined && sentences.length === 0 ? `In ${environment}, "${title}" ` : ''}${failure.check.severity.toUpperCase()} alert ${failure.check.policy} ${pace}.`
    );
  }
  const budget = failures.find((f) => f.budgetRemaining !== null);
  if (budget !== undefined) {
    sentences.push(
      `${percent(budget.budgetRemaining)} of the ${budget.window} error budget is left.`
    );
  }
  return sentences.join(' ');
}

function inspectCommands(
  item: Pick<WorkItem, 'environment' | 'specUri' | 'investigate' | 'runbook'>,
  evidence: AlertEvidence
): readonly string[] {
  const env = item.environment;
  return [
    ...(item.runbook === null ? [] : [`Read the runbook: ${item.runbook}`]),
    `Read the objective: ${item.specUri}`,
    ...(item.investigate === null
      ? []
      : [
          `${item.investigate}   # needs the secret store (bun run secrets:login)`,
        ]),
    ...evidence.traces
      .slice(0, 3)
      .map((t) => `bun obs trace ${t.traceId} --source prod --env ${env}`),
  ];
}

function provesFixed(
  item: Pick<WorkItem, 'id' | 'environment' | 'specUri'>,
  failures: readonly ObjectiveFailure[]
): readonly string[] {
  const windows = [
    ...new Set(
      failures.flatMap((f) => f.readings.map((r) => r.lookbackWindow))
    ),
  ];
  return [
    `SECRETS_ENV=${item.environment} bun run --filter @apps/product-ts health:objectives ${item.specUri}   # every check of the objective passes`,
    `gh workflow run health.yml --ref main, then bun alerts --env ${item.environment}   # ${item.id} is no longer listed`,
    windows.length === 0
      ? `The objective recovers as bad events age out of its ${failures[0]?.window ?? ''} window.`
      : `Burn alerts clear once their windows (${windows.join(', ')}) hold no more bad events; the objective itself recovers as bad events age out of its ${failures[0]?.window ?? ''} window.`,
  ];
}

/** One work item for one failing objective in one environment. */
export function buildWorkItem(
  failures: readonly ObjectiveFailure[],
  evidence: AlertEvidence
): WorkItem {
  const first = failures[0];
  if (first === undefined) throw new Error('a work item needs a failure');
  const environment = first.environment ?? 'unknown';
  const title = first.sloDisplayName ?? first.slo;
  const response = failures.find((f) => f.response !== null)?.response ?? null;
  const objective = failures.find((f) => f.check.kind === 'objective');
  const base = {
    id: workItemId(first),
    environment,
    specUri: first.specUri,
    investigate: investigateCommand(failures),
    runbook: response?.runbook ?? null,
  };
  return {
    ...base,
    slo: first.slo,
    title,
    whatIsBroken: plainWords(environment, title, failures),
    owner: response?.owner ?? null,
    checks: failures.map((f) => ({
      id: failureId(f),
      kind: f.check.kind,
      name: f.check.kind === 'objective' ? f.check.objective : f.check.policy,
      severity: f.check.kind === 'alert' ? f.check.severity : null,
      detail: redact(f.detail),
    })),
    numbers: {
      window: first.window,
      target: first.target,
      observed: objective?.observed ?? null,
      considered: objective?.considered ?? null,
      budgetRemaining:
        failures.find((f) => f.budgetRemaining !== null)?.budgetRemaining ??
        null,
      burnRates: failures.flatMap((f) => {
        const { check } = f;
        return check.kind === 'alert'
          ? f.readings.map((r) => ({ ...r, policy: check.policy }))
          : [];
      }),
    },
    evidence,
    inspect: inspectCommands(base, evidence),
    provesFixed: provesFixed(base, failures),
  };
}

/** Work items most urgent first: pages, tickets, then missed objectives. */
export function orderWorkItems(
  groups: ReadonlyMap<string, readonly ObjectiveFailure[]>
): readonly (readonly ObjectiveFailure[])[] {
  return [...groups.entries()]
    .sort(
      ([a, fa], [b, fb]) => rank(fa) - rank(fb) || (a < b ? -1 : a > b ? 1 : 0)
    )
    .map(([, failures]) => failures);
}
