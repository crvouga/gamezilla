import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { ensureActor } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';

/** The current profile identity, including the guest profile, exactly as the app uses it. */
export async function readCustomGameIdentity(
  s: ProductHarness,
  actor: string
): Promise<string> {
  await ensureActor(s, actor);
  const env = await s.harness.client(actor);
  const person = env.secureStorage.getValue(LAST_LOCAL_ACCOUNT_ID_KEY);
  if (person === null || person === '')
    throw new Error(`${actor} has no current profile identity`);
  return person;
}
