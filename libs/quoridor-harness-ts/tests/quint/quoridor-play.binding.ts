import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { moveQuoridorPawn } from '@libs/quoridor-harness-ts/quoridor-actions';
import {
  establishQuoridorModel,
  passQuoridorTurn,
  placeQuoridorModelWall,
  QUORIDOR_ACTORS,
  quoridorModelState,
} from '@libs/quoridor-harness-ts/quoridor-model';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'quoridor-play',
  traces: 4,
  maxSteps: 8,
  timeoutMs: 180_000,
  verifySteps: 2,
  inferPolymorphicTypes: false,
  encoding: 'fun-arrays',
  invariantMode: 'before',
  // regression: quoridor-spatial-proof-expansion
  shortCircuit: true,
  actions: {
    init: (w, picks) =>
      w.s.apply(
        establishQuoridorModel,
        picks['selected'] as 'classic' | 'hill',
        String(picks['beginning'])
      ),
    movePawn: (w, picks) =>
      w.s.apply(
        moveQuoridorPawn,
        QUORIDOR_ACTORS[Number(picks['player'])]!,
        `${String.fromCharCode(97 + (Number(picks['square']) % 9))}${Math.floor(Number(picks['square']) / 9) + 1}`
      ),
    placeWall: (w, picks) =>
      w.s.apply(placeQuoridorModelWall, {
        player: Number(picks['player']),
        column: Number(picks['column']),
        row: Number(picks['row']),
        direction: Number(picks['direction']),
      }),
    passTurn: (w, picks) =>
      w.s.apply(passQuoridorTurn, QUORIDOR_ACTORS[Number(picks['player'])]!),
  },
  observe: (w) => w.s.read(quoridorModelState),
});
