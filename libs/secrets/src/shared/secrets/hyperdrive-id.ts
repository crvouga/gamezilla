import { HEX32_RE } from './cloudflare';
import { Secret, type SecretInput } from './secret';

async function validateHyperdriveId(input: SecretInput): Promise<void> {
  if (!HEX32_RE.test(input.secretValue.trim())) {
    throw new Error('Must be a 32-character hex Hyperdrive config id');
  }
}

/**
 * Not a credential: the id the API Worker's `HYPERDRIVE` binding points at.
 * It rides the secrets store because that is how OpenTofu's outputs reach
 * the Worker deploy (`@libs/infra/public/wrangler` renders the binding).
 */
export const HYPERDRIVE_ID = new Secret({
  name: 'HYPERDRIVE_ID',
  hint: "Hyperdrive config in front of the env's Postgres — derived by OpenTofu (libs/infra/tofu/modules/database).",
  managedBy: 'tofu',
  validate: validateHyperdriveId,
});
