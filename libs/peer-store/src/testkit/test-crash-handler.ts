import type { CrashHandler } from '@gamezilla/lib/assert/crash/crash-handler/crash-handler'

export class TestCrashHandler implements CrashHandler {
  readonly priority = 0

  match(): boolean {
    return true
  }

  crash(message: string, context?: Record<string, unknown>): never {
    const err = new Error(`[CRASH] ${message}`)
    Object.defineProperty(err, 'context', {
      value: context,
      enumerable: true,
      writable: true,
    })
    throw err
  }
}
