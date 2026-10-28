// @io-wall-ok — locates the pinned Apalache and JVM (spawns `mise`), makes a private QUINT_HOME, probes a free port.
/**
 * The Apalache that `quint verify` model-checks with, and the environment it
 * runs in — never the one Quint would download.
 *
 * Each check starts the pinned Apalache's server itself (`run-quint`, with
 * {@link apalacheServerArgs}) and points Quint at it with `--server-endpoint`,
 * so Quint connects rather than launching (or downloading) an Apalache of its
 * own. Should Quint fail to connect, it would look in
 * `$QUINT_HOME/apalache-dist-<version>/` and download there: every check gets
 * an empty private QUINT_HOME, and its HTTP proxy is a dead local port, so
 * that download fails loudly instead of fetching.
 *
 * Apalache: `$APALACHE_HOME` when set, else `mise where http:apalache`.
 * Java: `mise where java` goes first on `PATH` when mise knows it (on CI the
 * setup action already put the pinned JVM there).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { delimiter, join } from 'node:path';

/**
 * The Apalache release the pinned Quint expects (its
 * `DEFAULT_APALACHE_VERSION_TAG`), and the one `mise.toml` pins. Passed to
 * Quint explicitly, so the directory it looks in never depends on its default.
 */
export const APALACHE_VERSION = '0.56.1';

const INSTALL_HINT = `run \`mise install\` at the repo root (mise.toml pins Apalache ${APALACHE_VERSION} as http:apalache and the JVM it needs), or set APALACHE_HOME to an Apalache ${APALACHE_VERSION} distribution`;

type Env = Readonly<Record<string, string | undefined>>;

function miseWhere(tool: string, cwd: string): string | null {
  const result = spawnSync('mise', ['where', tool], { cwd, encoding: 'utf8' });
  if (result.error !== undefined || result.status !== 0) return null;
  const path = result.stdout.trim();
  return path.length > 0 ? path : null;
}

function jar(home: string): string {
  return join(home, 'lib', 'apalache.jar');
}

/**
 * The pinned Apalache distribution (the directory holding `bin/apalache-mc`
 * and `lib/apalache.jar`), or an error saying how to install it.
 */
export function resolveApalache(
  env: Env
): { readonly home: string } | { readonly error: string } {
  const fromEnv = env['APALACHE_HOME'];
  const home =
    fromEnv !== undefined && fromEnv.length > 0
      ? fromEnv
      : miseWhere('http:apalache', import.meta.dir);
  if (home === null) {
    return {
      error: `quint verify: Apalache is not installed — ${INSTALL_HINT}`,
    };
  }
  if (!existsSync(jar(home))) {
    return {
      error: `quint verify: no Apalache at ${jar(home)} — ${INSTALL_HINT}`,
    };
  }
  return { home };
}

/** `PATH` with the pinned JVM first, when mise knows it. */
function pathWithJava(path: string, platform: NodeJS.Platform): string {
  const java = miseWhere('java', import.meta.dir);
  const binary = platform === 'win32' ? 'java.exe' : 'java';
  if (java === null || !existsSync(join(java, 'bin', binary))) return path;
  return `${join(java, 'bin')}${delimiter}${path}`;
}

/**
 * The `java` arguments that run Apalache's server on `port`: the same JVM
 * command Apalache's own `bin/apalache-mc` launcher builds (it honors
 * `JVM_ARGS` and `JVM_GC_ARGS`, defaults the heap to 4 GiB and the collector
 * to periodic G1, and gives SANY a fresh `java.io.tmpdir`), with the
 * `server --port=<port>` arguments Quint would pass it.
 */
export function apalacheServerArgs(input: {
  readonly home: string;
  readonly port: number;
  readonly env: Env;
  readonly tmpdir: string;
}): string[] {
  const words = (value: string | undefined) =>
    (value ?? '').split(/\s+/).filter((word) => word !== '');
  const jvm = words(input.env['JVM_ARGS']);
  const heap = jvm.some((arg) => /-Xmx|-XX:MaxRAMPercentage/.test(arg))
    ? []
    : ['-Xmx4096m'];
  const gc = words(input.env['JVM_GC_ARGS']);
  return [
    ...jvm,
    ...heap,
    ...(gc.length > 0
      ? gc
      : [
          '-XX:+UseG1GC',
          '-XX:G1PeriodicGCInterval=600000',
          '-XX:+G1PeriodicGCInvokesConcurrent',
        ]),
    `-Djava.io.tmpdir=${input.tmpdir}`,
    '-jar',
    jar(input.home),
    'server',
    `--port=${String(input.port)}`,
  ];
}

/**
 * An empty QUINT_HOME under `dir`, so a Quint that failed to reach its server
 * never reads or writes the user's `~/.quint`. Returns its path.
 */
export function privateQuintHome(dir: string): string {
  const home = join(dir, 'quint-home');
  mkdirSync(home, { recursive: true });
  return home;
}

/** A dead local port: a request through it fails instead of leaving the machine. */
const NO_NETWORK = 'http://127.0.0.1:9';
const LOCAL = '127.0.0.1,localhost';

/** The environment `quint verify` runs in. */
export function verifyEnv(input: {
  readonly env: Env;
  readonly quintHome: string;
  readonly platform?: NodeJS.Platform;
}): Record<string, string> {
  const platform = input.platform ?? process.platform;
  const env: Record<string, string> = {};
  let path = '';
  for (const [name, value] of Object.entries(input.env)) {
    if (value === undefined) continue;
    // Windows names are case-insensitive (`Path` there): one key, not two.
    const isPath =
      platform === 'win32' ? name.toUpperCase() === 'PATH' : name === 'PATH';
    if (isPath) path = value;
    else env[name] = value;
  }
  return {
    ...env,
    PATH: pathWithJava(path, platform),
    QUINT_HOME: input.quintHome,
    HTTP_PROXY: NO_NETWORK,
    HTTPS_PROXY: NO_NETWORK,
    http_proxy: NO_NETWORK,
    https_proxy: NO_NETWORK,
    ALL_PROXY: NO_NETWORK,
    all_proxy: NO_NETWORK,
    NO_PROXY: LOCAL,
    no_proxy: LOCAL,
    // Quint talks to its Apalache server over local gRPC, which must not
    // take the dead proxy.
    no_grpc_proxy: LOCAL,
  };
}

/** A port nothing listens on right now, for this check's own Apalache server. */
export async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => {
        if (port === 0) reject(new Error('quint verify: no free port'));
        else resolve(port);
      });
    });
  });
}
