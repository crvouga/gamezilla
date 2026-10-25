import { SOKOBAN_BUILDING_ACTIONS } from './sokoban-building';
import { SOKOBAN_BUILDING_MODEL_ACTIONS } from './sokoban-building-model';
import { SOKOBAN_PLAY_ACTIONS } from './sokoban-play';
import { SOKOBAN_PLAY_MODEL_ACTIONS } from './sokoban-play-model';
import { SOKOBAN_PROOF_ACTIONS } from './sokoban-proof';
import { SOKOBAN_PROOF_MODEL_ACTIONS } from './sokoban-proof-model';
import { SOKOBAN_STARTER_ACTIONS } from './sokoban-starter';

export const SOKOBAN_ACTIONS = [
  ...SOKOBAN_PLAY_ACTIONS,
  ...SOKOBAN_BUILDING_ACTIONS,
  ...SOKOBAN_PROOF_ACTIONS,
  ...SOKOBAN_STARTER_ACTIONS,
  ...SOKOBAN_PLAY_MODEL_ACTIONS,
  ...SOKOBAN_BUILDING_MODEL_ACTIONS,
  ...SOKOBAN_PROOF_MODEL_ACTIONS,
] as const;
