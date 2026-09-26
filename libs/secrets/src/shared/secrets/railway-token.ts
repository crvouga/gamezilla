import { requireNonEmpty, Secret, type SecretInput } from './secret';

async function validateRailwayTokenSecret(input: SecretInput): Promise<void> {
  requireNonEmpty(input.secretValue, 'RAILWAY_TOKEN');
}

/** OpenTofu Railway provider credential (the broker's project and service). */
export const RAILWAY_TOKEN = new Secret({
  name: 'RAILWAY_TOKEN',
  hint: [
    'https://railway.com/account/tokens → Create a token',
    'Select "No workspace" (account token). Workspace/project tokens cannot create projects.',
    "Used by libs/infra (OpenTofu) to manage the environment's EMQX Railway project.",
    'Past-due Railway invoices suspend API access (Not Authorized) — pay billing first.',
    'Never pushed to the API Worker.',
  ].join('\n'),
  validate: validateRailwayTokenSecret,
});
