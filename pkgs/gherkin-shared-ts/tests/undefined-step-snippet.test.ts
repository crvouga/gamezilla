import { expect, test } from 'bun:test';
import { undefinedStepSnippet } from '@pkgs/gherkin-shared-ts/failure';

/**
 * The string the pasted snippet's first argument evaluates to: a single-quoted
 * literal whose only escapes are `\\` and `\'` (each escape yields the
 * character after the backslash). Null when the literal never closes, as
 * when a quote is left unescaped.
 */
function pastedText(snippet: string): string | null {
  const start = snippet.indexOf("('");
  if (start < 0) return null;
  let text = '';
  for (let i = start + 2; i < snippet.length; i += 1) {
    const char = snippet[i];
    if (char === "'") return snippet.slice(i, i + 2) === "'," ? text : null;
    if (char === '\\') {
      i += 1;
      text += snippet[i] ?? '';
    } else text += char;
  }
  return null;
}

// regression: undefined-step-snippet-backslash
test('a pasted snippet registers exactly the undefined step text', () => {
  // CodeQL js/incomplete-sanitization: quotes were escaped but backslashes
  // were not, so `a \' b` produced a different (or unparseable) literal.
  for (const text of [
    'a person opens the app',
    "the person's profile",
    'a path like C:\\Users\\x',
    'a trailing backslash \\',
    "both \\' kinds",
  ]) {
    const snippet = undefinedStepSnippet('Given', text);
    expect(snippet.startsWith('Given(')).toBe(true);
    expect(pastedText(snippet)).toBe(text);
  }
});
