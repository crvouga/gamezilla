import { describe, expect, test } from 'bun:test';
import { designVocabularyViolations } from './design-vocabulary';

function hits(text: string, path = 'src/screen.tsx'): readonly string[] {
  return designVocabularyViolations([{ path, text }]);
}

describe('designVocabularyViolations', () => {
  // regression: game-ui-status-type-role
  test('game status uses the shared caption role', () => {
    expect(
      hits('<p class="text-sm text-text-secondary" role="status" />').some(
        (violation) => violation.includes('ad-hoc type "text-sm"')
      )
    ).toBe(true);
    expect(
      hits('<p class="text textCaption text-text-secondary" role="status" />')
    ).toEqual([]);
  });

  test('a violation names the role to use instead', () => {
    const out = hits('<p class="text text-xs" />');
    expect(out).toEqual([
      'src/screen.tsx:1: ad-hoc type "text-xs" — use a type role from hosts.css (`text textTitle | textHeading | textSubtitle | textBody | textBodyBold | textLabel | textCaption | textFootnote`, plus `textNumeral` for numbers)',
    ]);
  });

  test('token var references and text-color tokens are allowed', () => {
    expect(
      hits(
        "style={{ 'border-color': 'var(--ui-color-tint)' }} class=\"text-tint text-destructive\""
      )
    ).toEqual([]);
  });
});
