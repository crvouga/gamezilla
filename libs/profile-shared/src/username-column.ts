import { indexFingerprintName } from '@pkgs/db-schema-root-shared/index-fingerprint';

/**
 * Physical unique index on `profile.username_norm`. Mutations that write the
 * column map its violation to `USERNAME_TAKEN` through `constraintErrors`.
 */
export const USERNAME_NORM_UNIQUE_INDEX = indexFingerprintName(
  'profile',
  ['username_norm'],
  true
);

/** Business rejection for a username unique-index violation. */
export const USERNAME_TAKEN_CONSTRAINT_ERROR = {
  code: 'USERNAME_TAKEN',
  message: 'Username is taken.',
} as const;
