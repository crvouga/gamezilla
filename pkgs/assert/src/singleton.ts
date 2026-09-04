import { Assert } from './assert';

/**
 * Process-wide `assert`. No platform crash handler is pre-registered — until a
 * composition root registers one (`@pkgs/assert-crash-node`,
 * `@pkgs/assert-crash-browser`, `@pkgs/assert-crash-expo`, or
 * `ThrowingCrashHandler`), failures fall through to `FallbackCrashHandler`.
 */
export const assert: Assert = Assert.crash();
