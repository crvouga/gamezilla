// @io-wall-ok — owns the checker, the Apalache server it talks to, and both process trees.

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { connect } from 'node:net';
import { join, resolve } from 'node:path';
import {
  verificationTimeLimitsEnabled,
  wallDeadline,
} from '@pkgs/quint-shared-ts/wall';
import { apalacheServerArgs, freePort } from './apalache';

export type QuintRun = {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly output: string;
  readonly stdout: string;
};

type RunCommand = (file: string, args: readonly string[]) => void;

const runQuietly: RunCommand = (file, args) => {
  execFileSync(file, args, { stdio: 'ignore', windowsHide: true });
};

/**
 * Kill a process group, if any of it is left. Windows has no process groups:
 * `taskkill /T` walks the tree from the root by parent pid instead, so it only
 * reaches what is still parented under a live root.
 */
export function killGroup(
  pid: number | undefined,
  platform: NodeJS.Platform = process.platform,
  run: RunCommand = runQuietly
): void {
  if (pid === undefined) return;
  try {
    if (platform === 'win32')
      run('taskkill', ['/PID', String(pid), '/T', '/F']);
    else process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

/**
 * Kill the groups if this process exits, or is interrupted, first: a detached
 * group gets no Ctrl-C of its own. The signal is re-raised once the groups are
 * gone, so the process still ends as it would have. Returns the release.
 */
function guardGroups(pids: () => readonly (number | undefined)[]): () => void {
  const killAll = () => {
    for (const pid of pids()) killGroup(pid);
  };
  const onSignal = (signal: NodeJS.Signals) => {
    killAll();
    release();
    process.kill(process.pid, signal);
  };
  const release = () => {
    process.removeListener('exit', killAll);
    for (const signal of SIGNALS) process.removeListener(signal, onSignal);
  };
  process.once('exit', killAll);
  for (const signal of SIGNALS) process.once(signal, onSignal);
  return release;
}

type Spawned = ReturnType<typeof spawn>;

/**
 * Spawn `executable` as the root of its own tree. Windows has no process
 * groups to own (killGroup walks the tree), and a detached child there loses
 * its console, so each JVM it starts would allocate a console of its own.
 */
function spawnTree(
  executable: string,
  args: readonly string[],
  cwd: string,
  env: Record<string, string>
): Spawned {
  return spawn(executable, args, {
    cwd,
    env,
    detached: process.platform !== 'win32',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function closed(child: Spawned): Promise<void> {
  return new Promise((resolve) => {
    if (child.pid === undefined) return resolve();
    if (child.exitCode !== null || child.signalCode !== null) {
      if (child.stdout?.closed !== false && child.stderr?.closed !== false)
        return resolve();
    }
    child.once('close', () => resolve());
    child.once('error', () => resolve());
  });
}

/** Quint shows its Apalache server's log unless asked for verbosity below 2. */
export function showsServerLog(args: readonly string[]): boolean {
  const at = args.indexOf('--verbosity');
  return at < 0 || Number(args[at + 1]) >= 2;
}

/**
 * Quint gives up on a server it started after 60 one-second connection
 * attempts; the one started here gets the same time to listen.
 */
const SERVER_START_MS = 60_000;

/**
 * Waits for `port` to accept a connection. `listening` resolves `true` then,
 * and `false` when `server` exits first, `limitMs` passes or `stop` is called.
 */
function serverListening(
  server: Spawned,
  port: number,
  limitMs: number
): { readonly listening: Promise<boolean>; readonly stop: () => void } {
  let stop: () => void = () => {};
  const listening = new Promise<boolean>((resolve) => {
    let done = false;
    let retry: () => void = () => {};
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      cancelLimit();
      retry();
      server.removeListener('exit', onExit);
      server.removeListener('error', onExit);
      resolve(result);
    };
    const onExit = () => finish(false);
    stop = onExit;
    const cancelLimit = wallDeadline(limitMs, onExit);
    server.once('exit', onExit);
    server.once('error', onExit);
    const attempt = () => {
      if (done) return;
      const socket = connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        finish(true);
      });
      socket.once('error', () => {
        socket.destroy();
        retry = wallDeadline(100, attempt);
      });
    };
    attempt();
  });
  return { listening, stop };
}

type Collector = {
  readonly chunks: string[];
  readonly stdout: string[];
};

function collect(
  child: Spawned,
  into: Collector,
  options: { readonly stdout: boolean; readonly shown: boolean }
): void {
  child.stdout?.on('data', (chunk: Buffer) => {
    if (options.stdout) into.stdout.push(chunk.toString());
    if (options.shown) into.chunks.push(chunk.toString());
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    if (options.shown) into.chunks.push(chunk.toString());
  });
}

/**
 * Start the pinned Apalache server for one check on a free port. Resolves
 * its port once it listens, or `null` (with the server killed) when it
 * exits, fails to listen in time or `onStop` fires first.
 */
async function startServer(input: {
  readonly apalacheHome: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Record<string, string>;
  readonly temporary: string;
  readonly into: Collector;
  /** The server is spawned; `stop` gives up waiting for it to listen. */
  readonly started: (server: Spawned, stop: () => void) => void;
}): Promise<number | null> {
  const port = await freePort();
  const server = spawnTree(
    'java',
    apalacheServerArgs({
      home: input.apalacheHome,
      port,
      env: input.env,
      // As Apalache's launcher does: a fresh SANY directory per server.
      tmpdir: mkdtempSync(join(input.temporary, 'SANY')),
    }),
    input.cwd,
    input.env
  );
  server.once('error', (error) => input.into.chunks.push(String(error)));
  const shown = showsServerLog(input.args);
  const startup: string[] = [];
  let ready = false;
  const receive = (chunk: Buffer) => {
    if (shown) input.into.chunks.push(chunk.toString());
    else if (!ready) startup.push(chunk.toString());
  };
  server.stdout?.on('data', receive);
  server.stderr?.on('data', receive);
  const wait = serverListening(server, port, SERVER_START_MS);
  input.started(server, wait.stop);
  if (await wait.listening) {
    ready = true;
    startup.length = 0;
    return port;
  }
  killGroup(server.pid);
  await closed(server);
  input.into.chunks.push(...startup);
  input.into.chunks.push(
    `\nquint: the Apalache server on port ${String(port)} did not accept connections (exit code ${String(server.exitCode ?? 'none')}, signal ${server.signalCode ?? 'none'})\n`
  );
  return null;
}

/** Run Quint to its exit; resolves its exit code and signal. */
function runToExit(
  quint: Spawned,
  into: Collector,
  onExit: () => void
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  collect(quint, into, { stdout: true, shown: true });
  return new Promise((resolve) => {
    quint.once('error', (error) => {
      into.chunks.push(String(error));
      resolve({ code: null, signal: null });
    });
    // Quint's exit ends the check; anything it started may share the output
    // pipes, so its tree and the server go before waiting for them.
    quint.once('exit', (code, signal) => {
      onExit();
      resolve({ code, signal });
    });
  });
}

export async function runQuint(input: {
  readonly executable?: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Record<string, string>;
  readonly timeoutMs: number;
  /**
   * The pinned Apalache distribution. Its server is started here, on a free
   * port, in `cwd` (so `_apalache-out/` lands there), and Quint is pointed at
   * it with `--server-endpoint`: Quint connects instead of launching
   * `apalache-mc` itself, so the same JVM command runs on every OS (Quint
   * would launch `apalache-mc.bat` on Windows, and the JVM under it outlives
   * Quint's kill of the batch file) and this process owns the server's tree.
   */
  readonly apalacheHome?: string;
}): Promise<QuintRun> {
  const timeoutMs = verificationTimeLimitsEnabled(input.env)
    ? input.timeoutMs
    : Number.POSITIVE_INFINITY;
  // TLC extracts its standard modules into java.io.tmpdir. Sharing /tmp lets
  // a second verifier truncate a module while the first is parsing it.
  const temporary = join(resolve(input.cwd), 'tmp');
  mkdirSync(temporary, { recursive: true });
  const env = {
    ...input.env,
    TMPDIR: temporary,
    TEMP: temporary,
    TMP: temporary,
    // Keep deeply typed values independent of the host JVM's default stack,
    // matching the temporal checker's worker stack.
    JAVA_TOOL_OPTIONS: `${input.env['JAVA_TOOL_OPTIONS'] ?? ''} -Xss8m -Djava.io.tmpdir=${JSON.stringify(temporary)}`,
  };
  const into: Collector = { chunks: [], stdout: [] };
  let server: Spawned | undefined;
  let child: Spawned | undefined;
  let stopWaiting: () => void = () => {};
  const killAll = () => {
    killGroup(child?.pid);
    killGroup(server?.pid);
  };
  const release = guardGroups(() => [child?.pid, server?.pid]);
  let timedOut = false;
  const cancel = wallDeadline(timeoutMs, () => {
    timedOut = true;
    killAll();
    stopWaiting();
  });
  const result = (
    code: number | null,
    signal: NodeJS.Signals | null = null
  ): QuintRun => ({
    code,
    signal,
    timedOut,
    output: into.chunks.join(''),
    stdout: into.stdout.join(''),
  });
  try {
    let args = input.args;
    if (input.apalacheHome !== undefined) {
      const port = await startServer({
        ...input,
        apalacheHome: input.apalacheHome,
        env,
        temporary,
        into,
        started: (started, stop) => {
          server = started;
          stopWaiting = stop;
          if (timedOut) stop();
        },
      });
      if (port === null) return result(timedOut ? null : 1);
      args = [...args, '--server-endpoint', `127.0.0.1:${String(port)}`];
    }
    if (timedOut) return result(null);
    child = spawnTree(
      input.executable ?? process.execPath,
      args,
      input.cwd,
      env
    );
    const exit = await runToExit(child, into, killAll);
    await closed(child);
    if (server !== undefined) await closed(server);
    return result(exit.code, exit.signal);
  } finally {
    cancel();
    killAll();
    release();
  }
}
