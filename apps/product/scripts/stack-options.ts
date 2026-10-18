// @io-wall-ok — tools composition root.

/** What a stack is made of, and how to say so on a command line. */

/** How long the simulated Google provider remembers anything. */
export type IdpStateMode = 'memory' | 'instance' | 'path';
export type ObservabilityBackend = 'native' | 'lgtm' | 'off';

export type StackOptions = {
  /** Names the instance's data directory and manifest file. */
  readonly instanceId: string;
  /** How many API instances sit behind the balancer. */
  readonly apiNodes: number;
  readonly syntheticPopulationWorkers: number;
  readonly withS3: boolean;
  readonly withMqtt: boolean;
  /** Native OTLP file collector by default; LGTM is the opt-in Docker UI. */
  readonly observabilityBackend: ObservabilityBackend;
  /** Serve the web app. Off for API-only runs. */
  readonly withWeb: boolean;
  /**
   * Pin the web listener. Null asks the OS for a port. The workspace run
   * script passes its `VITE_PORT` so the run pane opens this stack.
   */
  readonly webPort: number | null;
  /**
   * Serve the web app as a fixed snapshot: no HMR and no file watching, so
   * edits in the working tree cannot reload a browser mid-run (test runs).
   */
  readonly frozenWeb: boolean;
  /** Build the web app with its test-only probes on (`VITE_TEST_HOOKS=1`). */
  readonly testHooks: boolean;
  /** Reuse a data directory (and its Postgres cluster) instead of a fresh one. */
  readonly keepData: boolean;
  /**
   * Reach Postgres the way the deployed API does: through a link with the
   * production round trip, session pool and per-request bill
   * (`database-link.ts`). Off for development, on where a run decides whether
   * a change is ready to deploy.
   */
  readonly productionDatabase: boolean;
  /**
   * `memory` (default) — the IdP's SQLite lives in the child's memory.
   * `instance` — `<instance data dir>/idp.sqlite`, wiped with the instance
   *   unless `--keep-data`, then lasting across restarts.
   * `path` — exactly the file named by `--idp-state-path`; stack cleanup
   *   never deletes it.
   */
  readonly idpStateMode: IdpStateMode;
  /** Required by `path`, refused by `memory` (and by `instance`, which owns its own). */
  readonly idpStatePath: string | null;
};

function flag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function value(argv: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  const hit = argv.find((arg) => arg.startsWith(prefix));
  if (hit !== undefined) return hit.slice(prefix.length);
  const at = argv.indexOf(`--${name}`);
  const next = at >= 0 ? argv[at + 1] : undefined;
  return next !== undefined && !next.startsWith('--') ? next : null;
}

/** Short random suffix keeps concurrent stacks from sharing a data directory. */
function defaultInstanceId(): string {
  return `stack-${crypto.randomUUID().slice(0, 8)}`;
}

function parseIdpState(argv: readonly string[]): {
  readonly mode: IdpStateMode;
  readonly path: string | null;
} {
  const raw = value(argv, 'idp-state') ?? 'memory';
  if (raw !== 'memory' && raw !== 'instance' && raw !== 'path') {
    throw new Error(
      `--idp-state must be memory, instance or path (got '${raw}')`
    );
  }
  const path = value(argv, 'idp-state-path');
  if (raw === 'path' && path === null) {
    throw new Error('--idp-state path requires --idp-state-path <file>');
  }
  if (raw !== 'path' && path !== null) {
    throw new Error(
      `--idp-state-path is only valid with --idp-state path (got --idp-state ${raw})`
    );
  }
  return { mode: raw, path };
}

function parseWebPort(argv: readonly string[]): number | null {
  const raw = value(argv, 'web-port');
  if (raw === null) return null;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`--web-port must be a TCP port (got '${raw}')`);
  }
  return port;
}

function parseObservabilityBackend(
  argv: readonly string[]
): ObservabilityBackend {
  if (flag(argv, 'no-observability')) return 'off';
  const backend = value(argv, 'observability') ?? 'native';
  if (backend !== 'native' && backend !== 'lgtm' && backend !== 'off') {
    throw new Error(
      `--observability must be native, lgtm or off (got '${backend}')`
    );
  }
  return backend;
}

export function parseStackOptions(argv: readonly string[]): StackOptions {
  const nodes = Number(value(argv, 'api-nodes') ?? '2');
  const idpState = parseIdpState(argv);
  const withWeb = !flag(argv, 'no-web');
  const webPort = parseWebPort(argv);
  const syntheticPopulationWorkers = Number(
    value(argv, 'synthetic-population-workers') ?? '1'
  );
  if (
    !Number.isInteger(syntheticPopulationWorkers) ||
    syntheticPopulationWorkers < 0 ||
    syntheticPopulationWorkers > 8
  )
    throw new Error(
      '--synthetic-population-workers must be an integer between 0 and 8'
    );
  if (webPort !== null && !withWeb) {
    throw new Error('--web-port requires the web app (omit --no-web)');
  }
  return {
    instanceId: value(argv, 'instance') ?? defaultInstanceId(),
    apiNodes: Number.isFinite(nodes) && nodes > 0 ? Math.floor(nodes) : 2,
    syntheticPopulationWorkers,
    withS3: !flag(argv, 'no-s3'),
    withMqtt: !flag(argv, 'no-mqtt'),
    observabilityBackend: parseObservabilityBackend(argv),
    withWeb,
    webPort,
    frozenWeb: flag(argv, 'frozen-web'),
    testHooks: flag(argv, 'test-hooks'),
    keepData: flag(argv, 'keep-data'),
    productionDatabase: flag(argv, 'production-database'),
    idpStateMode: idpState.mode,
    idpStatePath: idpState.path,
  };
}
