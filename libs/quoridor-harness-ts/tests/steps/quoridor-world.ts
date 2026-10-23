import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  establishQuoridor,
  type QuoridorSetup,
  quoridorView,
} from '@libs/quoridor-harness-ts/quoridor-actions';

export type QuoridorWorld = Pick<HarnessWorld, 's' | 'memo'>;
export async function setupQuoridor(
  w: QuoridorWorld,
  options: QuoridorSetup = {}
) {
  await w.s.apply(establishQuoridor, options);
  w.memo.set('quoridor-before', await w.s.read(quoridorView));
}
export function viewQuoridor(w: QuoridorWorld, actor = 'alice') {
  return w.s.read(quoridorView, actor);
}
