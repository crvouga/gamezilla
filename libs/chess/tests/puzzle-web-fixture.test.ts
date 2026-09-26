import { describe, expect, test } from 'bun:test';

import { PuzzleValidationReport } from '@libs/chess/root/server/validate-chess-puzzles/puzzle-validation-report';

import { parseSimChessPuzzleCsv } from '@libs/chess/sim/seed-sim-chess-puzzles-web';
import { SIM_CHESS_PUZZLES_WEB_CSV } from '@libs/chess/sim/sim-chess-puzzles-web-fixture';

/**
 * §35 validation over the browser-bundled puzzle fixture (the web sim host /
 * `bun run dev` pool). The file fixtures are covered by the `validate:puzzles`
 * script test in `@libs/chess`.
 */
describe('sim web puzzle fixture', () => {
  test('every row passes the §23 validation pass', () => {
    const report = new PuzzleValidationReport();
    const records = parseSimChessPuzzleCsv(SIM_CHESS_PUZZLES_WEB_CSV);
    for (const record of records) report.add('web-fixture', record);
    const summary = report.summary();
    expect(summary.samples).toEqual([]);
    expect(summary).toMatchObject({ checked: 50, valid: 50, invalid: 0 });
  });
});
