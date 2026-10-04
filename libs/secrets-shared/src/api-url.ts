import { requireNonEmpty, Secret } from './secret';
import type { SecretInput } from './secret';

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
  managedBy: 'tofu',
  pushToApiWorker: true,
  validate: (input) => validateApiOrigin(input, 'API_URL'),
});

export const VITE_API_URL = new Secret({
  name: 'VITE_API_URL',
  hint: 'Client-facing API origin (mirrors API_URL)',
  managedBy: 'tofu',
  validate: (input) => validateApiOrigin(input, 'VITE_API_URL'),
});

export const LOCAL_PREVIEW_API_ORIGIN = new Secret({
  name: 'LOCAL_PREVIEW_API_ORIGIN',
  hint: 'Local wrangler preview origin (e.g. http://127.0.0.1:8787)',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'LOCAL_PREVIEW_API_ORIGIN');
  },
});

export const VITE_COMMIT_HASH = new Secret({
  name: 'VITE_COMMIT_HASH',
  hint: 'Git commit hash injected at client build time',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'VITE_COMMIT_HASH');
  },
});

export const VITE_COMMIT_DATE = new Secret({
  name: 'VITE_COMMIT_DATE',
  hint: 'Git commit date injected at client build time',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'VITE_COMMIT_DATE');
  },
});
