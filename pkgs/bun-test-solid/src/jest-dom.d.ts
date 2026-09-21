/**
 * jest-dom matcher types for `bun:test` (installed at runtime by `./preload`).
 * Consumers list `"@pkgs/bun-test-solid/jest-dom"` in `tsconfig.tc.json` `types`.
 */
import type { expect } from 'bun:test';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'bun:test' {
  // Declaration merging needs an `interface`, and its body stays empty: the
  // members come from `extends`.
  /* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type */
  interface Matchers<T = unknown>
    extends TestingLibraryMatchers<
      ReturnType<typeof expect.stringContaining>,
      T
    > {}
  /* oxlint-enable typescript/consistent-type-definitions, typescript/no-empty-object-type */
}
