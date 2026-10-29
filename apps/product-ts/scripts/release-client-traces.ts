import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { EVENT } from '@pkgs/observability-root-shared-ts/events';
import {
  type NarrateSpan,
  narrate,
} from '@pkgs/observability-root-shared-ts/narrate';
import type { Trace } from '@pkgs/observability-root-shared-ts/types';

type ClientIndex = {
  readonly traces: ReadonlyMap<string, readonly NarrateSpan[]>;
  readonly uploads: ReadonlyMap<string, readonly NarrateSpan[]>;
};
const MAX_MUTATIONS = 2;
const MAX_CLIENT_TRACES = 3;
const MAX_CLIENT_SPANS = 4;
const CAPTION = '\nClient evidence capped; omitted records are not inferred.';

function mutationIds(span: NarrateSpan): Set<string> {
  const records = [
    span.attributes,
    ...(span.events ?? []).map((event) => event.attributes ?? {}),
    ...(span.links ?? []).map((link) => link.attributes ?? {}),
  ];
  return new Set(
    records.flatMap((attributes) => {
      const id = attributes[ATTR.APP_MUTATION_ID];
      return typeof id === 'string' ? [id] : [];
    })
  );
}

/** Reuse the failure reader's normalized records; never rescan the journal per mutation. */
export function indexClientTraces(spans: readonly NarrateSpan[]): ClientIndex {
  const traces = new Map<string, NarrateSpan[]>();
  const uploads = new Map<string, NarrateSpan[]>();
  const seen = new Set<string>();
  for (const span of spans) {
    if (span.attributes[ATTR.SERVICE_NAME] !== serviceName('client')) continue;
    const identity = `${span.traceId}/${span.spanId}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const trace = traces.get(span.traceId) ?? [];
    trace.push(span);
    traces.set(span.traceId, trace);
    if (span.name !== 'sync.batch.flush') continue;
    for (const id of mutationIds(span)) {
      const related = uploads.get(id) ?? [];
      related.push(span);
      uploads.set(id, related);
    }
  }
  for (const spans of [...traces.values(), ...uploads.values()])
    spans.sort(spanOrder);
  return { traces, uploads };
}

function spanOrder(a: NarrateSpan, b: NarrateSpan): number {
  return (
    a.startTimeMs - b.startTimeMs ||
    (a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0)
  );
}

function targetSpans(index: ClientIndex, replay: NarrateSpan) {
  const id = String(replay.attributes[ATTR.APP_MUTATION_ID]);
  const uploads = index.uploads.get(id) ?? [];
  const links = [
    ...(replay.links ?? []),
    ...uploads.flatMap((span) => span.links ?? []),
  ].filter((link) => link.attributes?.[ATTR.APP_MUTATION_ID] === id);
  const targets = new Map<string, Set<string>>();
  const add = (span: Pick<NarrateSpan, 'traceId' | 'spanId'>) => {
    const anchors = targets.get(span.traceId) ?? new Set<string>();
    anchors.add(span.spanId);
    targets.set(span.traceId, anchors);
  };
  for (const upload of uploads) add(upload);
  const missingOrigins = new Set<string>();
  for (const link of links) {
    if (
      index.traces
        .get(link.traceId)
        ?.some((span) => span.spanId === link.spanId)
    )
      add(link);
    else missingOrigins.add(`${link.traceId}/${link.spanId}`);
  }
  const priority = [
    ...(uploads[0] ? [uploads[0].traceId] : []),
    ...links.map((link) => link.traceId),
    ...(uploads.at(-1) ? [uploads.at(-1)!.traceId] : []),
    ...targets.keys(),
  ];
  const ids = [...new Set(priority)].filter((id) => targets.has(id));
  return { uploads, links, missingOrigins, targets, ids };
}

function clientDetails(
  spans: readonly NarrateSpan[],
  anchors: ReadonlySet<string>
) {
  const important = spans.filter((span) => anchors.has(span.spanId));
  const related = spans.filter(
    (span) =>
      !anchors.has(span.spanId) &&
      (span.name === 'interaction.timing' ||
        span.attributes[ATTR.HTTP_REQUEST_METHOD] !== undefined)
  );
  return [...important, ...related].slice(0, MAX_CLIENT_SPANS).map((span) => ({
    ...span,
    events: (span.events ?? []).filter(
      (event) =>
        event.name === EVENT.MUTATION_SENT ||
        event.name === EVENT.MUTATION_ACKED
    ),
    // Exact links selected this trace; repeat no causal-age caption in phase details.
    links: [],
    // Keep phase evidence compact; canonical narrate still redacts every value.
    attributes: Object.fromEntries(
      Object.entries(span.attributes).filter(
        ([key]) =>
          key.startsWith('app.interaction.') ||
          key === ATTR.HTTP_REQUEST_METHOD ||
          key === ATTR.HTTP_RESPONSE_STATUS_CODE ||
          key === ATTR.APP_LOG_MESSAGE
      )
    ),
  }));
}

function mutationEvidence(index: ClientIndex, replay: NarrateSpan): string {
  const found = targetSpans(index, replay);
  const output = ['client correlation for selected replay mutation:'];
  if (found.uploads.length === 0)
    output.push(
      'no collected client upload span; no queue or auth duration is inferred.'
    );
  if (found.links.length === 0)
    output.push('No recorded mutation-origin link.');
  if (found.missingOrigins.size > 0)
    output.push(
      `${found.missingOrigins.size} linked origin span was not collected.`
    );
  output.push(
    `${found.ids.length} related client traces; ${Math.max(0, found.ids.length - MAX_CLIENT_TRACES)} omitted by the client trace cap.`
  );
  for (const id of found.ids.slice(0, MAX_CLIENT_TRACES)) {
    const spans = index.traces.get(id)!;
    const details = clientDetails(spans, found.targets.get(id)!);
    const detailStart = Math.min(...details.map((span) => span.startTimeMs));
    output.push(
      `client trace ${id}; detail starts ${new Date(detailStart).toISOString()}; ${spans.length - details.length} spans omitted from client detail.`
    );
    output.push(narrate(details, { maxChars: 300, maxLines: 10 }));
  }
  return output.join('\n');
}

/** Exact mutation events/links only; absence never falls back to nearby client activity. */
export function clientTraceEvidence(
  index: ClientIndex,
  request: Trace,
  args: {
    readonly mutationNames: readonly string[];
    readonly maxChars: number;
  }
): string {
  if (args.maxChars <= 0) return '';
  const replays = new Map<string, NarrateSpan>();
  for (const span of request.spans) {
    const id = span.attributes[ATTR.APP_MUTATION_ID];
    if (
      span.name === 'mutation.replay' &&
      args.mutationNames.includes(
        String(span.attributes[ATTR.APP_MUTATION_NAME])
      ) &&
      typeof id === 'string'
    )
      replays.set(id, span);
  }
  if (replays.size === 0) return '';
  const output = [...replays.values()]
    .slice(0, MAX_MUTATIONS)
    .map((replay) => mutationEvidence(index, replay));
  if (replays.size > MAX_MUTATIONS)
    output.push(
      `${replays.size - MAX_MUTATIONS} replay mutations omitted by the client mutation cap.`
    );
  const text = output.join('\n');
  const limit = Math.min(1_000, args.maxChars);
  return text.length <= limit
    ? text
    : `${text.slice(0, Math.max(0, limit - CAPTION.length))}${CAPTION}`.slice(
        0,
        limit
      );
}
