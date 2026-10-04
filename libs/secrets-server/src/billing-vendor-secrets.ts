import { cliHttp } from '@libs/secrets-shared/cli-io';
import type { SecretInput } from '@libs/secrets-shared/secret';
import { requireNonEmpty, Secret } from '@libs/secrets-shared/secret';
import { MEMBERSHIP_PROVIDER_MODULES } from '@pkgs/billing-providers-server/billing-providers';
import type { MembershipProviderSecretDef } from '@pkgs/billing-shared/provider-module';

function wrap(def: MembershipProviderSecretDef): Secret {
  return new Secret({
    name: def.name,
    hint: def.hint,
    optional: def.optional,
    pushToApiWorker: def.pushToApiWorker,
    validate: async (input: SecretInput) => {
      requireNonEmpty(input.secretValue, def.name);
      await def.validate({
        secretValue: input.secretValue,
        fetch: cliHttp.fetch.bind(cliHttp),
      });
    },
  });
}

/**
 * Every billing provider's secrets, from the shared provider list — names
 * and validation owned by each provider package, none of them required.
 */
export const BILLING_VENDOR_SECRETS: readonly Secret[] =
  MEMBERSHIP_PROVIDER_MODULES.flatMap((module) => module.secrets).map(wrap);
