import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  backToTabs,
  openAccount,
  openSettings,
} from '@libs/harness-ts/shell-actions';
import {
  openUserObservatory,
  showOnlyOnlineNow,
  watchLive,
} from '@libs/observatory-actions-harness-ts/user-observatory-actions';
import {
  ALICE_LIST,
  ALICE_WATCH,
  closeLiveApp,
  continueSyntheticActivity,
  deviceOf,
  givenUserObservatory,
  loseLiveConnection,
  observeUserObservatory,
  reopenLiveApp,
  restoreLiveConnection,
  setAliceLiveConnection,
} from '@libs/observatory-harness-ts/user-observatory-model';
import { searchUsername } from '@libs/search-harness-ts/search-actions';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import onlineNowFilterForgotten from './fixtures/online-now-filter-forgotten.itf.json';

/** The game Cedar looks for an opponent in throughout a trace. */
const GAME = 'chess';
/** What Bob searches for in people search: a private detail. */
const SEARCHED = 'carol';
const REMEMBERED = 'observatory:user-observatory';

type Remembered = {
  places: Map<string, string>;
  told: boolean;
  searched: string;
};

function remembered(w: QuintHarnessWorld): Remembered {
  const value = w.memo.get(REMEMBERED) as Remembered | undefined;
  if (value !== undefined) return value;
  const fresh: Remembered = { places: new Map(), told: false, searched: '' };
  w.memo.set(REMEMBERED, fresh);
  return fresh;
}

/** The filter the model's `show` set names. */
function filterOf(show: QuintValue | undefined) {
  const kinds = show instanceof Set ? show : new Set();
  if (kinds.size === 1 && kinds.has('people')) return 'people' as const;
  if (kinds.size === 1 && kinds.has('Synthetic Users'))
    return 'synthetic' as const;
  return 'everyone' as const;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'user-observatory',
  traces: 24,
  maxSteps: 12,
  verifySteps: 3,
  timeoutMs: 240_000,
  regressions: [
    {
      // regression: online-now-filter-forgotten
      id: 'online-now-filter-forgotten',
      title:
        'Alice reopens the User Observatory and still shows only what she chose',
      seed: '0x67932',
      itf: onlineNowFilterForgotten,
    },
  ],
  actions: {
    init: (w) => w.s.apply(givenUserObservatory, GAME),
    openApp: (w, picks) => w.s.apply(reopenLiveApp, String(picks['who'])),
    closeApp: (w, picks) => w.s.apply(closeLiveApp, String(picks['who'])),
    openObservatory: (w) => w.s.apply(openUserObservatory, ALICE_LIST),
    showOnly: (w, picks) =>
      w.s.apply(showOnlyOnlineNow, ALICE_LIST, filterOf(picks['show'])),
    watchLive: (w, picks) =>
      w.s.apply(watchLive, ALICE_WATCH, deviceOf(String(picks['who']))),
    openSettings: (w) => w.s.apply(openSettings, 'bob'),
    searchPeople: async (w) => {
      remembered(w).searched = SEARCHED;
      await w.s.apply(backToTabs, 'bob');
      await w.s.apply(searchUsername, 'bob', SEARCHED);
    },
    continueActivity: (w) => w.s.apply(continueSyntheticActivity, GAME),
    viewSignInMethods: (w) => w.s.apply(openAccount, 'bob'),
    _aliceLosesConnection: (w) => w.s.apply(setAliceLiveConnection, false),
    _aliceComesBackOnline: (w) => w.s.apply(setAliceLiveConnection, true),
    _loseConnection: (w, picks) =>
      w.s.apply(loseLiveConnection, String(picks['who'])),
    _comeBackOnline: (w, picks) =>
      w.s.apply(restoreLiveConnection, String(picks['who'])),
  },
  observe: async (w) => {
    const memory = remembered(w);
    const seen = await w.quiet.read(observeUserObservatory, memory.searched);
    // A closed app keeps the place it was closed in; Alice stays told.
    for (const [who, place] of Object.entries(seen.places))
      memory.places.set(who, place);
    memory.told = memory.told || seen.ended;
    return {
      onlineNow: new Set(seen.onlineNow),
      listShown: new Set(seen.listShown),
      showing: new Set(seen.showing),
      placeOf: new Map(memory.places),
      watching: seen.watching,
      placeShown: seen.placeShown,
      privateDetailsShown: seen.privateDetailsShown,
      watchEndedNotice: memory.told,
      connectionAvailable: seen.connectionAvailable,
    };
  },
});
