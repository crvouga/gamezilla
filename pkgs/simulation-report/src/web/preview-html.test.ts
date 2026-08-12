import { describe, expect, test } from 'bun:test';

import { patchPreviewHtml } from './preview-html';

describe('patchPreviewHtml', () => {
  test('strips Google Fonts links and injects font CSS before </head>', () => {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<link rel="preconnect" href="https://fonts.googleapis.com" />',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400&display=swap" />',
      '<style>.rn-root{height:100%}</style>',
      '</head><body>ok</body></html>',
    ].join('');

    const out = patchPreviewHtml(html, '@font-face{font-family:Nunito}');
    expect(out).not.toContain('fonts.googleapis.com');
    expect(out).not.toContain('fonts.gstatic.com');
    expect(out).toContain(
      '<style>@font-face{font-family:Nunito}</style></head>'
    );
    expect(out).toContain('.rn-root{height:100%}');
  });

  test('no-ops font inject when CSS is empty', () => {
    const html =
      '<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X" /></head>';
    const out = patchPreviewHtml(html, '  ');
    expect(out).toBe('<head></head>');
  });
});
