import { expect, test } from 'bun:test';
import { planCodeSuites } from './conformance/game-suite';

test('multi-seat turn history enrolls Hearts without requiring turns from Light Cycles Trio', async () => {
  // regression: multi-seat-history-enrolls-simulations
  const suites = await planCodeSuites(import.meta.dir);
  const history = suites.find(
    (suite) => suite.id === 'conformance/history/multi-seat-history'
  );
  expect(history?.registers?.['hearts']).toBe(true);
  expect(history?.registers?.['light-cycles-3']).toBeUndefined();
});
