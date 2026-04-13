import { assert } from '@gamezilla/shared/assert';
import type { PubSub } from '@gamezilla/shared/pub-sub/interface';
import type { Hono } from 'hono';
import type { PatchesDb } from './interface';
import { PatchDbHttpRequestHandler } from './transport/impl-http-request-handler';
import { PatchDbImplSyncHost } from './transport/impl-sync-host';
import { PatchDbImplInstrumentedSyncHost } from './transport/instrumented-sync-host';
import type { PatchDbSyncHost } from './transport/interface';
import { patchDbPaths } from './transport/paths';

export type PatchDbApiConfig = {
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

export type PatchDbApiRequestHandler = (
  req: Request
) => Promise<Response | null>;

export type PatchDbApiHandlerBundle = {
  handleRequest: PatchDbApiRequestHandler;
  /** Base URL prefix (e.g. `/patch-db`). Mount {@link honoApp} with `parent.route(basePath, honoApp)`. */
  basePath: string;
  /** Hono sub-app with POST `/patches/read` and `/patches/write` relative to {@link basePath}. */
  honoApp: Hono;
  /** Present when `instrumentation` is enabled; stops periodic metric writes. */
  dispose?: () => void;
};

/**
 * Wires PatchesDb + PubSub into a sync host (optional instrumentation) and an
 * HTTP handler that speaks the patch-db wire protocol (Request / Response).
 */
export function createPatchDbApiHandler(
  config: PatchDbApiConfig
): PatchDbApiHandlerBundle {
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
    honoApp: http.honoApp,
    ...(disposeInstrumentation !== undefined
      ? { dispose: disposeInstrumentation }
      : {}),
  };
}
