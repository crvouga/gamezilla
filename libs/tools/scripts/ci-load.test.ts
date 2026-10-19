import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LEAF_VERIFY_SECONDS,
  loadReport,
  measuredSection,
  NARROW_VERIFY_SECONDS,
  PR_VERIFY_SECONDS,
  RUNNER_VCPU,
  readLoadInput,
  renderMeasuredLoad,
  replaceMeasuredLoad,
  runnerFit,
  SLACK_SECONDS,
  SPEC_WORKER_CAP,
  WARM_START_SECONDS,
} from './ci-load';

const ROOT = join(import.meta.dirname, '../../..');

describe('loadReport', () => {
  test('a dependency cone includes dependents and a leaf stays itself', () => {
    const report = loadReport({
      packages: [
        { name: '@pkgs/root', dependencies: [], tasks: ['test'] },
        {
          name: '@apps/leaf',
          dependencies: ['@pkgs/root'],
          tasks: ['test:spec:0'],
        },
      ],
      costs: {
        '@pkgs/root#test': 10,
        '@apps/leaf#test:spec:0': 20,
        '@old/gone#test': 99,
      },
    });
    expect(report.coldSeconds).toBe(30);
    expect(report.measuredTasks).toBe(2);
    expect(report.staleCostKeys).toBe(1);
    expect(report.cones[0]).toMatchObject({
      name: '@pkgs/root',
      packages: 2,
      seconds: 30,
    });
    expect(report.leaves.map((leaf) => leaf.name)).toEqual(['@apps/leaf']);
    expect(report.leafPoleMax).toBe(20);
  });

  test('an unmeasured script uses the family median, stale samples included', () => {
    const report = loadReport({
      packages: [{ name: '@pkgs/a', dependencies: [], tasks: ['test'] }],
      costs: { '@old/a#test': 4, '@old/b#test': 10 },
    });
    expect(report.estimatedTasks).toBe(1);
    expect(report.coldSeconds).toBe(10);
  });

  test('a measured script keeps its own seconds', () => {
    const report = loadReport({
      packages: [{ name: '@pkgs/a', dependencies: [], tasks: ['test'] }],
      costs: { '@pkgs/a#test': 4, '@old/b#test': 10 },
    });
    expect(report.measuredTasks).toBe(1);
    expect(report.coldSeconds).toBe(4);
  });
});

test('the measured corpus fits the self-hosted runner', () => {
  const report = loadReport(readLoadInput(ROOT));
  expect(report.fit.fits).toBe(true);
  expect(report.fit.specSlots).toBeLessThanOrEqual(SPEC_WORKER_CAP);
  expect(report.fit.cores).toBeLessThanOrEqual(RUNNER_VCPU);
  expect(report.fit.makespanSeconds + WARM_START_SECONDS).toBeLessThanOrEqual(
    PR_VERIFY_SECONDS
  );
  expect(
    report.leafPoleMax + WARM_START_SECONDS + SLACK_SECONDS
  ).toBeLessThanOrEqual(LEAF_VERIFY_SECONDS);
  expect(
    report.leafPoleP90 + WARM_START_SECONDS + SLACK_SECONDS
  ).toBeLessThanOrEqual(NARROW_VERIFY_SECONDS);
});

test('the requirements doc measured section matches the corpus', () => {
  const report = loadReport(readLoadInput(ROOT));
  const doc = readFileSync(join(ROOT, 'docs/CI_REQUIREMENTS.md'), 'utf8');
  expect(measuredSection(doc)).toBe(renderMeasuredLoad(report).trim());
});

test('replaceMeasuredLoad rewrites only the marked section', () => {
  const doc =
    'before\n<!-- ci-load:start -->\nold\n<!-- ci-load:end -->\nafter\n';
  expect(replaceMeasuredLoad(doc, 'new')).toBe(
    'before\n<!-- ci-load:start -->\nnew\n<!-- ci-load:end -->\nafter\n'
  );
});

// regression: ci-capacity-overallocates-spec-workers
test('capacity stays within sixteen workers when they meet the unchanged deadline', () => {
  const load = {
    specSeconds: 3972,
    coldSeconds: 5866,
    poleSeconds: 60,
    leafPoleMax: 60,
    leafPoleP90: 1,
  };
  const fit = runnerFit(load);
  expect(fit).toMatchObject({
    specSlots: 16,
    makespanSeconds: 249,
    fits: true,
  });
  expect(fit.cores).toBeLessThanOrEqual(RUNNER_VCPU);
  expect(
    fit.makespanSeconds + WARM_START_SECONDS + SLACK_SECONDS
  ).toBeLessThanOrEqual(PR_VERIFY_SECONDS);
  expect(
    runnerFit({ ...load, specSeconds: 5000, coldSeconds: 6894 })
  ).toMatchObject({ specSlots: 16, fits: false });
});

// regression: ci-capacity-unused-deadline-slack
test('the existing runner fits the expanded corpus within its unchanged deadline', () => {
  const load = {
    specSeconds: 3972,
    coldSeconds: 7526,
    poleSeconds: 60,
    leafPoleMax: 60,
    leafPoleP90: 1,
  };
  expect(runnerFit(load)).toMatchObject({
    specSlots: 16,
    otherSlots: 14,
    cores: 32,
    makespanSeconds: 254,
    fits: true,
  });
  expect(runnerFit({ ...load, coldSeconds: 7543 }).fits).toBe(false);
});
