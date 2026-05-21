import { assert } from '@gamezilla/assert';
import type { PubSub } from '@gamezilla/pub-sub/interface';
import type { PatchDbResolvable } from './interface';
import type {
  PatchDbHttpAuthOptions,
  createPatchDbHttpHono,
} from './transport/impl-http-request-handler';
import { PatchDbHttpRequestHandler } from './transport/impl-http-request-handler';
import { PatchDbImplSyncHost } from './transport/impl-sync-host';
import { PatchDbImplInstrumentedSyncHost } from './transport/instrumented-sync-host';
import type { PatchDbSyncHost } from './transport/interface';
import { patchDbPaths } from './transport/paths';

export type { PatchDbResolvable };

export type PatchDbApiConfig = {
  db: PatchDbResolvable;
  pubSub: PubSub;
  /** Default: `/patch-db`. */
  basePath?: string;
  /** When set, patch-db HTTP routes resolve a caller context (`Readonly<Record<string, unknown>>`) per request. */
  patchDbHttpAuth?: PatchDbHttpAuthOptions;
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
  honoApp: ReturnType<typeof createPatchDbHttpHono>;
  /** Present when `instrumentation` is enabled; stops periodic metric writes. */
  dispose?: () => void;
};

/**
 * Wires PatchDb + PubSub into a sync host (optional instrumentation) and an
 * HTTP handler that speaks the patch-db wire protocol (Request / Response).
 */
export function createPatchDbApiHandler(
  config: PatchDbApiConfig
): PatchDbApiHandlerBundle {
  const { basePath: normalizedBase } = patchDbPaths(config.basePath);

  if (
    config.instrumentation !== undefined &&
    config.instrumentation !== false
  ) {
    assert.ok(
      typeof config.db !== 'function',
      'PatchDbApiConfig: instrumentation requires a concrete PatchDb, not a resolver'
    );
  }

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
    assert.ok(
      typeof config.db !== 'function',
      'instrumented host requires concrete db'
    );
    const instrumented = new PatchDbImplInstrumentedSyncHost({
      inner: host,
      db: config.db,
      pubSub: config.pubSub,
      flushIntervalMs,
    });
    host = instrumented;
    disposeInstrumentation = () => instrumented.dispose();
  }

  const http = new PatchDbHttpRequestHandler(
    host,
    normalizedBase,
    config.patchDbHttpAuth
  );

  return {
    basePath: normalizedBase,
    handleRequest: (req) => http.handleRequest(req),
    honoApp: http.honoApp,
    ...(disposeInstrumentation !== undefined
      ? { dispose: disposeInstrumentation }
      : {}),
  };
}
