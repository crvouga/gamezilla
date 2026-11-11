import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  commandEverySyntheticUser,
  pauseOneSyntheticUser,
  restartSyntheticUser,
  resumeSyntheticUser,
} from '@libs/synthetic-population-harness-ts/control-panel-actions';
import {
  ALICE_CONTROL,
  finishSyntheticGame,
  givenControlPanels,
  observeControlPanels,
  openControlPanels,
  setAliceConnection,
  startSyntheticGame,
} from '@libs/synthetic-population-harness-ts/control-panel-model';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

import pauseAllTwice from './fixtures/pause-all-twice-confirms-again.itf.json';
import secondGame from './fixtures/second-game-against-same-person.itf.json';

/** The game a Synthetic User starts as its next activity. */
const GAME = 'chess';

bindQuintModel<QuintHarnessWorld>({
  model: 'control-panel',
  regressions: [
    {
      // regression: pause-all-twice-confirms-again
      id: 'pause-all-twice-confirms-again',
      title:
        'Pausing every Synthetic User twice in a row offers the confirmation again.',
      seed: '0x67932',
      itf: pauseAllTwice,
    },
    {
      // regression: second-game-against-same-person
      id: 'second-game-against-same-person',
      title:
        'A Synthetic User starts a second game against the same person after its first one ends.',
      seed: '0x67932',
      itf: secondGame,
    },
  ],
  traces: 8,
  maxSteps: 8,
  verifySteps: 4,
  timeoutMs: 300_000,
  actions: {
    init: (w) => w.s.apply(givenControlPanels),
    openPanel: (w) => w.s.apply(openControlPanels),
    pause: (w, picks) =>
      w.s.apply(pauseOneSyntheticUser, ALICE_CONTROL, String(picks['who'])),
    pauseAll: (w) =>
      w.s.apply(commandEverySyntheticUser, ALICE_CONTROL, 'pause-all'),
    resume: (w, picks) =>
      w.s.apply(resumeSyntheticUser, ALICE_CONTROL, String(picks['who'])),
    resumeAll: (w) =>
      w.s.apply(commandEverySyntheticUser, ALICE_CONTROL, 'resume-all'),
    restart: (w, picks) =>
      w.s.apply(restartSyntheticUser, ALICE_CONTROL, String(picks['who'])),
    startNextActivity: (w, picks) =>
      w.s.apply(startSyntheticGame, String(picks['who']), GAME),
    _finishGame: (w, picks) =>
      w.s.apply(finishSyntheticGame, String(picks['who'])),
    _loseConnection: (w) => w.s.apply(setAliceConnection, false),
    _comeBackOnline: (w) => w.s.apply(setAliceConnection, true),
  },
  observe: async (w) => {
    const seen = await w.quiet.read(observeControlPanels);
    return {
      paused: new Set(seen.paused),
      playing: new Set(seen.playing),
      controlPanelOffered: new Set(seen.controlPanelOffered),
    };
  },
});
