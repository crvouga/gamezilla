import { expect, test } from 'bun:test';
import {
  establishHearts,
  playHeartsCard,
} from '@libs/hearts-harness-ts/hearts-actions';
import {
  lineAt,
  WEST_LEADS_FOURTH_TABLE,
} from '@libs/hearts-harness-ts/hearts-tables';
import {
  heartsHeard,
  heartsTrickWinnerShown,
  heartsView,
} from '@libs/hearts-harness-ts/hearts-view';
import { openHarness } from './open-hearts-harness';

// regression: hearts-trick-winner-seat-name-mismatch
test('seed 1 identifies Carol in North as the diamond trick winner after South plays JD', async () => {
  await using s = await openHarness('hearts-trick-winner-reading', { seed: 1 });
  await s.apply(establishHearts, {
    line: lineAt(WEST_LEADS_FOURTH_TABLE, 'north and east played'),
  });
  await s.apply(playHeartsCard, 'alice', 'JD');
  const view = await s.read(heartsView, 'alice');
  expect(view.seats.red?.played).toBe('KD');
  expect(view.center).toBe(
    'carol took the trick with the king of diamonds and leads.'
  );
  expect(await s.read(heartsTrickWinnerShown, 'alice', 'red', 'KD')).toBe(true);
  expect(await s.read(heartsHeard, 'alice')).toContain(view.center);
  expect(await s.read(heartsTrickWinnerShown, 'alice', 'black', 'TD')).toBe(
    false
  );
  expect((await s.read(heartsView, 'carol')).center).toBe(
    'You took the trick with the king of diamonds and lead.'
  );
  expect(await s.read(heartsTrickWinnerShown, 'carol', 'red', 'KD')).toBe(true);
  expect(await s.read(heartsHeard, 'carol')).toContain(
    'You took the trick with the king of diamonds and lead.'
  );
  expect(await s.read(heartsTrickWinnerShown, 'carol', 'black', 'TD')).toBe(
    false
  );
}, 60_000);
