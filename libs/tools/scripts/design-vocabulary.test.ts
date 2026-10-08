import { describe, expect, test } from 'bun:test';
import { designVocabularyViolations } from './design-vocabulary';

function hits(text: string, path = 'src/screen.tsx'): readonly string[] {
  return designVocabularyViolations([{ path, text }]);
}

describe('designVocabularyViolations', () => {
  test('type roles and layout utilities are the vocabulary', () => {
    expect(
      hits(
        '<p class="text textCaption text-text-secondary flex-row gap-3 p-4" />'
      )
    ).toEqual([]);
    expect(hits('<p class="text textHeading textNumeral" />')).toEqual([]);
  });

  test('ad-hoc type is reported with the role to use instead', () => {
    const out = hits('<p class="text text-xs font-semibold" />');
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('src/screen.tsx:1: ad-hoc type "text-xs"');
    expect(out[0]).toContain('textCaption');
    expect(hits("classList={{ 'uppercase tracking-wide': on }}")).toHaveLength(
      2
    );
  });

  test('shadows, arbitrary values and raw colors are reported', () => {
    expect(hits('<div class="box shadow-sm" />')).toHaveLength(1);
    expect(hits('<div class="box w-[37px]" />')).toHaveLength(1);
    expect(hits("style={{ color: '#ff0000' }}")).toHaveLength(1);
    expect(hits("const fill = 'hsla(0, 0%, 0%, 1)';")).toHaveLength(1);
  });

  test('comments, tests and non-UI files are not read', () => {
    expect(hits('// no "text-xs" here')).toEqual([]);
    expect(hits(' * prefer "shadow" never')).toEqual([]);
    expect(hits('<p class="text-xs" />', 'tests/screen.tsx')).toEqual([]);
    expect(hits("const c = 'text-xs';", 'src/logic.ts')).toEqual([]);
  });

  test('token var references and text-color tokens are allowed', () => {
    expect(
      hits(
        "style={{ 'border-color': 'var(--ui-color-tint)' }} class=\"text-tint text-destructive\""
      )
    ).toEqual([]);
  });
});
