import { describe, expect, test } from 'bun:test';
import {
  AGENT_BRIEFING,
  CRITICAL_JOURNEYS,
  matrixRows,
  PRODUCT_CATALOG,
  READINESS_DOC,
  scenarioTitles,
  validateReadiness,
} from '../goal/self-service-readiness';

const DOC = `# Self-service readiness

## Readiness matrix

| Journey | Expected outcome | Evidence |
| --- | --- | --- |
| Open the app | Lands on the tabs | journey "The app opens"; \`specs/runtime/open.feature\` (\`open-bug-one\`) |

## Indicators

| Not | a matrix row | \`specs/missing/elsewhere.feature\` |
`;

const JOURNEYS = `Feature: Critical journeys
  Rule: They work
    Scenario: The app opens
      Then it opens
`;

function inputs(files: Record<string, string>, bugs: readonly string[]) {
  return {
    read: (path: string) => files[path] ?? null,
    exists: (path: string) => path in files,
    knownBugIds: new Set(bugs),
  };
}

const VALID = {
  [READINESS_DOC]: DOC,
  [CRITICAL_JOURNEYS]: JOURNEYS,
  [AGENT_BRIEFING]: `Follow ${READINESS_DOC}.`,
  [PRODUCT_CATALOG]: 'msgid "Try again"\nmsgstr ""\n',
  'specs/runtime/open.feature': 'Feature: open',
};

// The repository itself is held to this gate by `@libs/tools-harness-ts#ci:goals`
// (`verify-goals.ts`), whose inputs include the readiness document.
describe('self-service readiness gate', () => {
  test('a matrix that matches the repository passes', () => {
    expect(validateReadiness(inputs(VALID, ['open-bug-one']))).toEqual([]);
  });

  test('only rows of the readiness matrix are checked', () => {
    expect(matrixRows(DOC)).toHaveLength(1);
  });

  test('a cited path that is gone fails', () => {
    const { 'specs/runtime/open.feature': _gone, ...files } = VALID;
    expect(validateReadiness(inputs(files, ['open-bug-one']))).toEqual([
      `${READINESS_DOC} cites a missing path: specs/runtime/open.feature`,
    ]);
  });

  test('a bug id that is not registered fails', () => {
    expect(validateReadiness(inputs(VALID, []))).toEqual([
      `${READINESS_DOC} names an unregistered bug: open-bug-one`,
    ]);
  });

  test('a critical journey without a row fails', () => {
    const files = {
      ...VALID,
      [CRITICAL_JOURNEYS]: `${JOURNEYS}    Scenario: A person signs out\n`,
    };
    expect(validateReadiness(inputs(files, ['open-bug-one']))).toEqual([
      `${READINESS_DOC} has no row for the journey "A person signs out"`,
    ]);
  });

  test('the agent briefing must point at the standard', () => {
    const files = { ...VALID, [AGENT_BRIEFING]: 'No link here.' };
    expect(validateReadiness(inputs(files, ['open-bug-one']))).toEqual([
      `${AGENT_BRIEFING} does not link ${READINESS_DOC}`,
    ]);
  });

  test('product copy that sends a person to support fails', () => {
    const files = {
      ...VALID,
      [PRODUCT_CATALOG]: 'msgid "Something broke. Contact support."\n',
    };
    expect(validateReadiness(inputs(files, ['open-bug-one']))).toEqual([
      'product copy depends on a support desk: msgid "Something broke. Contact support."',
    ]);
  });

  test('scenario titles are read from the journeys feature', () => {
    expect(scenarioTitles(JOURNEYS)).toEqual(['The app opens']);
  });
});
