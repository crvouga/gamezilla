import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type {
  GameRecordMetadata,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import fc from 'fast-check';
import type { GameLaw } from './game-rules-laws';
import { law, must } from './game-rules-laws';
import type { HarnessGame } from './harness-game';

/** Continuous and hybrid endings come from independently authored expected positions. */
export function simulationEndingReasons(game: HarnessGame): readonly string[] {
  const simulation = game.shared.registration.simulation;
  if (simulation === undefined) return [];
  must(
    game.simulationFixtures !== undefined,
    'simulation examples are missing'
  );
  return game.simulationFixtures!.examples.flatMap((example) => {
    const state = simulation.codec.decode(example.expectedPosition);
    must(state !== null, 'a simulation expected position cannot be decoded');
    const result = simulation.result(state);
    if (result === null) return [];
    must(result.reason.trim() !== '', 'a simulation ending has no reason');
    return [result.reason];
  });
}

/** A live result record names its real participants and result, without inventing turn history. */
export function simulationRecordLaws(game: HarnessGame): readonly GameLaw[] {
  if (game.shared.registration.simulation === undefined) return [];
  const history = game.shared.capabilities.history;
  const read = game.readRecord;
  if (history === undefined || read === undefined) return [];
  const examples = game.simulationFixtures?.examples;
  must(
    examples !== undefined && examples.length > 0,
    'simulation record examples are missing'
  );
  const name = fc.stringMatching(/^[a-z][a-z0-9]{2,11}$/);
  return [
    law(
      game,
      'a live result record preserves its people and outcome without a fabricated clock',
      () => {
        assertProperty(
          `${game.label}: live result record`,
          fc.property(
            fc.tuple(name, name).filter(([first, second]) => first !== second),
            fc.constantFrom<GameSide | 'draw'>('white', 'black', 'draw'),
            fc.constantFrom(...examples!),
            ([first, second], outcome, example) => {
              const metadata: GameRecordMetadata = {
                participants: [
                  { name: first, rating: null },
                  { name: second, rating: null },
                ],
                outcome,
                reason: outcome === 'draw' ? 'agreement' : 'resignation',
                timeControl: null,
              };
              const record = read(
                history.record(example.initialPosition, '', metadata)
              );
              must(
                record.firstSide === first && record.secondSide === second,
                'the live record changes its participants'
              );
              must(
                record.result === outcome,
                'the live record changes its result'
              );
              must(
                record.clockChoice === null,
                'the live record invents a clock'
              );
            }
          )
        );
      }
    ),
  ];
}
