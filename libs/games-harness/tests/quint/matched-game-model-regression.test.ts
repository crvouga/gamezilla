// @io-wall-ok — checks a literal history of the canonical reference model.
import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simulate } from '@pkgs/quint-server/simulate';
import type { QuintValue } from '@pkgs/quint-shared/itf';

// regression: chess-model-deleted-game-access
test('Alice loses her private matched game after deleting her account while Bob keeps it', () => {
  const root = join(import.meta.dir, '../../../..');
  const source = readFileSync(
    join(root, 'specs/games/matched-game.qnt'),
    'utf8'
  );
  const dir = mkdtempSync(join(tmpdir(), 'deleted-game-model-'));
  try {
    writeFileSync(
      join(dir, 'events.qnt'),
      readFileSync(join(root, 'specs/matchmaking/events.qnt'), 'utf8')
    );
    const prepared = source
      .replace(
        'module matched_game {',
        'module deletion_regression {\n  var _regressionStep: int'
      )
      .replace('from "../matchmaking/events"', 'from "./events"')
      .replace(
        'action init = all {',
        "action init = all {\n    _regressionStep' = 0,"
      )
      .replace(
        /  action step = \{[\s\S]*?\n  \}\n\n  \/\/\//,
        `  action step = all {
    _regressionStep < 4,
    _regressionStep' = _regressionStep + 1,
    if (_regressionStep == 0) seekOpponent({ person: "alice", place: "phone" }, "3+2")
    else if (_regressionStep == 1) seekOpponent({ person: "bob", place: "phone" }, "3+2")
    else if (_regressionStep == 2) pairPeopleUp(1, "alice", "bob")
    else deleteAccount("alice"),
  }

  ///`
      );
    const path = join(dir, 'deletion-regression.qnt');
    writeFileSync(path, prepared);
    const drawn = simulate({
      specPath: path,
      traces: 1,
      maxSteps: 4,
      outDir: join(dir, 'trace'),
    });
    const last = drawn.traces[0]!.states.at(-1)!;
    expect(drawn.traces[0]!.states).toHaveLength(5);
    const numbers = last.vars['playNumber'] as ReadonlyMap<
      QuintValue,
      QuintValue
    >;
    for (const [device, number] of numbers) {
      const person = (device as { person: string }).person;
      if (person === 'alice') expect(number).toBe(0);
      if (person === 'bob') expect(number).toBe(1);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120_000);
