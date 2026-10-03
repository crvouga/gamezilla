import {
  chooseObservation,
  type ObservationFacts,
} from '@libs/chess/public/puzzle-commentary';
import { bindDecisions } from '@pkgs/dmn/registry';

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
