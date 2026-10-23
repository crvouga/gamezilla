import { puzzleContentDecisionLayers } from '@libs/game-puzzle-harness-ts/puzzle-decision-layers';
import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';

bindDecisions({
  spec: 'puzzle-content-access',
  layers: puzzleContentDecisionLayers(),
});
