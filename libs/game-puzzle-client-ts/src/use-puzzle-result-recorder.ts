import type { PuzzleOutcomeKind } from '@libs/game-puzzle-shared-ts/interaction-entities';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import {
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';

/** Reconcile a decided result after restore, including an interrupted rating write. */
export function usePuzzleResultRecorder(args: {
  readonly recorder: {
    readonly puzzleId: Accessor<string>;
    readonly interactionsReady: Accessor<boolean>;
    readonly canRecord: Accessor<boolean>;
    readonly result: Accessor<{
      readonly owner: string | null;
      readonly attempt: string | null;
      readonly outcome: PuzzleOutcomeKind | null;
      readonly score: number | null;
    }>;
  };
  readonly myId: Accessor<string>;
  readonly finalize: (
    kind: PuzzleOutcomeKind,
    score: 0 | 500 | 1000
  ) => Promise<void>;
  readonly reportFailure: (error: unknown) => void;
}): () => void {
  const timers = useTimers();
  const [revision, revise] = createSignal(0);
  const finished = new Set<string>();
  const writing = new Set<string>();
  let retry: unknown = null;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    if (retry !== null) timers.clearTimeout(retry);
  });
  type Decided = {
    readonly key: string;
    readonly outcome: PuzzleOutcomeKind;
    readonly score: 0 | 500 | 1000;
  };
  /** The decided result this member is to record, if there is one. */
  const decided = (): Decided | null => {
    const r = args.recorder;
    const result = r.result();
    const key = result.attempt;
    const score = result.score;
    if (score !== 0 && score !== 500 && score !== 1000) return null;
    if (
      key === null ||
      result.owner !== args.myId() ||
      !r.canRecord() ||
      !r.interactionsReady() ||
      result.outcome === null
    )
      return null;
    return { key, outcome: result.outcome, score };
  };
  const write = ({ key, outcome, score }: Decided): void => {
    if (finished.has(key) || writing.has(key)) return;
    writing.add(key);
    void args
      .finalize(outcome, score)
      .then(() => {
        finished.add(key);
      })
      .catch((error: unknown) => {
        args.reportFailure(error);
        if (!disposed)
          retry = timers.setTimeout(() => {
            retry = null;
            revise((n) => n + 1);
          }, 1_000);
      })
      .finally(() => {
        writing.delete(key);
      });
  };
  createEffect(
    () => {
      void revision();
      return decided();
    },
    (result) => {
      if (result !== null) untrack(() => write(result));
    }
  );
  return () => {
    const result = decided();
    if (result !== null) write(result);
  };
}
