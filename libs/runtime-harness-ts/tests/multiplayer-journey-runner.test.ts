import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { packageSpecUnits } from '@libs/harness-ts/replay-plans';
import { partsOf } from '@libs/harness-ts/spec-parts';
import { packageSpecs } from '@libs/harness-ts/spec-sources';
import { parseFeature } from '@pkgs/gherkin-shared-ts/parse';
import { matchStep } from '@pkgs/gherkin-shared-ts/registry';
import { scripts, specParts } from '../package.json';
import './steps/index';

const packageDir = resolve(import.meta.dirname, '..');
const root = resolve(packageDir, '../..');
const uri = 'specs/journeys/multiplayer-game.feature';
const path = resolve(root, uri);

// regression: multiplayer-journey-unbound
test('the ordinary spec suite schedules and binds the three multiplayer journeys', async () => {
  const { scenarios } = parseFeature(await Bun.file(path).text(), uri);
  expect(scenarios.map((scenario) => scenario.name)).toEqual(
    expect.arrayContaining([
      'Two accounts are matched and can finish their multiplayer game',
      'Returning after time away opens the accepted multiplayer game',
      'A guest starts finding an opponent without an account',
    ])
  );

  const units = packageSpecUnits(
    packageDir,
    packageSpecs(packageDir, root),
    specParts
  );
  const scheduled = partsOf(units, specParts).flatMap((part, index) =>
    part
      .filter((unit) => unit.path === path)
      .flatMap(({ slice }) => {
        expect(scripts).toHaveProperty(`test:spec:${index}`);
        return scenarios.filter(
          (_, i) => !slice || i % slice.count === slice.index
        );
      })
  );
  expect(scheduled.map((s) => s.name).sort()).toEqual(
    scenarios.map((s) => s.name).sort()
  );
  for (const scenario of scenarios) {
    expect(scenario.steps.length).toBeGreaterThan(0);
    for (const step of scenario.steps) {
      expect(
        matchStep(step.text),
        `${uri}:${step.line} ${step.text}`
      ).toMatchObject({
        kind: 'match',
        definition: { pending: false },
      });
    }
  }
});
