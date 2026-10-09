import { Secret } from './secret';

function populationSecret(name: string, hint: string): Secret {
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

export const POPULATION_WORKER_TOKEN = populationSecret(
  'POPULATION_WORKER_TOKEN',
  'Population Worker control-plane bearer'
);
export const POPULATION_CREDENTIAL_SECRET = populationSecret(
  'POPULATION_CREDENTIAL_SECRET',
  'Persistent Synthetic User credential encryption key'
);
