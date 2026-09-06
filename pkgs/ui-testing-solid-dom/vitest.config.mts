// @io-wall-ok — test-tool composition root
import { defineSolidVitestConfig } from '@pkgs/vitest-solid/config';

export default defineSolidVitestConfig({
  root: import.meta.dirname,
  include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  overrides: {
    test: {
      server: {
        deps: {
          // `@pkgs/ui` (dev dependency for the demo app) pulls Solid packages
          // that ship raw `.jsx`; vite-plugin-solid only crawls packages with
          // a `solid` export condition, so inline them explicitly.
          inline: [/@solidjs\/router/, /@tanstack\/solid-/, /lucide-solid/],
        },
      },
    },
  },
});
