import type { ConnectFourSetup } from '@libs/connect-four-harness/connect-four-actions';
import {
  connectFourView,
  establishConnectFour,
} from '@libs/connect-four-harness/connect-four-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';

export type FourWorld = Pick<HarnessWorld, 's' | 'memo'>;

export async function setupFour(
  w: FourWorld,
  options: ConnectFourSetup = {}
): Promise<void> {
  await w.s.apply(establishConnectFour, options);
  w.memo.set('connect-four-before', await w.s.read(connectFourView));
}

export async function four(w: FourWorld, actor = 'alice') {
  return w.s.read(connectFourView, actor);
}
