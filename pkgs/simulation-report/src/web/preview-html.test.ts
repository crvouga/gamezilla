import { describe, expect, test } from 'bun:test';
import { formatMsStable } from './frames';
import { durationHeat } from './heat';
import {
  isBlankSnapshotBody,
  patchPreviewHtml,
  prepareSnapshotHtml,
} from './preview-html';

describe('isBlankSnapshotBody', () => {
  test('treats whitespace-only bodies as blank', () => {
    expect(isBlankSnapshotBody('   ')).toBe(true);
    expect(isBlankSnapshotBody('<div class="rn-root"></div>')).toBe(true);
    expect(
      isBlankSnapshotBody('<div class="rn-root"><span>&nbsp;</span></div>')
    ).toBe(true);
  });

  test('treats tiny shell with no real copy as blank', () => {
    const shell = `<div class="rn-root">${'<div></div>'.repeat(50)}</div>`;
    expect(shell.length).toBeLessThan(4000);
    expect(isBlankSnapshotBody(shell)).toBe(true);
  });

  test('keeps contentful bodies', () => {
    expect(
      isBlankSnapshotBody(
        '<div class="rn-root"><span>Sign in with email</span></div>'
      )
    ).toBe(false);
  });
});

describe('prepareSnapshotHtml', () => {
  test('extracts body and strips font + shell links', () => {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<link rel="stylesheet" href="../../snapshot-shell.css" />',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X" />',
      '</head><body><div class="rn-root">hi</div></body></html>',
    ].join('');
    const out = prepareSnapshotHtml(html, {
      shellCss: 'html,body,.rn-root{height:100%}',
      fontCss: '@font-face{font-family:Nunito}',
    });
    expect(out.bodyHtml).toContain('class="rn-root"');
    expect(out.bodyHtml).not.toContain('snapshot-shell');
    expect(out.styleHtml).toContain('.snapshot-host');
    expect(out.styleHtml).toContain('@font-face{font-family:Nunito}');
    expect(out.styleHtml).not.toContain('html,body,.rn-root{');
  });
});

describe('patchPreviewHtml', () => {
  test('strips Google Fonts links and injects font CSS', () => {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<link rel="preconnect" href="https://fonts.googleapis.com" />',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400&display=swap" />',
      '</head><body>ok</body></html>',
    ].join('');
    const out = patchPreviewHtml(html, '@font-face{font-family:Nunito}');
    expect(out).not.toContain('fonts.googleapis.com');
    expect(out).toContain('@font-face{font-family:Nunito}');
    expect(out).toContain('<body>ok</body>');
  });

  test('strips snapshot-shell.css and injects shell + font CSS', () => {
    const html = [
      '<head>',
      '<link rel="stylesheet" href="../../snapshot-shell.css" />',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X" />',
      '</head><body>x</body>',
    ].join('');
    const out = patchPreviewHtml(html, {
      shellCss: 'html{height:100%}',
      fontCss: '@font-face{font-family:Nunito}',
    });
    expect(out).not.toContain('snapshot-shell.css');
    expect(out).toContain('html{height:100%}');
    expect(out).toContain('@font-face{font-family:Nunito}');
    expect(out).not.toContain('.snapshot-host');
  });
});

describe('durationHeat', () => {
  test('keeps sub-100ms flat cool; warms near 1s; hot by a few seconds', () => {
    const instant = durationHeat(0);
    const fast = durationHeat(13);
    const stillCool = durationHeat(100);
    const warm = durationHeat(1000);
    const hot = durationHeat(3000);
    expect(instant.t).toBe(0);
    expect(fast.t).toBe(0);
    expect(stillCool.t).toBe(0);
    expect(warm.t).toBeGreaterThan(0.4);
    expect(hot.t).toBe(1);
    expect(fast.cssColor).toBe(instant.cssColor);
    expect(hot.cssColor).toContain('hsl(');
  });

  test('does not scale relative to other frames', () => {
    // Fast steps stay cool even when they are the slowest in a tiny suite.
    expect(durationHeat(13).t).toBe(0);
  });
});

describe('formatMsStable', () => {
  test('pads to a stable width', () => {
    expect(formatMsStable(6).length).toBe(formatMsStable(13350).length);
  });
});
