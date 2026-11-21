import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type RequiredPrCheck,
  requiredPrCheckFailures,
} from './required-pr-checks';

const directory = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/repository/required-checks'
);
const required = readdirSync(directory).map(
  (name) =>
    JSON.parse(readFileSync(join(directory, name), 'utf8')) as RequiredPrCheck
);
const check = (name: string, appId = 15368) => ({
  name,
  appId,
  status: 'completed',
  conclusion: 'success',
});
const passed = [check('verify:start'), check('CodeQL', 57789)];
const languages = ['c-cpp', 'python', 'swift'];

// regression: transferred-repository-codeql-languages-undeclared
// PR431, run44868208652 reported all three producers successfully.
test('the observed additional CodeQL languages are explicitly trusted', () => {
  expect(
    requiredPrCheckFailures(
      required,
      [
        ...passed,
        ...languages.map((language) => check(`Analyze (${language})`)),
      ],
      false
    )
  ).toEqual([]);
  for (const language of languages) {
    expect(required).toContainEqual({
      context: `Analyze (${language})`,
      integration_id: 15368,
      outage_tolerant: true,
    });
  }
});

test('new language declarations do not trust impersonators or arbitrary analysis jobs', () => {
  for (const untrusted of [
    ...languages.map((language) => check(`Analyze (${language})`, 123)),
    check('Analyze (unknown)'),
  ]) {
    expect(
      requiredPrCheckFailures(required, [...passed, untrusted], false)
    ).toContain(
      `Optional or untrusted check: ${untrusted.name} (app ${untrusted.appId}); declare it in the repository required-checks registry`
    );
  }
});

test('new analysis declarations never waive failed or missing CodeQL results', () => {
  const analyses = languages.map((language) => check(`Analyze (${language})`));
  expect(
    requiredPrCheckFailures(
      required,
      [check('verify:start'), ...analyses],
      false
    )
  ).toContain('Missing required check: CodeQL (app 57789)');
  expect(
    requiredPrCheckFailures(
      required,
      [
        check('verify:start'),
        ...analyses,
        { ...check('CodeQL', 57789), conclusion: 'failure' },
      ],
      false
    )
  ).toContain('Required check did not pass: CodeQL (failure)');
});
