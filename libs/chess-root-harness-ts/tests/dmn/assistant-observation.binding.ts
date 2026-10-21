import type { ObservationFacts } from '@libs/chess-puzzle-shared-ts/observation-policy';
import { chooseObservation } from '@libs/chess-puzzle-shared-ts/observation-policy';
import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';

bindDecisions({
  spec: 'assistant-observation',
  layers: {
    'semantic observation': {
      decide: (input) => ({
        observation: chooseObservation({
          status: input['puzzle state'] as ObservationFacts['status'],
          check: input['king is in check'] === 'yes',
          mate: input['checkmate is available'] === 'yes',
          hanging: input['a hanging piece is established'] === 'yes',
          fork: input['a knight fork is established'] === 'yes',
        }),
      }),
    },
  },
});
