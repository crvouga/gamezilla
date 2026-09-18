import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CHECKLIST_ITEMS,
  REQUIRED_SECTIONS,
  validatePullRequest,
} from './check-pr-body';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const TEMPLATE_PATH = join(REPO_ROOT, '.github', 'pull_request_template.md');
const template = readFileSync(TEMPLATE_PATH, 'utf8');

/** The template as an agent would submit it: every box checked, sections filled. */
function filledTemplate(): string {
  return template
    .replaceAll('- [ ] ', '- [x] ')
    .replaceAll(
      /<!--[\s\S]*?-->/g,
      'Content written for this PR by the author.'
    );
}

const FILLED_TITLE =
  'feat(sync-engine): drain local mutations before disconnect';

describe('PR template contract', () => {
  test('template carries every section and checklist item the gate requires', () => {
    for (const name of REQUIRED_SECTIONS) {
      expect(template).toContain(`## ${name}`);
    }
    for (const item of CHECKLIST_ITEMS) {
      expect(template).toContain(`- [ ] ${item}`);
    }
  });

  test('template as submitted is rejected until every box is checked', () => {
    const violations = validatePullRequest({
      title: FILLED_TITLE,
      body: template,
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('Unchecked item'))).toBe(true);
  });

  test('filled template passes', () => {
    expect(
      validatePullRequest({ title: FILLED_TITLE, body: filledTemplate() })
    ).toEqual([]);
  });

  test('missing section, empty section, and deleted checklist item fail', () => {
    const withoutRisk = filledTemplate().replace(
      /## Risk[\s\S]*?(?=## Provenance)/,
      ''
    );
    expect(
      validatePullRequest({ title: FILLED_TITLE, body: withoutRisk }).some(
        (v) => v.includes('Missing required section: `## Risk`')
      )
    ).toBe(true);

    const emptied = filledTemplate().replace(
      /(## Verification\n)[\s\S]*?(?=## Risk)/,
      '$1\n'
    );
    expect(
      validatePullRequest({ title: FILLED_TITLE, body: emptied }).some((v) =>
        v.includes('Section `## Verification` is empty')
      )
    ).toBe(true);

    const deletedItem = filledTemplate().replace(
      `- [x] ${CHECKLIST_ITEMS[0]}\n`,
      ''
    );
    expect(
      validatePullRequest({ title: FILLED_TITLE, body: deletedItem }).some(
        (v) => v.includes('missing or unchecked')
      )
    ).toBe(true);
  });

  test('non-conventional and overlong titles fail', () => {
    expect(
      validatePullRequest({ title: 'Fix a thing', body: filledTemplate() })
    ).toEqual([
      'PR title must be Conventional Commits: `<type>(<scope>): <summary>` with type feat|fix|refactor|test|chore|docs|perf|ci.',
    ]);

    const longTitle = `fix(scope): ${'x'.repeat(80)}`;
    expect(
      validatePullRequest({ title: longTitle, body: filledTemplate() }).some(
        (v) => v.includes('the limit is 72')
      )
    ).toBe(true);
  });
});
