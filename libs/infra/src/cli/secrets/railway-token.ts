import { validateRailwayToken } from '../lib/railway-api-core';
import {
  Secret,
  requireNonEmpty,
  type SecretInput,
} from './secret';

/**
 * Optional until EMQX is provisioned. When set, live-probe Railway so
 * `check:secrets` / provision catch bad tokens and account holds (past-due
 * bills return GraphQL "Not Authorized") before Ensure: emqx.
 * Requires an account token — workspace tokens fail `me { id }`.
 */
async function validateRailwayTokenSecret(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  if (value.length === 0) return;
  requireNonEmpty(value, 'RAILWAY_TOKEN');
  try {
    await validateRailwayToken(value);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Railway')) throw e;
    if (e instanceof Error && e.message.startsWith('RAILWAY_TOKEN')) throw e;
    // Network blip — don't fail secret validation on transient errors.
  }
}

export const RAILWAY_TOKEN = new Secret({
  name: 'RAILWAY_TOKEN',
  hint: [
    'https://railway.com/account/tokens → Create a token',
    'Select "No workspace" (account token). Workspace/project tokens fail me-scoped GraphQL.',
    'Used by infra to provision the gamezilla / emqx Railway service.',
    'Past-due Railway invoices suspend API access (Not Authorized) — pay billing first.',
    'Never pushed to the API Worker.',
  ].join('\n'),
  optional: true,
  mirrorToDev: true,
  validate: validateRailwayTokenSecret,
});
