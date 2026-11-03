import { requireNonEmpty, Secret } from './secret';

/** CI publishing only; never included in product environments or static assets. */
export const CHROMATIC_PROJECT_TOKEN = new Secret({
  name: 'CHROMATIC_PROJECT_TOKEN',
  hint: 'Chromatic project upload token. Store in Infisical shared for CI Storybook publishing; never expose it in a story or VITE variable.',
  optional: true,
  async validate(input) {
    requireNonEmpty(input.secretValue, 'CHROMATIC_PROJECT_TOKEN');
  },
});
