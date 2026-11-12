import { ensureActor } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { deviceMemberIdOf } from '@libs/harness-ts/identity';

/** The current profile identity, including the guest profile, exactly as the app uses it. */
export async function readCustomGameIdentity(
  s: ProductHarness,
  actor: string
): Promise<string> {
  await ensureActor(s, actor);
  const person = await deviceMemberIdOf(s, actor);
  if (person === null || person === '')
    throw new Error(`${actor} has no current profile identity`);
  return person;
}
