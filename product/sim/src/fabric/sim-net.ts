import type { ServerHttp } from '@apps/client/shell/client-env';

export function simPartitionedError(from: string, to: string): TypeError {
  const err = new TypeError(`sim partition: ${from} ↛ ${to}`);
  err.name = 'SimPartitionedError';
  return err;
}

export function simCrashedError(id: string): TypeError {
  const err = new TypeError(`sim crash: ${id}`);
  err.name = 'SimCrashedError';
  return err;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Crash / partition over crossing ports only (server HTTP, pubsub, room). */
export function createSimNet(opts?: {
  readonly isPartitioned?: (a: string, b: string) => boolean;
}) {
  const crashed = new Set<string>();
  const partitions = new Set<string>();

  function assertReachable(from: string, to: string): void {
    if (crashed.has(from)) throw simCrashedError(from);
    if (crashed.has(to)) throw simCrashedError(to);
    if (from !== to && partitions.has(pairKey(from, to))) {
      throw simPartitionedError(from, to);
    }
    if (from !== to && opts?.isPartitioned?.(from, to) === true) {
      throw simPartitionedError(from, to);
    }
  }

  return {
    crash(id: string): void {
      crashed.add(id);
    },
    restart(id: string): void {
      crashed.delete(id);
    },
    partition(a: string, b: string): void {
      partitions.add(pairKey(a, b));
    },
    heal(a?: string, b?: string): void {
      if (a === undefined) {
        partitions.clear();
        return;
      }
      if (b === undefined) {
        for (const key of [...partitions]) {
          if (key.startsWith(`${a}|`) || key.endsWith(`|${a}`)) {
            partitions.delete(key);
          }
        }
        return;
      }
      partitions.delete(pairKey(a, b));
    },
    wrapServerHttp(fromId: string, inner: ServerHttp): ServerHttp {
      return async (input, init) => {
        assertReachable(fromId, 'server');
        return inner(input, init);
      };
    },
    assertReachable,
    isCrashed(id: string): boolean {
      return crashed.has(id);
    },
  };
}

export type SimNet = ReturnType<typeof createSimNet>;
