import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import {
  changeDesiredSyntheticPopulation,
  givenDesiredSyntheticPopulation,
  grantSyntheticPopulationAccess,
} from '@libs/synthetic-population-harness-ts/observatory-actions';
import {
  observePersonaPopulation,
  reopenSomeSyntheticApp,
} from '@libs/synthetic-population-harness-ts/persona-observations';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'synthetic-user-personas',
  traces: 6,
  maxSteps: 6,
  verifySteps: 4,
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, 'alice');
      await w.s.apply(grantSyntheticPopulationAccess, 'alice', [
        PERMISSION.syntheticPopulationView,
        PERMISSION.syntheticPopulationConfigure,
      ]);
      await w.s.apply(givenDesiredSyntheticPopulation, 0);
    },
    changeDesiredPopulation: (w, picks) =>
      w.s.apply(changeDesiredSyntheticPopulation, 'alice', Number(picks['n'])),
    reopenApp: (w) => w.s.apply(reopenSomeSyntheticApp),
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['who']).toLowerCase()),
    _comeBackOnline: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['who']).toLowerCase()),
  },
  observe: (w) => w.quiet.read(observePersonaPopulation),
});
