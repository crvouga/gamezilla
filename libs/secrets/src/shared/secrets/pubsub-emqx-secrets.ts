import { pubsubEmqxSecretDefs } from '@libs/pubsub/shared/secrets/emqx-secret-defs';
import { Secret, type SecretInput } from './secret';

function wrapDefs(): Secret[] {
  return pubsubEmqxSecretDefs.map((def) => {
    const config = {
      name: def.name,
      hint: def.hint,
      optional: def.optional === true,
      pushToApiWorker: def.pushToApiWorker === true,
      managedBy: 'tofu' as const,
      validate: async (input: SecretInput) => {
        await def.validate({ secretValue: input.secretValue });
      },
    };
    return new Secret(config);
  });
}

const [apiUrl, wssUrl, apiKey, apiSecret, jwtSecret, dashboardPassword] =
  wrapDefs();

/** Re-exported for registry — names/validation owned by `@libs/pubsub`. */
export const EMQX_API_URL = apiUrl!;
export const EMQX_WSS_URL = wssUrl!;
export const EMQX_API_KEY = apiKey!;
export const EMQX_API_SECRET = apiSecret!;
export const EMQX_JWT_SECRET = jwtSecret!;
export const EMQX_DASHBOARD_PASSWORD = dashboardPassword!;
