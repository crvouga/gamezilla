/** Real account-shaped identities let the reference app mount the production identity hooks. */
export function contentActorId(name: string): string {
  if (name === 'alice') return '00000000-0000-4000-8000-000000000a11';
  if (name === 'bob') return '00000000-0000-4000-8000-000000000b0b';
  throw new Error(`Unknown reference person: ${name}`);
}
