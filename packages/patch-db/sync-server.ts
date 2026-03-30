import { assert } from '@gamezilla/shared/assert';
import type { PubSub } from '@gamezilla/shared/pub-sub/interface';
import type { PatchesDb } from './interface';
import { PatchDbHttpRequestHandler } from './transport/impl-http-request-handler';
import { PatchDbImplSyncHost } from './transport/impl-sync-host';
import { PatchDbImplInstrumentedSyncHost } from './transport/instrumented-sync-host';
import type { PatchDbSyncHost } from './transport/interface';
import { patchDbPaths } from './transport/paths';

export type PatchDbSyncServerConfig = {
  db: PatchesDb;
  pubSub: PubSub;
  /** Default: `/patch-db`. */
  basePath?: string;
  instrumentation?:
    | boolean
    | {
        flushIntervalMs: number;
      };
};

export type PatchDbSyncRequestHandler = (
  req: Request
) => Promise<Response | null>;

export type PatchDbSyncHandlerBundle = {
  handleRequest: PatchDbSyncRequestHandler;
  basePath: string;
  /** Present when `instrumentation` is enabled; stops periodic metric writes. */
  dispose?: () => void;
};

/**
 * Wires PatchesDb + PubSub into a sync host (optional instrumentation) and an
 * HTTP handler that speaks the patch-db wire protocol (Request / Response).
 */
export function createPatchDbSyncHandler(
  config: PatchDbSyncServerConfig
): PatchDbSyncHandlerBundle {
  const { basePath: normalizedBase } = patchDbPaths(config.basePath);

  let host: PatchDbSyncHost = new PatchDbImplSyncHost(config.db, config.pubSub);
  let disposeInstrumentation: (() => void) | undefined;

  const inst = config.instrumentation;
  if (inst) {
    const flushIntervalMs =
      typeof inst === 'object' &&
      inst !== null &&
      typeof inst.flushIntervalMs === 'number'
        ? inst.flushIntervalMs
        : 5000;
    assert.nonNegativeInteger(
      flushIntervalMs,
      'flushIntervalMs must be a non-negative integer'
    );
    const instrumented = new PatchDbImplInstrumentedSyncHost(
      host,
      config.db,
      config.pubSub,
      flushIntervalMs
    );
    host = instrumented;
    disposeInstrumentation = () => instrumented.dispose();
  }

  const http = new PatchDbHttpRequestHandler(host, normalizedBase);

  return {
    basePath: normalizedBase,
    handleRequest: (req) => http.handleRequest(req),
    ...(disposeInstrumentation !== undefined
      ? { dispose: disposeInstrumentation }
      : {}),
  };
}
