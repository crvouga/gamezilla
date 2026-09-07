// @io-wall-ok -- test-tool composition root
import { defineSolidVitestConfig } from '@pkgs/vitest-solid/config';

export default defineSolidVitestConfig({
  root: import.meta.dirname,
  include: ['src/**/*.test.tsx', 'tests/**/*.test.tsx'],
});
