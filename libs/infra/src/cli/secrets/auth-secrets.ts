import { Secret, requireNonEmpty, type SecretInput } from './secret';

async function validateAuthSecretKey(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'AUTH_SECRET_KEY');
  try {
    const res = await fetch('https://api.clerk.com/v1/users?limit=1', {
      headers: { Authorization: `Bearer ${v}` },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Clerk rejected AUTH_SECRET_KEY — HTTP ${String(res.status)}`
      );
    }
    if (!res.ok) {
      throw new Error(`Clerk API returned HTTP ${String(res.status)}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Clerk')) throw e;
    throw new Error(
      `Clerk unreachable: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

async function validateAuthPublishableKey(input: SecretInput): Promise<void> {
  requireNonEmpty(input.secretValue, 'AUTH_PUBLISHABLE_KEY');
}

export const AUTH_SECRET_KEY = new Secret({
  name: 'AUTH_SECRET_KEY',
  hint: 'Auth provider secret key (Clerk sk_…)',
  pushToApiWorker: true,
  validate: validateAuthSecretKey,
});

export const AUTH_PUBLISHABLE_KEY = new Secret({
  name: 'AUTH_PUBLISHABLE_KEY',
  hint: 'Auth provider publishable key (public)',
  pushToApiWorker: true,
  validate: validateAuthPublishableKey,
});

export const EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY = new Secret({
  name: 'EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY',
  hint: 'Client-facing Clerk publishable key (mirrors AUTH_PUBLISHABLE_KEY)',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY');
  },
  seed: async (input) => {
    const fromAuth = input.secrets.get('AUTH_PUBLISHABLE_KEY')?.trim() ?? '';
    if (fromAuth.length > 0) return fromAuth;
    throw new Error('AUTH_PUBLISHABLE_KEY must be set before seeding');
  },
});
