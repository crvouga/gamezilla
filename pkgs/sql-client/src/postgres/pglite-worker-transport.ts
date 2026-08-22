/**
 * Main-thread RPC transport to {@link ./pglite-worker-host.cjs}.
 */

import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

type WorkerReply =
  | { readonly id: number; readonly result: unknown }
  | { readonly id: number; readonly error: string };

export type PgliteWorkerTransport = {
  readonly call: (
    op: string,
    extra?: Record<string, unknown>
  ) => Promise<unknown>;
  readonly disconnect: () => Promise<void>;
};

function resolveWorkerEntry(): string {
  return join(__dirname, 'pglite-worker-host.cjs');
}

export async function openPgliteWorkerTransport(args?: {
  readonly seedB64?: string;
}): Promise<PgliteWorkerTransport> {
  const worker = new Worker(resolveWorkerEntry(), {
    execArgv: ['--experimental-vm-modules'],
  });

  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
    }
  >();

  worker.on('message', (msg: WorkerReply) => {
    const slot = pending.get(msg.id);
    if (slot === undefined) return;
    pending.delete(msg.id);
    if ('error' in msg) {
      slot.reject(new Error(msg.error));
      return;
    }
    slot.resolve(msg.result);
  });

  worker.on('error', (err) => {
    for (const slot of pending.values()) {
      slot.reject(err instanceof Error ? err : new Error(String(err)));
    }
    pending.clear();
  });

  const call = (
    op: string,
    extra?: Record<string, unknown>
  ): Promise<unknown> => {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, op, ...extra });
    });
  };

  await call('create', {
    ...(args?.seedB64 !== undefined ? { seedB64: args.seedB64 } : {}),
  });

  return {
    call,
    disconnect: async () => {
      await call('close');
      await worker.terminate();
    },
  };
}
