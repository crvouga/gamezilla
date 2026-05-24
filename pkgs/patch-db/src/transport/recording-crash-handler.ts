import type { CrashHandler } from '@pkgs/assert';

/**
 * Crash handler that captures every dispatched crash for inspection.
 * Lives next to the transport tests so a test can register it as a
 * priority-`0` handler, run the system under test, then read
 * {@link captured} to assert that the original `assert.crash` message +
 * context propagated correctly across an HTTP boundary.
 *
 * `crash()` returns synchronously (mirrors `BrowserCrashHandler.crash`) so
 * the caller's control flow continues — exactly the runtime shape we want
 * to verify on the client side.
 *
 * Test-only file (referenced by `*.test.ts` siblings). It does not live in
 * the package's public surface.
 */
export class RecordingCrashHandler implements CrashHandler {
  readonly priority = 0;
  readonly captured: Array<{
    message: string;
    context: Record<string, unknown> | undefined;
  }> = [];
  match(): boolean {
    return true;
  }
  crash(message: string, context?: Record<string, unknown>): void {
    this.captured.push({ message, context });
  }
}
