import type { ProductHarness } from '@libs/harness/harness';
import {
  readProfileUsernameShown,
  readUsernameSaveFace,
} from './profile-ui-reads';

const REFUSAL_FACES: Readonly<Record<string, string>> = {
  // regression: username-limits-not-stated
  'it is shorter than 3 characters': 'Username needs at least 3 characters',
  'it is longer than 32 characters': 'Username can have at most 32 characters',
  'it contains characters other than letters, numbers and _':
    'Username can only use letters, numbers, and _',
  'the name is not allowed': 'That username is not allowed',
  'their username was changed recently': 'Username was changed recently',
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
  const editor = await readUsernameSaveFace(s, actorId);
  if (editor !== null) return editor === expected;
  await readProfileUsernameShown(s, actorId);
  return (await readUsernameSaveFace(s, actorId)) === expected;
}
