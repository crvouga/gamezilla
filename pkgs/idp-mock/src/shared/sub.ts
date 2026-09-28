import type { IdpProviderKind } from './types';

function hashOf(input: string, modulus: bigint): bigint {
  let hash = 0n;
  for (const char of input.trim().toLowerCase()) {
    hash = (hash * 131n + BigInt(char.codePointAt(0) ?? 0)) % modulus;
  }
  return hash;
}

/**
 * Google `sub`s are 21-digit decimal strings. Derive one from the normalized
 * address so a given account is the same subject on every boot, and so a
 * relying party's tests can name the chooser row for an address they seeded.
 */
export function idpSubOf(email: string): string {
  return `1${hashOf(email, 10n ** 20n)
    .toString()
    .padStart(20, '0')}`;
}

/**
 * Apple `sub`s look like `001234.0123456789abcdef0123456789abcdef.1234`: a
 * six-digit prefix, 32 hex digits, a four-digit suffix. Relying parties that
 * assume Google's all-digit shape break on these, which is the point.
 */
export function appleSubOf(email: string): string {
  const prefix = hashOf(`p:${email}`, 1_000_000n).toString().padStart(6, '0');
  const body = hashOf(`b:${email}`, 16n ** 32n)
    .toString(16)
    .padStart(32, '0');
  const suffix = hashOf(`s:${email}`, 10_000n).toString().padStart(4, '0');
  return `${prefix}.${body}.${suffix}`;
}

/** The subject a directory entry gets on the given provider. */
export function subOfProvider(
  provider: IdpProviderKind,
  email: string
): string {
  return provider === 'apple' ? appleSubOf(email) : idpSubOf(email);
}
