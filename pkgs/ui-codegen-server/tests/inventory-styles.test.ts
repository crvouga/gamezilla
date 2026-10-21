import { expect, test } from 'bun:test';
import { readCssRules } from '@pkgs/ui-codegen-server/inventory-styles';

test('rules keep their declarations and the at-rules they sit in', () => {
  const css = `@import "../skin.css";
/* a comment { not a rule } */
@layer components {
  .btn { display: flex; border: 1px solid var(--ui-color-border) }
  .btn[data-size="sm"] { min-height: 32px; }
  @media (prefers-reduced-motion: reduce) {
    .btn { transition: none; }
  }
}
@keyframes spin { from { transform: rotate(0deg); } }`;
  expect(readCssRules('skin.css', css)).toEqual([
    {
      file: 'skin.css',
      context: '@layer components',
      selector: '.btn',
      declarations: [
        'display: flex',
        'border: 1px solid var(--ui-color-border)',
      ],
    },
    {
      file: 'skin.css',
      context: '@layer components',
      selector: '.btn[data-size="sm"]',
      declarations: ['min-height: 32px'],
    },
    {
      file: 'skin.css',
      context: '@layer components › @media (prefers-reduced-motion: reduce)',
      selector: '.btn',
      declarations: ['transition: none'],
    },
    {
      file: 'skin.css',
      context: '@keyframes spin',
      selector: 'from',
      declarations: ['transform: rotate(0deg)'],
    },
  ]);
});
