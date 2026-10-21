// @io-wall-ok — supervisor diagnostics must survive the child and its collector.
import type { ChildProcess } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { processFailureDocument } from '@pkgs/observability-root-shared-ts/process-failure';

type Source = { readonly instanceId: string; readonly dataDir: string };
const expectedExits = new WeakSet<ChildProcess>();
const diagnostics = new WeakMap<ChildProcess, Promise<void>>();
const MAX_STDERR_CHARS = 16_384;

export function expectChildExit(child: ChildProcess): void {
  expectedExits.add(child);
}

export async function waitForChildDiagnostics(
  child: ChildProcess
): Promise<void> {
  await diagnostics.get(child);
}

export function recordProcessFailure(
  source: Source,
  args: {
    readonly serviceName: string;
    readonly error: Error;
    readonly pid?: number;
    readonly exitCode?: number;
    readonly signal?: string;
  }
): void {
  const directory = join(source.dataDir, 'observability');
  const nowMs = Date.now();
  const document = processFailureDocument({
    ...args,
    instanceId: source.instanceId,
    nowMs,
    createId: () => crypto.randomUUID(),
  });
  mkdirSync(directory, { recursive: true });
  appendFileSync(
    join(directory, 'process-failures.ndjson'),
    `${JSON.stringify(document)}\n`
  );
  writeFileSync(
    join(directory, 'trace-source.json'),
    JSON.stringify({
      instanceId: source.instanceId,
      startedAtMs: nowMs,
      observabilityTraceDir: directory,
    })
  );
}

/** Capture terminal evidence before a failed child can bring down its supervisor. */
export function observeChildFailures(
  child: ChildProcess,
  source: Source,
  serviceName: string
): void {
  let stderr = '';
  const finished = Promise.withResolvers<void>();
  diagnostics.set(child, finished.promise);
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
    stderr = `${stderr}${chunk.toString()}`.slice(-MAX_STDERR_CHARS);
  });
  child.once('error', (error) =>
    recordProcessFailure(source, {
      serviceName,
      error,
      ...(child.pid === undefined ? {} : { pid: child.pid }),
    })
  );
  child.once('close', (code, signal) => {
    if (expectedExits.has(child) || (code === 0 && signal === null)) {
      finished.resolve();
      return;
    }
    const error = new Error(
      `Process exited with ${signal ?? `code ${String(code)}`}`
    );
    if (stderr.trim().length > 0) error.stack = stderr;
    recordProcessFailure(source, {
      serviceName,
      error,
      ...(child.pid === undefined ? {} : { pid: child.pid }),
      ...(code === null ? {} : { exitCode: code }),
      ...(signal === null ? {} : { signal }),
    });
    finished.resolve();
  });
}

/** Keep Node/Bun's fatal-exception behavior, while writing evidence synchronously. */
export function installProcessDiagnostics(
  source: Source,
  serviceName: string
): void {
  process.on('uncaughtExceptionMonitor', (error) =>
    recordProcessFailure(source, {
      serviceName,
      error,
      pid: process.pid,
    })
  );
  process.on('unhandledRejection', (reason: unknown) => {
    recordProcessFailure(source, {
      serviceName,
      error: reason instanceof Error ? reason : new Error(String(reason)),
      pid: process.pid,
    });
    process.exit(1);
  });
}
