import type { ServerHttp } from '@libs/sub-shared/sync';

export function harnessPartitionedError(from: string, to: string): TypeError {
  const err = new TypeError(`harness partition: ${from} ↛ ${to}`);
  err.name = 'HarnessPartitionedError';
  return err;
}

export function harnessCrashedError(id: string): TypeError {
  const err = new TypeError(`harness crash: ${id}`);
  err.name = 'HarnessCrashedError';
  return err;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Crash / partition over crossing ports only (server HTTP, pubsub, room). */
export function createHarnessNet(opts?: {
  readonly isPartitioned?: (a: string, b: string) => boolean;
}) {
  const crashed = new Set<string>();
  const partitions = new Set<string>();
  const listeners = new Set<() => void>();
  const changed = (): void => {
    for (const listener of [...listeners]) listener();
  };

  function assertReachable(from: string, to: string): void {
    if (crashed.has(from)) throw harnessCrashedError(from);
    if (crashed.has(to)) throw harnessCrashedError(to);
    if (from !== to && partitions.has(pairKey(from, to))) {
      throw harnessPartitionedError(from, to);
    }
    if (from !== to && opts?.isPartitioned?.(from, to) === true) {
      throw harnessPartitionedError(from, to);
    }
  }

  function isReachable(from: string, to: string): boolean {
    try {
      assertReachable(from, to);
      return true;
    } catch {
      return false;
    }
  }

  return {
    crash(id: string): void {
      crashed.add(id);
      changed();
    },
    restart(id: string): void {
      crashed.delete(id);
      changed();
    },
    partition(a: string, b: string): void {
      partitions.add(pairKey(a, b));
      changed();
    },
    heal(a?: string, b?: string): void {
      if (a === undefined) {
        partitions.clear();
        changed();
        return;
      }
      if (b === undefined) {
        for (const key of [...partitions]) {
          if (key.startsWith(`${a}|`) || key.endsWith(`|${a}`)) {
            partitions.delete(key);
          }
        }
        changed();
        return;
      }
      partitions.delete(pairKey(a, b));
      changed();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Gate one directed hop (`client-a → lb`, `lb → server-b`). */
    wrapHop(fromId: string, toId: string, inner: ServerHttp): ServerHttp {
      return async (input, init) => {
        assertReachable(fromId, toId);
        return inner(input, init);
      };
    },
    assertReachable,
    isReachable,
    isCrashed(id: string): boolean {
      return crashed.has(id);
    },
  };
}

export type HarnessNet = ReturnType<typeof createHarnessNet>;
