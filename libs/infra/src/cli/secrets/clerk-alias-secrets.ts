/**
 * Legacy Clerk env names still read by Playwright / testing helpers.
 * Prefer AUTH_PUBLISHABLE_KEY / AUTH_SECRET_KEY; these seed from them.
 */
import { requireNonEmpty, Secret } from './secret';

export const CLERK_PUBLISHABLE_KEY = new Secret({
  name: 'CLERK_PUBLISHABLE_KEY',
  hint: 'Legacy alias of AUTH_PUBLISHABLE_KEY (Playwright)',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'CLERK_PUBLISHABLE_KEY');
  },
  seed: async (input) => {
    const fromAuth = input.secrets.get('AUTH_PUBLISHABLE_KEY')?.trim() ?? '';
    if (fromAuth.length === 0) {
      throw new Error('AUTH_PUBLISHABLE_KEY must be set before seeding');
    }
    return fromAuth;
  },
});

export const CLERK_SECRET_KEY = new Secret({
  name: 'CLERK_SECRET_KEY',
  hint: 'Legacy alias of AUTH_SECRET_KEY (Playwright)',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'CLERK_SECRET_KEY');
  },
  seed: async (input) => {
    const fromAuth = input.secrets.get('AUTH_SECRET_KEY')?.trim() ?? '';
    if (fromAuth.length === 0) {
      throw new Error('AUTH_SECRET_KEY must be set before seeding');
    }
    return fromAuth;
  },
});
