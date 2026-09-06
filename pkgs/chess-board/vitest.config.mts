// @io-wall-ok — test-tool composition root
import { defineSolidVitestConfig } from '@pkgs/vitest-solid/config';

export default defineSolidVitestConfig({
  root: import.meta.dirname,
  include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  overrides: {
    ssr: {
      noExternal: ['@solidjs/router', '@pkgs/ui'],
    },
    test: {
      server: {
        deps: {
          inline: [/@solidjs\/router/, /@pkgs\/ui/],
        },
      },
    },
  },
});
