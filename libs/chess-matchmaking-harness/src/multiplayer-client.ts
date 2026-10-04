import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import type { ProductHarness } from '@libs/harness/harness';

export async function multiplayerClient(s: ProductHarness, actor: string) {
  const live = await s.harness.spawnClient(actor);
  const env = live.env;
  const owner = env.secureStorage.getValue(LAST_LOCAL_ACCOUNT_ID_KEY);
  if (!owner) throw new Error('Multiplayer actor has no bound identity');
  const engine = live.syncEnginePool.peekReady(
    env.resolveDatabaseName({ userId: owner })
  );
  if (engine === null)
    throw new Error('Multiplayer client engine is not ready');
  return { live, env, owner, engine };
}
