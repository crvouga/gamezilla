import { createDopplerSecretStoreForScripts } from '@pkgs/secret-store';
import { ApiSecretName } from '../src/config/secret-names';

function randomHex32Bytes(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

async function main(): Promise<void> {
  const store = createDopplerSecretStoreForScripts();
  const existing = (
    await store.getOptional(ApiSecretName.betterAuthSecret)
  )?.readSecretValue();
  if (typeof existing === 'string' && existing.trim().length >= 32) {
    process.stdout.write(
      '[setup-better-auth-secret] BETTER_AUTH_SECRET already present in Doppler; skipping.\n'
    );
    return;
  }
  const hex = randomHex32Bytes();
  await store.setSecret(ApiSecretName.betterAuthSecret, hex);
  process.stdout.write(
    '[setup-better-auth-secret] wrote BETTER_AUTH_SECRET to Doppler (≥32 chars).\n'
  );
}

await main();
