/**
 * Google `sub`s are 21-digit decimal strings. Derive one from the normalized
 * address so a given account is the same subject on every boot, and so a
 * relying party's tests can name the chooser row for an address they seeded.
 */
export function idpSubOf(email: string): string {
  let hash = 0n;
  for (const char of email.trim().toLowerCase()) {
    hash = (hash * 131n + BigInt(char.codePointAt(0) ?? 0)) % 10n ** 20n;
  }
  return `1${hash.toString().padStart(20, '0')}`;
}
