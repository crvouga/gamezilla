import { requireNonEmpty, Secret } from './secret';

export const CI_ARTIFACTS_SECRET_NAMES = [
  'CI_ARTIFACTS_BUCKET',
  'CI_ARTIFACTS_ENDPOINT',
  'CI_ARTIFACTS_REGION',
  'CI_ARTIFACTS_ACCESS_KEY_ID',
  'CI_ARTIFACTS_SECRET_ACCESS_KEY',
] as const;

/**
 * Fleet-managed credentials for the bucket CI jobs hand files through. Only
 * CI reads them, so the API Worker never receives them.
 */
export const CI_ARTIFACTS_SECRETS = CI_ARTIFACTS_SECRET_NAMES.map(
  (name) =>
    new Secret({
      name,
      hint: 'CI artifact storage, managed by the OpenTofu fleet stack',
      managedBy: 'tofu',
      validate: async ({ secretValue }) => requireNonEmpty(secretValue, name),
    })
);
