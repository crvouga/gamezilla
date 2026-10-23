import { requireNonEmpty, Secret } from './secret';

export const SHARED_DATA_SECRET_NAMES = [
  'SHARED_DATA_BUCKET',
  'SHARED_DATA_ENDPOINT',
  'SHARED_DATA_REGION',
  'SHARED_DATA_ACCESS_KEY_ID',
  'SHARED_DATA_SECRET_ACCESS_KEY',
] as const;

/** Fleet-managed credentials for the one durable shared-data bucket. */
export const SHARED_DATA_SECRETS = SHARED_DATA_SECRET_NAMES.map(
  (name) =>
    new Secret({
      name,
      hint: 'Shared reference data storage, managed by the OpenTofu fleet stack',
      pushToApiWorker: true,
      managedBy: 'tofu',
      validate: async ({ secretValue }) => requireNonEmpty(secretValue, name),
    })
);
