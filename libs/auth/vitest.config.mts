import { defineSolidVitestConfig } from '@pkgs/vitest-solid/config';

export default defineSolidVitestConfig({
  root: import.meta.dirname,
  include: ['tests/**/*.test.{ts,tsx}', 'src/public/*.test.ts'],
});
