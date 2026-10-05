import { requireNonEmpty, Secret } from './secret';

/** History queries need organization access, unlike Depot's job token. */
export const DEPOT_ORG_TOKEN = new Secret({
  name: 'DEPOT_ORG_TOKEN',
  hint: 'Depot organization API token for Health history. Store once in the shared secrets environment. Never use the automatic job-scoped DEPOT_TOKEN or push this token to a Worker.',
  optional: true,
  validate: async (input) =>
    requireNonEmpty(input.secretValue, 'DEPOT_ORG_TOKEN'),
});
