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
  readonly withS3: boolean;
  readonly withMqtt: boolean;
  /** Native OTLP file collector by default; LGTM is the opt-in Docker UI. */
  readonly observabilityBackend: ObservabilityBackend;
  /** Serve the built web bundle. Off for API-only runs. */
  readonly withWeb: boolean;
  /**
   * Serve the web app as a fixed snapshot: no HMR and no file watching, so
   * edits in the working tree cannot reload a browser mid-run (test runs).
   */
  readonly frozenWeb: boolean;
  /** Build the web app with its test-only probes on (`VITE_E2E=1`). */
  readonly e2eHooks: boolean;
  /** Reuse a data directory (and its Postgres cluster) instead of a fresh one. */
  readonly keepData: boolean;
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
  return {
    instanceId: value(argv, 'instance') ?? defaultInstanceId(),
    apiNodes: Number.isFinite(nodes) && nodes > 0 ? Math.floor(nodes) : 2,
    withS3: !flag(argv, 'no-s3'),
    withMqtt: !flag(argv, 'no-mqtt'),
    observabilityBackend: parseObservabilityBackend(argv),
    withWeb: !flag(argv, 'no-web'),
    frozenWeb: flag(argv, 'frozen-web'),
    e2eHooks: flag(argv, 'e2e'),
    keepData: flag(argv, 'keep-data'),
    idpStateMode: idpState.mode,
    idpStatePath: idpState.path,
  };
}
