import { Secret, type SecretInput } from './secret';
import { validateRailwayToken } from '../lib/railway-api';

async function validateRailwayTokenSecret(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  if (value.length === 0) return;
  await validateRailwayToken(value);
}

export const RAILWAY_TOKEN = new Secret({
  name: 'RAILWAY_TOKEN',
  hint: [
    'https://railway.com/account/tokens → Create a token',
    'Used by infra to provision the gamezilla / emqx Railway service.',
    'Never pushed to the API Worker.',
  ].join('\n'),
  optional: true,
  mirrorToDev: true,
  validate: validateRailwayTokenSecret,
});
