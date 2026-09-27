import type { CrashHandler } from './crash-handler';

const UNCATCHABLE_ERROR = { __assertion_failure: true };

/** Last-resort handler when no registered handler matches (`crash.ts` dispatch). */
export class FallbackCrashHandler implements CrashHandler {
  readonly priority = Number.MAX_SAFE_INTEGER;

  match(): boolean {
    return true;
  }

  crash(message: string, context?: Record<string, unknown>): void {
    // Tiger: non-Error throw object is intentional (filtered by crash dispatch).
    // uncatchable assertion envelope, not a string. It carries the stack so
    // whoever reports it (the test runner, an error boundary) has the trace —
    // `crash()` itself never logs.
    const { stack } = new Error(message);
    throw { ...UNCATCHABLE_ERROR, message, context, stack };
  }
}
