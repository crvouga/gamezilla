// @io-wall-ok — test-tool composition root
import { defineSolidVitestConfig } from '@pkgs/vitest-solid/config';

// `bun test` covers the pure `.test.ts` suites; Vitest owns the Solid DOM
// `.test.tsx` suites under `@solidjs/testing-library`.
export default defineSolidVitestConfig({
  root: import.meta.dirname,
  include: ['src/**/*.test.tsx', 'tests/**/*.test.tsx'],
});
