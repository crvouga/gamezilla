import type { Observability } from '@pkgs/observability/port/observability';
import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import type { PatchDbSyncHost } from '../transport/interface';
import { PatchDbSemconv } from './semconv';

function entityTypesFromQueries(queries: PatchDbQuery[]): string {
  const types = new Set<string>();
  for (const q of queries) {
    if (q.entityType !== undefined && q.entityType.length > 0) {
      types.add(q.entityType);
    }
  }
  return [...types].sort().join(',');
}

function entityTypesFromPatches(patches: PatchInput[]): string {
  const types = new Set<string>();
  for (const p of patches) {
    types.add(p.entityType);
  }
  return [...types].sort().join(',');
}

async function observedRead(
  observability: Observability,
  inner: PatchDbSyncHost,
  queries: PatchDbQuery[],
  ctx?: PatchDbContext
): Promise<PatchDbResult[]> {
  const span = observability.startSpan({
    name: 'patch-db.read',
    kind: 'internal',
    attributes: {
      [PatchDbSemconv.queryCount]: queries.length,
      [PatchDbSemconv.entityTypes]: entityTypesFromQueries(queries),
    },
  });
  return observability.withSpanContextAsync(span.spanContext, async () => {
    try {
      const results = await inner.read(queries, ctx);
      for (let i = 0; i < results.length; i += 1) {
        const metrics = results[i]?.metrics;
        if (metrics?.elapsedMs !== undefined) {
          span.addEvent('query.metrics', {
            index: i,
            elapsedMs: metrics.elapsedMs,
          });
        }
      }
      span.setStatus({ code: 'ok' });
      return results;
    } catch (err: unknown) {
      observability.recordException(err);
      span.setStatus({
        code: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function observedWrite(
  observability: Observability,
  inner: PatchDbSyncHost,
  patches: PatchInput[],
  ctx?: PatchDbContext
): Promise<WritePatchesResult> {
  const span = observability.startSpan({
    name: 'patch-db.write',
    kind: 'internal',
    attributes: {
      [PatchDbSemconv.patchCount]: patches.length,
      [PatchDbSemconv.entityTypes]: entityTypesFromPatches(patches),
    },
  });
  return observability.withSpanContextAsync(span.spanContext, async () => {
    try {
      const out = await inner.write(patches, ctx);
      span.setAttribute(PatchDbSemconv.acceptedCount, out.accepted.length);
      span.setAttribute(PatchDbSemconv.rejectedCount, out.rejected.length);
      span.setStatus({ code: 'ok' });
      return out;
    } catch (err: unknown) {
      observability.recordException(err);
      span.setStatus({
        code: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

export function wrapPatchDbSyncHostForObservability(
  observability: Observability,
  inner: PatchDbSyncHost
): PatchDbSyncHost {
  return {
    read: (queries, ctx) => observedRead(observability, inner, queries, ctx),
    write: (patches, ctx) => observedWrite(observability, inner, patches, ctx),
  };
}
