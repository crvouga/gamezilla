import { describe, expect, test } from 'bun:test';
import {
  buildCheckHealPromptBody,
  buildLocalLlmFixPromptMarkdown,
} from './build-llm-fix-prompt';

const SAMPLE_FAILURES = [
  {
    jobId: 'check-verify',
    output: 'error: lint failed in @pkgs/foo',
  },
] as const;

describe('buildLocalLlmFixPromptMarkdown', () => {
  test('includes deployment-pipeline verify hints', () => {
    const md = buildLocalLlmFixPromptMarkdown([...SAMPLE_FAILURES]);
    expect(md).toContain('bun run check');
    expect(md).toContain('`check-verify`');
    expect(md).toContain('error: lint failed in @pkgs/foo');
  });
});

describe('buildCheckHealPromptBody', () => {
  test('includes step ids and bun check verify hints', () => {
    const body = buildCheckHealPromptBody([
      { stepId: 'check-static', output: 'actionlint: syntax error' },
      { stepId: 'check-verify', output: 'turbo: lint failed' },
    ]);
    expect(body).toContain('`bun check`');
    expect(body).toContain('check:heal');
    expect(body).toContain('`check-static`');
    expect(body).toContain('`check-verify`');
    expect(body).toContain('bun run check:static');
    expect(body).toContain('bun run check:api');
    expect(body).toContain('Never patch dependencies');
    expect(body).toContain('actionlint: syntax error');
    expect(body).toContain('turbo: lint failed');
  });

  test('returns empty string when there are no failures', () => {
    expect(buildCheckHealPromptBody([])).toBe('');
  });
});
