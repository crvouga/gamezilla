export type CheckLease = {
  tryAcquire(): boolean;
  close(): void;
};

export type LocalCheckQueuePorts = {
  readonly openLease: () => CheckLease;
  readonly sleep: (signal: AbortSignal) => Promise<void>;
  readonly signal: AbortSignal;
  readonly queued: () => void;
};

/** Queue before preparing inputs; queue time consumes no check deadline. */
export async function withLocalCheckSlot<T>(
  work: () => Promise<T>,
  ports: LocalCheckQueuePorts
): Promise<T> {
  ports.signal.throwIfAborted();
  const lease = ports.openLease();
  let announced = false;
  try {
    for (;;) {
      ports.signal.throwIfAborted();
      if (lease.tryAcquire()) break;
      if (!announced) {
        ports.queued();
        announced = true;
      }
      await ports.sleep(ports.signal);
    }
    ports.signal.throwIfAborted();
    return await work();
  } finally {
    lease.close();
  }
}

/** Local defaults only. The remote runner keeps its existing settings. */
export function localCheckEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...source,
    TURBO_CONCURRENCY: source['TURBO_CONCURRENCY']?.trim() || '1',
    CHECK_CACHE_CONCURRENCY: source['CHECK_CACHE_CONCURRENCY']?.trim() || '1',
    CHECK_TEST_CONCURRENCY: source['CHECK_TEST_CONCURRENCY']?.trim() || '1',
    MODEL_CHECK_CONCURRENCY: source['MODEL_CHECK_CONCURRENCY']?.trim() || '1',
    CHECK_SOLVER_SLOTS: source['CHECK_SOLVER_SLOTS']?.trim() || '1',
  };
}
