/**
 * Distributed lock backed by storage (e.g. {@link Kv}). Consumers choose the key namespace.
 */
export interface LockInfo {
  readonly id: string;
  readonly operation: string;
  readonly holder: string;
  readonly pid: number;
  readonly ci: boolean;
  readonly startedAt: string;
}

export interface LockHandle {
  readonly id: string;
  release(): Promise<void>;
}

export class LockHeldError extends Error {
  override readonly name = 'LockHeldError';

  constructor(public readonly current: LockInfo) {
    super(`lock held by ${current.holder} (operation=${current.operation})`);
  }
}

export interface DistributedLock {
  acquire(operation: string): Promise<LockHandle>;
  status(): Promise<LockInfo | null>;
  /** Removes the lock regardless of holder. Returns previous holder if any. */
  forceUnlock(): Promise<LockInfo | null>;
  /**
   * Same fenced delete as {@link LockHandle.release}, for when the original
   * DB connection died before release could complete (e.g. idle timeout during
   * a long deploy). Only removes the row if it still matches `expectedId`.
   */
  releaseIfHeldById(expectedId: string): Promise<void>;
}

export interface LockIdentityProvider {
  build(operation: string): LockInfo;
}
