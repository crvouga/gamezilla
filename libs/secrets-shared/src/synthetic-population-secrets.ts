import { Secret } from './secret';

function syntheticPopulationSecret(name: string, hint: string): Secret {
  return new Secret({
    name,
    hint,
    pushToApiWorker: true,
    managedBy: 'tofu',
    validate: async (input) => {
      if (input.secretValue.trim().length < 32)
        throw new Error(`${name} must contain at least 32 characters`);
    },
  });
}

export const POPULATION_WORKER_TOKEN = syntheticPopulationSecret(
  'POPULATION_WORKER_TOKEN',
  'Synthetic Population Worker control-plane bearer'
);
export const POPULATION_CREDENTIAL_SECRET = syntheticPopulationSecret(
  'POPULATION_CREDENTIAL_SECRET',
  'Persistent Synthetic User credential encryption key'
);
