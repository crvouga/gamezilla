import { pubsubEmqxSecretDefs } from '@libs/pubsub/shared/secrets/emqx-secret-defs';
import { Secret, type SecretInput, type SecretSeedInput } from './secret';

function wrapDefs(): Secret[] {
  return pubsubEmqxSecretDefs.map((def) => {
    const config = {
      name: def.name,
      hint: def.hint,
      optional: def.optional === true,
      pushToApiWorker: def.pushToApiWorker === true,
      mirrorToDev: def.mirrorToDev === true,
      validate: async (input: SecretInput) => {
        await def.validate({ secretValue: input.secretValue });
      },
      ...(def.seed === undefined
        ? {}
        : {
            seed: async (input: SecretSeedInput) =>
              def.seed!({ secrets: input.secrets }),
          }),
    };
    return new Secret(config);
  });
}

const [
  apiUrl,
  wssUrl,
  apiKey,
  apiSecret,
  jwtSecret,
] = wrapDefs();

/** Re-exported for registry — names/validation owned by `@libs/pubsub`. */
export const EMQX_API_URL = apiUrl!;
export const EMQX_WSS_URL = wssUrl!;
export const EMQX_API_KEY = apiKey!;
export const EMQX_API_SECRET = apiSecret!;
export const EMQX_JWT_SECRET = jwtSecret!;
