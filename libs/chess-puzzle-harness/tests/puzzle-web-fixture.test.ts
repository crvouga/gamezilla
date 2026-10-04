import { describe, expect, test } from 'bun:test';
import { HARNESS_CHESS_PUZZLES_WEB_CSV } from '@libs/chess-puzzle-harness/chess-puzzles-web-fixture';

import { parseHarnessChessPuzzleCsv } from '@libs/chess-puzzle-harness/seed-harness-chess-puzzles-web';
import { PuzzleValidationReport } from '@libs/chess-puzzle-server/puzzle-validation-report';

/**
 * §35 validation over the browser-bundled puzzle fixture (the web harness host /
 * `bun run dev` pool). The file fixtures are covered by the `validate:puzzles`
 * script test in `@libs/chess`.
 */
describe('harness web puzzle fixture', () => {
  test('every row passes the §23 validation pass', () => {
    const report = new PuzzleValidationReport();
    const records = parseHarnessChessPuzzleCsv(HARNESS_CHESS_PUZZLES_WEB_CSV);
    for (const record of records) report.add('web-fixture', record);
    const summary = report.summary();
    expect(summary.samples).toEqual([]);
    expect(summary).toMatchObject({ checked: 50, valid: 50, invalid: 0 });
  });
});
