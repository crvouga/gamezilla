import { requireNonEmpty, Secret } from './secret';

export const RAILWAY_TOKEN = new Secret({
  name: 'RAILWAY_TOKEN',
  hint: 'Railway workspace API token with access to the declared workspace; shared deployment credential, never injected into an application.',
  async validate(input) {
    requireNonEmpty(input.secretValue, 'Railway token');
  },
});
