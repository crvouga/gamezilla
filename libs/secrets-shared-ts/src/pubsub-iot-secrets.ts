import { pubsubIotSecretDefs } from '@libs/pubsub-shared-ts/iot-secret-defs';
import type { SecretInput } from './secret';
import { Secret } from './secret';

function wrapDefs(): Secret[] {
  return pubsubIotSecretDefs.map((def) => {
    return new Secret({
      name: def.name,
      hint: def.hint,
      optional: def.optional === true,
      pushToApiWorker: def.pushToApiWorker === true,
      managedBy: 'tofu',
      validate: async (input: SecretInput) => {
        await def.validate({ secretValue: input.secretValue });
      },
    });
  });
}

export const IOT_SECRETS: readonly Secret[] = wrapDefs();
