import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type RequiredPrCheck,
  requiredPrCheckFailures,
  unavailableScannerWarnings,
} from './required-pr-checks';

const directory = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/repository/required-checks'
);
const required = readdirSync(directory).map(
  (name) =>
    JSON.parse(readFileSync(join(directory, name), 'utf8')) as RequiredPrCheck
);
const observed = [
  { name: 'verify:start', appId: 15368 },
  { name: 'verify:end', appId: 15368 },
  { name: 'CodeQL', appId: 57789 },
  { name: 'Analyze (actions)', appId: 15368 },
  { name: 'Analyze (javascript-typescript)', appId: 15368 },
].map((check) => ({ ...check, status: 'completed', conclusion: 'success' }));

// regression: codeql-success-refused-by-required-checks
test('the observed successful GitHub security checks satisfy the required PR policy', () => {
  expect(requiredPrCheckFailures(required, observed, false)).toEqual([]);
});

test('a missing, failed or impersonated CodeQL result still blocks the PR', () => {
  expect(
    requiredPrCheckFailures(
      required,
      observed.filter((check) => check.name !== 'CodeQL'),
      false
    )
  ).toContain('Missing required check: CodeQL (app 57789)');
  expect(
    requiredPrCheckFailures(
      required,
      observed.map((check) =>
        check.name === 'CodeQL' ? { ...check, conclusion: 'failure' } : check
      ),
      false
    )
  ).toContain('Required check did not pass: CodeQL (failure)');
  expect(
    requiredPrCheckFailures(
      required,
      observed.map((check) =>
        check.name === 'CodeQL' ? { ...check, appId: 123 } : check
      ),
      false
    )
  ).toContain(
    'Optional or untrusted check: CodeQL (app 123); declare it in the repository required-checks registry'
  );
});

const withConclusions = (conclusions: Record<string, string>) =>
  observed.map((check) =>
    check.name in conclusions
      ? { ...check, conclusion: conclusions[check.name] ?? null }
      : check
  );

// regression: codeql-bundle-download-504
// PR 347, run 42566395286: Analyze (actions) could not download the CodeQL
// bundle (HTTP 504) and CodeQL reported neutral.
test('a CodeQL scanner that could not run warns instead of blocking', () => {
  const outage = withConclusions({
    'Analyze (actions)': 'failure',
    CodeQL: 'neutral',
  });
  expect(requiredPrCheckFailures(required, outage, false)).toEqual([]);
  expect(unavailableScannerWarnings(required, outage)).toEqual([
    'Analyze (actions) could not run (failure); not blocking',
    'CodeQL could not run (neutral); not blocking',
  ]);
  const noAnalysis = withConclusions({
    'Analyze (actions)': 'failure',
    'Analyze (javascript-typescript)': 'failure',
  }).filter((check) => check.name !== 'CodeQL');
  expect(requiredPrCheckFailures(required, noAnalysis, false)).toEqual([]);
  expect(unavailableScannerWarnings(required, noAnalysis)).toContain(
    'CodeQL reported no results; the scanner did not run'
  );
});

test('CodeQL findings still block even while a scanner is unavailable', () => {
  expect(
    requiredPrCheckFailures(
      required,
      withConclusions({ 'Analyze (actions)': 'failure', CodeQL: 'failure' }),
      false
    )
  ).toContain('Required check did not pass: CodeQL (failure)');
  // An analysis that succeeded uploads results, so CodeQL must still report.
  expect(
    requiredPrCheckFailures(
      required,
      withConclusions({ 'Analyze (actions)': 'failure' }).filter(
        (check) => check.name !== 'CodeQL'
      ),
      false
    )
  ).toContain('Missing required check: CodeQL (app 57789)');
});
