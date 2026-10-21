import { Assert } from './assert';

/**
 * Process-wide `assert`. No platform crash handler is pre-registered — until a
 * composition root registers one (`@pkgs/assert-crash-node-shared-ts`,
 * `@pkgs/assert-crash-browser-shared-ts`, or `ThrowingCrashHandler`), failures fall
 * through to `FallbackCrashHandler`.
 */
export const assert: Assert = Assert.crash();
