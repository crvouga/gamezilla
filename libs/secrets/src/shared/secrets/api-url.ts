import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { requireNonEmpty, Secret, type SecretInput } from './secret';

function productionApiPublicOrigin(): string {
  return `https://api.${PRODUCT_CONFIG.domain}`;
}

async function validateApiOrigin(
  input: SecretInput,
  label: string
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, label);
  try {
    const u = new URL(v);
    if (u.pathname !== '' && u.pathname !== '/') {
      throw new Error(`${label} must be an origin only (no path)`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('origin only')) throw e;
    throw new Error(`${label} must be a valid URL`);
  }
  if (!v.startsWith('https://') && !v.startsWith('http://')) {
    throw new Error(`${label} must start with http:// or https://`);
  }
}

export const API_URL = new Secret({
  name: 'API_URL',
  hint: 'Public origin of the API Worker (https://api.…), no path',
  // Seeded on provision when absent; optional so check:secrets does not fail
  // before the first `infra provision` writes the derived default.
  optional: true,
  pushToApiWorker: true,
  validate: (input) => validateApiOrigin(input, 'API_URL'),
  seed: async () => productionApiPublicOrigin(),
});

export const EXPO_PUBLIC_API_URL = new Secret({
  name: 'EXPO_PUBLIC_API_URL',
  hint: 'Client-facing API origin (mirrors API_URL in production)',
  optional: true,
  validate: (input) => validateApiOrigin(input, 'EXPO_PUBLIC_API_URL'),
  seed: async () => productionApiPublicOrigin(),
});

export const LOCAL_PREVIEW_API_ORIGIN = new Secret({
  name: 'LOCAL_PREVIEW_API_ORIGIN',
  hint: 'Local wrangler preview origin (e.g. http://127.0.0.1:8787)',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'LOCAL_PREVIEW_API_ORIGIN');
  },
});

export const EXPO_PUBLIC_COMMIT_HASH = new Secret({
  name: 'EXPO_PUBLIC_COMMIT_HASH',
  hint: 'Git commit hash injected at client build time',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'EXPO_PUBLIC_COMMIT_HASH');
  },
});

export const EXPO_PUBLIC_COMMIT_DATE = new Secret({
  name: 'EXPO_PUBLIC_COMMIT_DATE',
  hint: 'Git commit date injected at client build time',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'EXPO_PUBLIC_COMMIT_DATE');
  },
});
