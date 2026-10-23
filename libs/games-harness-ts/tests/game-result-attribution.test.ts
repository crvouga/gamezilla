/**
 * Every game's run of a shared specification is its own: its test is named
 * for the game (`<scenario> [<game>]`, `<trace> [<game>]`) and its evidence
 * is recorded under the game's id (`scenario:<scenario> [<game id>]`,
 * `trace:<n> [<game id>]`), so no game's result can stand for another's.
 * The names and obligations come from the very functions the runners use.
 */

import { expect, test } from 'bun:test';
import { scenarioObligationId } from '@pkgs/gherkin-server-ts/evidence';
import { runName, runObligation } from '@pkgs/quint-server-ts/trace-runs';
import {
  CONFORMANCE_GAMES,
  conformanceVariants,
  sharedSpecifications,
} from './conformance-world';

const SPECS = sharedSpecifications();
const SCENARIO = 'A scenario every game shares';

/** What a game's run of `uri` is named and recorded as. */
function runsOf(uri: string) {
  return conformanceVariants(uri).map((variant) => ({
    variant,
    scenarioTest: `${SCENARIO} [${variant.label}]`,
    scenarioObligation: scenarioObligationId(SCENARIO, variant.id),
    traceTest: runName('trace 1', { variant }),
    traceObligation: runObligation('trace:1', { variant }),
  }));
}

test('every conformance game has an id and a name of its own', () => {
  const ids = CONFORMANCE_GAMES.map((game) => game.shared.id);
  const labels = CONFORMANCE_GAMES.map((game) => game.label);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(labels).size).toBe(labels.length);
});

test("each game's run of a shared specification is named and recorded for that game", () => {
  for (const uri of SPECS)
    for (const run of runsOf(uri)) {
      const game = CONFORMANCE_GAMES.find(
        (candidate) => candidate.shared.id === run.variant.id
      )!;
      expect(run.variant.label).toBe(game.label);
      expect(run.scenarioObligation).toBe(
        `scenario:${SCENARIO} [${game.shared.id}]`
      );
      expect(run.traceObligation).toBe(`trace:1 [${game.shared.id}]`);
      expect(run.traceTest).toBe(`trace 1 [${game.label}]`);
    }
});

test("no game's verdict can stand for another game's obligation", () => {
  for (const uri of SPECS) {
    const runs = runsOf(uri);
    for (const key of [
      'scenarioTest',
      'scenarioObligation',
      'traceTest',
      'traceObligation',
    ] as const)
      expect(new Set(runs.map((run) => run[key])).size).toBe(runs.length);
    for (const [index, recorded] of runs.entries()) {
      // Evidence recorded by one game's run satisfies no other's.
      const theirs = new Set([
        recorded.scenarioObligation,
        recorded.traceObligation,
      ]);
      for (const other of runs.filter((_, at) => at !== index)) {
        expect(theirs.has(other.scenarioObligation)).toBe(false);
        expect(theirs.has(other.traceObligation)).toBe(false);
      }
      // Nor does it stand for the specification run once, without a game.
      expect(theirs.has(scenarioObligationId(SCENARIO))).toBe(false);
      expect(theirs.has(runObligation('trace:1', {}))).toBe(false);
    }
  }
});

test('a shared specification runs for at least one game, each once', () => {
  for (const uri of SPECS) {
    const ids = conformanceVariants(uri).map((variant) => variant.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  }
});
