import type { Subprocess } from 'bun';
import { STRIPE_CLI_LOG_TAG } from './constants';
import {
  asReadableUint8Stream,
  readLinesFromStream,
} from './readable-stream-lines';
import type { WriteQueue } from './write-queue';

export type RunStripeListenArgs = {
  readonly child: Subprocess;
  readonly onTranscriptLine: (line: string) => void;
  readonly writeQueue: WriteQueue;
};

const SHUTDOWN_EXIT = 130;

function killListenChild(child: Subprocess): void {
  if (child.exitCode !== null) return;
  try {
    child.kill('SIGKILL');
  } catch {
    // ignore
  }
}

/**
 * Pipe `stripe listen` stdout/stderr through `onTranscriptLine`, wait for the
 * process to exit, then flush queued writes (Vault + probe). Kills the child
 * on failure so turbo does not leave a stray listener.
 */
export async function runStripeListenUntilExit(
  args: RunStripeListenArgs
): Promise<number> {
  const { child, onTranscriptLine, writeQueue } = args;
  const abort = new AbortController();

  const onShutdownSignal = (): void => {
    abort.abort();
    killListenChild(child);
  };
  process.on('SIGINT', onShutdownSignal);
  process.on('SIGTERM', onShutdownSignal);

  const pipeOut = readLinesFromStream(
    asReadableUint8Stream(child.stdout),
    onTranscriptLine,
    abort.signal
  );
  const pipeErr = readLinesFromStream(
    asReadableUint8Stream(child.stderr),
    onTranscriptLine,
    abort.signal
  );

  try {
    await Promise.all([pipeOut, pipeErr, child.exited]);
    await writeQueue.flush();
  } catch (e: unknown) {
    if (abort.signal.aborted) return SHUTDOWN_EXIT;
    killListenChild(child);
    await child.exited.catch(() => {});
    throw e;
  } finally {
    process.off('SIGINT', onShutdownSignal);
    process.off('SIGTERM', onShutdownSignal);
  }

  if (abort.signal.aborted) return SHUTDOWN_EXIT;
  return await child.exited;
}

export function spawnStripeListen(args: {
  readonly repoRoot: string;
  readonly stripeSecretKey: string;
  readonly forwardToUrl: string;
}): Subprocess {
  const argv = [
    process.execPath,
    'x',
    'stripe',
    'listen',
    '--api-key',
    args.stripeSecretKey,
    '--forward-to',
    args.forwardToUrl,
    '--skip-verify',
  ];
  console.log(
    `[${STRIPE_CLI_LOG_TAG}] starting: ${argv.join(' ')} (cwd ${args.repoRoot})`
  );
  return Bun.spawn(argv, {
    cwd: args.repoRoot,
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  });
}
