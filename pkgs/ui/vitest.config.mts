// @io-wall-ok — test-tool composition root
import { defineSolidVitestConfig } from '@pkgs/vitest-solid/config';

// All `@pkgs/ui` tests (DOM and pure) run under Vitest so `.ts` logic tests can
// import through package `exports` that resolve to `.tsx` modules.
export default defineSolidVitestConfig({
  root: import.meta.dirname,
  include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
});
