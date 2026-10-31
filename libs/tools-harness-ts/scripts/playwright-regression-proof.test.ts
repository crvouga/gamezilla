import { describe, expect, test } from 'bun:test';
import { validateGoalGate } from '../goal/goal-manifest';

function check(
  body: string,
  regressionTest = 'pkgs/ui-root-harness-ts/tests/storybook/integration.checks.ts'
) {
  return validateGoalGate({
    knownBugs: [
      {
        id: 'controls',
        summary: 'A text control must update the real preview.',
        regressionTest,
      },
    ],
    proofFiles: { owns: () => true, read: () => body },
  });
}

describe('Playwright regression proofs', () => {
  // regression: known-bug-playwright-check-proof
  test('accepts a marked executable adapter test without exposing it to Bun discovery', () => {
    expect(
      check(`import { test, expect } from '@playwright/test';
// regression: controls
test('a plain label updates the preview', async ({ page }) => {
  await page.locator('#control-title').fill('Publish puzzle');
  await expect(page.getByRole('button', { name: 'Publish puzzle' })).toBeVisible();
});`)
    ).toEqual([]);
  });

  test('accepts an imported test alias', () => {
    expect(
      check(`import { test as browserTest } from '@playwright/test';
// regression: controls
browserTest('text control', async ({ page }) => { await page.goto('/'); });`)
    ).toEqual([]);
  });

  test('rejects inert files and foreign or type-only runners', () => {
    for (const body of [
      '// regression: controls\nexport const example = true;',
      "import type { test } from '@playwright/test';\n// regression: controls\ntest('x', async () => {});",
      "import { test } from 'bun:test';\n// regression: controls\ntest('x', async () => {});",
    ])
      expect(check(body).join('\n')).toContain('literal Playwright test');
  });

  test('rejects disabled tests and markers attached to unrelated code', () => {
    for (const call of [
      "test.skip('x', async () => {});",
      "const example = true;\ntest('x', async () => {});",
      "function example() { test('x', async () => {}); }",
    ])
      expect(
        check(`import { test } from '@playwright/test';
// regression: controls
${call}`).join('\n')
      ).toContain('literal Playwright test');
  });
});

test('Playwright regression proofs reject property-based check files', () => {
  expect(
    check('// regression: controls', 'browser.property.checks.ts').join('\n')
  ).toContain('is a property test');
});
