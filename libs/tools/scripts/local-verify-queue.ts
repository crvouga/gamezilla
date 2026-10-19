export type VerifyLease = {
  tryAcquire(): boolean;
  close(): void;
};

export type LocalVerifyQueuePorts = {
  readonly openLease: () => VerifyLease;
  readonly sleep: (signal: AbortSignal) => Promise<void>;
  readonly signal: AbortSignal;
  readonly queued: () => void;
};

/** Queue before preparing inputs; queue time consumes no verification deadline. */
export async function withLocalVerifySlot<T>(
  work: () => Promise<T>,
  ports: LocalVerifyQueuePorts
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
export function localVerifyEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...source,
    TURBO_CONCURRENCY: source['TURBO_CONCURRENCY']?.trim() || '1',
    VERIFY_CACHE_CONCURRENCY: source['VERIFY_CACHE_CONCURRENCY']?.trim() || '1',
    VERIFY_TEST_CONCURRENCY: source['VERIFY_TEST_CONCURRENCY']?.trim() || '1',
    MODEL_VERIFY_CONCURRENCY: source['MODEL_VERIFY_CONCURRENCY']?.trim() || '1',
    VERIFY_SOLVER_SLOTS: source['VERIFY_SOLVER_SLOTS']?.trim() || '1',
  };
}
