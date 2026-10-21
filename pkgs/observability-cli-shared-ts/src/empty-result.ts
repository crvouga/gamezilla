import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import type {
  TimeRange,
  TraceRef,
  TraceStore,
} from '@pkgs/observability-root-shared-ts/types';
import type { ObsArgs } from './args';
import { FORMAT_HEADER, noResults, traceLine } from './format';

type EmptyResultOptions = {
  readonly args: ObsArgs;
  readonly range: TimeRange;
  readonly store: TraceStore;
  readonly searched?: 'identifier' | 'activity';
  readonly subject: string;
  readonly window: string;
};

export async function emptyResult(
  options: EmptyResultOptions
): Promise<{ readonly code: 1; readonly text: string }> {
  const adjacent = await options.store.adjacent(options.range);
  if (options.args.flags['json'] === true) {
    return {
      code: 1,
      text: JSON.stringify(
        {
          format: FORMAT_HEADER,
          data: { range: options.range, traces: [], adjacent },
        },
        null,
        2
      ),
    };
  }
  const nearby = await Promise.all(
    (['before', 'nearby', 'after'] as const).flatMap((direction) => {
      const reference = adjacent[direction];
      if (reference === undefined) return [];
      return [nearbyLine(options.store, direction, reference)];
    })
  );
  return {
    code: 1,
    text: [
      noResults(options.subject, {
        source: options.store.source,
        window: options.window,
        range: options.range,
        ...(options.searched === undefined
          ? {}
          : { searched: options.searched }),
      }),
      ...(nearby.length === 0 ? ['nearby-activity: none'] : nearby),
    ].join('\n'),
  };
}

async function nearbyLine(
  store: TraceStore,
  direction: 'after' | 'before' | 'nearby',
  reference: TraceRef
): Promise<string> {
  const trace = await store.getTrace(reference.traceId);
  const sessions = [
    ...new Set(
      trace?.spans.flatMap((item) => {
        const value = item.attributes[ATTR.SESSION_ID];
        return typeof value === 'string' ? [value] : [];
      }) ?? []
    ),
  ];
  return `nearest-${direction}: ${traceLine(reference)}${sessions.length === 0 ? '' : ` | sessions ${sessions.join(',')}`}\nnext: bun obs trace ${reference.traceId}`;
}
