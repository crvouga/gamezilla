// @io-wall-ok — locates the pinned Apalache and JVM (spawns `mise`), links them into a private QUINT_HOME, probes a free port.
/**
 * The Apalache that `quint verify` model-checks with, and the environment it
 * runs in — never the one Quint would download.
 *
 * Quint looks for Apalache at
 * `$QUINT_HOME/apalache-dist-<version>/apalache/bin/apalache-mc` and, when it
 * is missing, downloads it from GitHub. A gate must not reach the network, so
 * every check gets a private QUINT_HOME whose `apalache-dist-<version>/apalache`
 * is a link to the Apalache pinned in `mise.toml` (`http:apalache`), and the
 * link is required to resolve before Quint starts. As a second wall, the
 * check's HTTP proxy is a dead local port, so a download that slipped through
 * would fail rather than fetch.
 *
 * Apalache: `$APALACHE_HOME` when set, else `mise where http:apalache`.
 * Java: `mise where java` goes first on `PATH` when mise knows it (on CI the
 * setup action already put the pinned JVM there).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
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

function executable(home: string): string {
  return join(home, 'bin', 'apalache-mc');
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
    return { error: `quint verify: Apalache is not installed — ${INSTALL_HINT}` };
  }
  if (!existsSync(executable(home))) {
    return {
      error: `quint verify: no Apalache at ${executable(home)} — ${INSTALL_HINT}`,
    };
  }
  return { home };
}

/** `PATH` with the pinned JVM first, when mise knows it. */
function pathWithJava(env: Env): string {
  const path = env['PATH'] ?? '';
  const java = miseWhere('java', import.meta.dir);
  if (java === null || !existsSync(join(java, 'bin', 'java'))) return path;
  return `${join(java, 'bin')}${delimiter}${path}`;
}

/**
 * A QUINT_HOME under `dir` in which Quint finds `apalacheHome` where it
 * would otherwise download to. Returns its path.
 */
export function linkQuintHome(dir: string, apalacheHome: string): string {
  const home = join(dir, 'quint-home');
  const dist = join(home, `apalache-dist-${APALACHE_VERSION}`);
  mkdirSync(dist, { recursive: true });
  const link = join(dist, 'apalache');
  if (!existsSync(link)) symlinkSync(apalacheHome, link, 'dir');
  if (!existsSync(executable(link))) {
    throw new Error(
      `quint verify: ${executable(link)} does not resolve — refusing to let Quint download Apalache`
    );
  }
  return home;
}

/** A dead local port: a request through it fails instead of leaving the machine. */
const NO_NETWORK = 'http://127.0.0.1:9';
const LOCAL = '127.0.0.1,localhost';

/** The environment `quint verify` runs in. */
export function verifyEnv(input: {
  readonly env: Env;
  readonly quintHome: string;
}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.env)) {
    if (value !== undefined) env[name] = value;
  }
  return {
    ...env,
    PATH: pathWithJava(input.env),
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
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => {
        if (port === 0) reject(new Error('quint verify: no free port'));
        else resolve(port);
      });
    });
  });
}
