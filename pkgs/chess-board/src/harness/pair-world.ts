import type { BoardWorld } from './board-world';
import { createExampleApp } from './example-app';
import { createRecordingAudio } from './recording-audio';

export type PairSide = 'first' | 'second';
export type PairApp = ReturnType<typeof createExampleApp>;
export type PairExample = {
  readonly first: PairApp;
  readonly second: PairApp;
  readonly audio: ReturnType<typeof createRecordingAudio>;
};
const pairs = new WeakMap<BoardWorld, PairExample>();

export function pairOf(w: BoardWorld): PairExample {
  const pair = pairs.get(w);
  if (pair === undefined) throw new Error('No two-board example is mounted');
  return pair;
}
export function currentPair(w: BoardWorld) {
  return pairs.get(w);
}
export function mountPair(w: BoardWorld) {
  const previous = currentPair(w);
  previous?.first.close();
  previous?.second.close();
  w.app.close();
  const audio = createRecordingAudio();
  const first = createExampleApp(
    w.session,
    { animations: false },
    undefined,
    audio
  );
  const second = createExampleApp(
    w.session,
    { animations: false },
    undefined,
    audio
  );
  const pair = { first, second, audio };
  pairs.set(w, pair);
  w.app = first;
  w.auditedMarkups.clear();
  return pair;
}

/** Address a real mounted board and settle its injected asynchronous ports. */
export async function observePairInput(
  w: BoardWorld,
  name: PairSide,
  input: (app: PairApp) => void
) {
  const pair = pairOf(w);
  input(pair[name]);
  await w.session.waitForIdle();
}
