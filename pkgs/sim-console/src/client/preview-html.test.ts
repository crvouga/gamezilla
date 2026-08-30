import { describe, expect, test } from 'bun:test';

import { applyPreviewIframeSrcdoc } from './apply-preview-iframe-srcdoc';
import { formatMsStable } from './frames';
import { PREVIEW_IN_DOM_SHELL_CSS } from './preview-frame-css';
import {
  isBlankSnapshotBody,
  patchPreviewHtml,
  prepareSnapshotHtml,
} from './preview-html';

describe('applyPreviewIframeSrcdoc', () => {
  test('writes DOM srcdoc property and attribute', () => {
    const attrs = new Map<string, string>();
    const el = {
      srcdoc: '',
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
    };
    applyPreviewIframeSrcdoc(el, '<html>alice</html>');
    expect(el.srcdoc).toBe('<html>alice</html>');
    expect(attrs.get('srcdoc')).toBe('<html>alice</html>');
  });
});

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
  test('PREVIEW_IN_DOM_SHELL_CSS scales with container queries', () => {
    expect(PREVIEW_IN_DOM_SHELL_CSS).toContain('container-type:size');
    expect(PREVIEW_IN_DOM_SHELL_CSS).toContain('100cqw');
    expect(PREVIEW_IN_DOM_SHELL_CSS).toContain('100cqh');
    expect(PREVIEW_IN_DOM_SHELL_CSS).toContain(
      'transform-origin:center center'
    );
    expect(PREVIEW_IN_DOM_SHELL_CSS).toContain('inset:0;margin:auto');
    expect(PREVIEW_IN_DOM_SHELL_CSS).not.toContain('left:0;top:0');
    expect(PREVIEW_IN_DOM_SHELL_CSS).not.toContain('100vw');
  });

  test('prepareSnapshotHtml scopes in-DOM shell to snapshot-host', () => {
    const out = prepareSnapshotHtml(
      '<body><div class="rn-root">ok</div></body>',
      {
        shellCss: PREVIEW_IN_DOM_SHELL_CSS,
      }
    );
    expect(out.styleHtml).toContain('.snapshot-host');
    expect(out.styleHtml).toContain('100cqw');
    expect(out.bodyHtml).toContain('class="rn-root"');
  });

  test('injects shell CSS into preview documents', () => {
    const html = '<body><div class="rn-root">ok</div></body>';
    const out = patchPreviewHtml(html, {
      shellCss: PREVIEW_IN_DOM_SHELL_CSS,
    });
    expect(out).toContain('100cqw');
    expect(out).toContain('class="rn-root"');
  });

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

  test('strips script tags for sandboxed iframe previews', () => {
    const html =
      '<body><script>alert(1)</script><div class="rn-root">ok</div></body>';
    const out = patchPreviewHtml(html);
    expect(out).not.toContain('<script');
    expect(out).toContain('class="rn-root"');
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

  test('strips inline fixed-frame snapshot shell styles before inject', () => {
    const html = [
      '<head><style>html,body{width:390px;height:844px;margin:0}</style></head>',
      '<body><div class="rn-root">ok</div></body>',
    ].join('');
    const out = patchPreviewHtml(html, {
      shellCss: PREVIEW_IN_DOM_SHELL_CSS,
    });
    expect(out).not.toContain('html,body{width:390px;height:844px;margin:0}');
    expect(out).toContain('100cqw');
  });
});

describe('formatMsStable', () => {
  test('pads to a stable width', () => {
    expect(formatMsStable(6).length).toBe(formatMsStable(13350).length);
  });
});
