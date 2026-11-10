import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  dayBegins,
  dayEnds,
  givenDailyRhythm,
  observeDailyRhythm,
  playsGame,
} from '@libs/synthetic-population-harness-ts/daily-rhythm-model';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

/** A Synthetic User whose device has no connection starts nothing; its worker still holds it. */
const OFFLINE = 'synthetic-population:daily-rhythm-offline';

bindQuintModel<QuintHarnessWorld>({
  model: 'daily-rhythm',
  traces: 6,
  maxSteps: 8,
  verifySteps: 4,
  actions: {
    init: (w, picks) => w.s.apply(givenDailyRhythm, Number(picks['desired'])),
    scheduleBegins: (w, picks) => w.s.apply(dayBegins, String(picks['who'])),
    scheduleEnds: (w, picks) => w.s.apply(dayEnds, String(picks['who'])),
    startNextActivity: (w, picks) =>
      w.s.apply(playsGame, String(picks['who']), true),
    _finishGame: (w, picks) =>
      w.s.apply(playsGame, String(picks['who']), false),
    _loseConnection: async (w, picks) => {
      w.memo.set(OFFLINE, String(picks['who']));
    },
    _comeBackOnline: async (w) => {
      w.memo.delete(OFFLINE);
    },
  },
  observe: (w) => w.quiet.read(observeDailyRhythm),
});
