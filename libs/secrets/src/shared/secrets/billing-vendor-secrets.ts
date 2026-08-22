import { billingStripeSecretDefs } from '@pkgs/billing-stripe';
import { cliHttp } from '../cli-io';
import { requireNonEmpty, Secret, type SecretInput } from './secret';

function wrapDefs(): Secret[] {
  return billingStripeSecretDefs.map(
    (def) =>
      new Secret({
        name: def.name,
        hint: def.hint,
        optional: def.optional === true,
        pushToApiWorker: def.pushToApiWorker === true,
        validate: async (input: SecretInput) => {
          requireNonEmpty(input.secretValue, def.name);
          await def.validate({
            secretValue: input.secretValue,
            fetch: cliHttp.fetch.bind(cliHttp),
          });
        },
      })
  );
}

const [secretKey, publishableKey] = wrapDefs();

/** Re-exported for registry — names/validation owned by `@pkgs/billing-stripe`. */
export const BILLING_VENDOR_SECRET_KEY = secretKey!;
export const BILLING_VENDOR_PUBLISHABLE_KEY = publishableKey!;
