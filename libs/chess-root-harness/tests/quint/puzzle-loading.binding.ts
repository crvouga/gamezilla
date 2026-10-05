import {
  addHarnessManagedPuzzles,
  readHarnessPuzzleCount,
  readHarnessPuzzleLoad,
  setHarnessPuzzleLoad,
} from '@libs/chess-puzzle-harness/puzzle-load-job-data';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const BASE = 'puzzle-loading:base';
const PERMITTED = 'puzzle-loading:permitted';
const ONLINE = 'puzzle-loading:online';
const STATUS = 'puzzle-loading:status';
const POOL = 'puzzle-loading:pool';
const ADDED = 'puzzle-loading:added';
const BROKEN = 'puzzle-loading:broken';
const ACTUAL_STATUS = 'puzzle-loading:actual-status';

function numberMemo(w: QuintHarnessWorld, key: string): number {
  return Number(w.memo.get(key) ?? 0);
}

function setVisible(
  w: QuintHarnessWorld,
  state: {
    readonly status: string;
    readonly pool: number;
    readonly added: number;
    readonly broken: number;
  }
): void {
  w.memo.set(STATUS, state.status);
  w.memo.set(POOL, state.pool);
  w.memo.set(ADDED, state.added);
  w.memo.set(BROKEN, state.broken);
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-loading',
  traces: 8,
  maxSteps: 12,
  actions: {
    init: async (w, picks) => {
      await w.s.apply(signInWithGoogle, 'alice');
      const base = await w.s.read(readHarnessPuzzleCount);
      w.memo.set(BASE, base);
      w.memo.set(PERMITTED, picks['permitted'] === true);
      w.memo.set(ONLINE, true);
      w.memo.set(ACTUAL_STATUS, 'ready');
      setVisible(w, { status: 'ready', pool: 10, added: 0, broken: 0 });
    },
    addPuzzles: async (w) => {
      const starts =
        w.memo.get(PERMITTED) === true &&
        w.memo.get(ONLINE) === true &&
        w.memo.get(ACTUAL_STATUS) !== 'adding';
      if (starts) {
        await w.s.apply(setHarnessPuzzleLoad, {
          status: 'adding',
          added: 0,
          broken: 0,
          error: null,
        });
        w.memo.set(ACTUAL_STATUS, 'adding');
        setVisible(w, {
          status: 'adding',
          pool: numberMemo(w, POOL),
          added: 0,
          broken: 0,
        });
        return;
      }
      await w.s.read(readHarnessPuzzleLoad);
      if (w.memo.get(ONLINE) === true) {
        w.memo.set(ACTUAL_STATUS, 'refused');
        setVisible(w, {
          status: 'refused',
          pool: numberMemo(w, POOL),
          added: numberMemo(w, ADDED),
          broken: numberMemo(w, BROKEN),
        });
      }
    },
    finishAddingPuzzles: async (w) => {
      await w.s.apply(addHarnessManagedPuzzles);
      await w.s.apply(setHarnessPuzzleLoad, {
        status: 'finished',
        added: 3,
        broken: 2,
        error: null,
      });
      w.memo.set(ACTUAL_STATUS, 'finished');
      if (w.memo.get(ONLINE) === true) {
        setVisible(w, {
          status: 'finished',
          pool: numberMemo(w, POOL) + 3,
          added: 3,
          broken: 2,
        });
      }
    },
    failAddingPuzzles: async (w) => {
      await w.s.apply(setHarnessPuzzleLoad, {
        status: 'failed',
        added: 0,
        broken: 0,
        error: 'load failed',
      });
      w.memo.set(ACTUAL_STATUS, 'failed');
      if (w.memo.get(ONLINE) === true) {
        setVisible(w, {
          status: 'failed',
          pool: numberMemo(w, POOL),
          added: 0,
          broken: 0,
        });
      }
    },
    loseConnection: async (w) => {
      await w.s.apply(partition, 'alice');
      w.memo.set(ONLINE, false);
    },
    comeBackOnline: async (w) => {
      await w.s.apply(restoreActorConnection, 'alice');
      w.memo.set(ONLINE, true);
      const load = await w.s.read(readHarnessPuzzleLoad);
      const pool =
        10 + ((await w.s.read(readHarnessPuzzleCount)) - numberMemo(w, BASE));
      setVisible(w, {
        status: String(w.memo.get(ACTUAL_STATUS) ?? load.status),
        pool,
        added: load.added,
        broken: load.broken,
      });
    },
  },
  observe: async (w) => {
    await w.quiet.read(readHarnessPuzzleLoad);
    return {
      puzzleLoading: {
        status: String(w.memo.get(STATUS)),
        poolSize: numberMemo(w, POOL),
        added: numberMemo(w, ADDED),
        broken: numberMemo(w, BROKEN),
        permitted: w.memo.get(PERMITTED) === true,
      },
      online: w.memo.get(ONLINE) === true,
    };
  },
});
