import type { ProductHarness } from '@libs/harness/harness';
import { readUsernameSaveFace } from './profile-ui-reads';

const REFUSAL_FACES: Readonly<Record<string, string>> = {
  'it is too short': 'Username is too short',
  'it is too long': 'Username is too long',
  'it contains characters other than letters, numbers and _':
    'Username can only use letters, numbers, and _',
  'the name is not allowed': 'That username is not allowed',
  'their username was changed recently': 'Username was changed recently',
  'their device is offline': "You're offline",
  'another person already has that name': 'Username is taken',
};

/** The editor explains the specified reason for refusing the saved draft. */
export async function usernameRefusalShown(
  s: ProductHarness,
  actorId: string,
  reason: string
): Promise<boolean> {
  const expected = REFUSAL_FACES[reason];
  if (expected === undefined)
    throw new Error(`unknown username refusal: ${reason}`);
  return (await readUsernameSaveFace(s, actorId)) === expected;
}
