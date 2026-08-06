import {
  Secret,
  requireNonEmpty,
  type SecretInput,
} from './secret';

/**
 * Optional until EMQX is provisioned. Do not live-call Railway here —
 * `me { id }` rejects workspace tokens ("Not Authorized"), and optional
 * live API checks create false negatives in check:secrets.
 * EMQX provision validates the token against the API at deploy time.
 */
async function validateRailwayTokenSecret(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  if (value.length === 0) return;
  requireNonEmpty(value, 'RAILWAY_TOKEN');
}

export const RAILWAY_TOKEN = new Secret({
  name: 'RAILWAY_TOKEN',
  hint: [
    'https://railway.com/account/tokens → Create a token',
    'Select "No workspace" (account token). Workspace/project tokens fail me-scoped GraphQL.',
    'Used by infra to provision the gamezilla / emqx Railway service.',
    'Never pushed to the API Worker.',
  ].join('\n'),
  optional: true,
  mirrorToDev: true,
  validate: validateRailwayTokenSecret,
});
