// @io-wall-ok — failed release runner reads its own trace journal before teardown.
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { NarrateSpan } from '@pkgs/observability-root-shared-ts/narrate';
import { spansFromDocument } from '@pkgs/observability-root-shared-ts/normalize';

function summarizeTrace(spans: readonly NarrateSpan[], mutation: NarrateSpan) {
  const trace = spans.filter((span) => span.traceId === mutation.traceId);
  const queries = trace.filter((span) => span.name === 'db.query');
  const root = trace.find((span) => span.name === 'worker.fetch');
  return {
    traceId: mutation.traceId,
    startedAt: new Date(mutation.startTimeMs).toISOString(),
    requestMs: Math.round(root?.durationMs ?? 0),
    mutationMs: Math.round(mutation.durationMs),
    queryCount: queries.length,
    queryMs: Math.round(
      queries.reduce((sum, span) => sum + span.durationMs, 0)
    ),
    deliveries: trace
      .filter((span) => span.name === 'outbox.deliver')
      .map((span) => ({
        consumer: span.attributes['app.outbox.consumer'],
        durationMs: Math.round(span.durationMs),
      })),
    slowest: [...queries]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 8)
      .map((span) => ({
        offsetMs: Math.round(span.startTimeMs - mutation.startTimeMs),
        durationMs: Math.round(span.durationMs),
        sql: String(span.attributes['db.query.text'] ?? '')
          .replace(/\s+/g, ' ')
          .slice(0, 300),
      })),
  };
}

/** Keep the slow statements, not a report or bound SQL values, in the failure log. */
export async function printReleaseQueryEvidence(traceDir: string | null) {
  if (traceDir === null) return;
  const store = createNodeFsObjectStore({
    rootDir: traceDir,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const spans: NarrateSpan[] = [];
  for (const key of await store.listKeys()) {
    if (!/^spans(?:\.\d+)?\.ndjson$/.test(key)) continue;
    for (const line of ((await readUtf8(store, key)) ?? '').split('\n')) {
      if (line.trim() === '') continue;
      try {
        spans.push(...spansFromDocument(JSON.parse(line)));
      } catch {
        // A live collector may still be appending the journal's last line.
      }
    }
  }
  for (const mutation of spans.filter(
    (span) =>
      span.name === 'mutation.replay' &&
      span.attributes['app.mutation.name'] === 'findChessOpponent'
  ))
    console.error(
      `release pairing trace: ${JSON.stringify(summarizeTrace(spans, mutation))}`
    );
}
