import { expect, test } from 'bun:test';
import { compileCssModule } from '@pkgs/bun-test-solid/css-module';
import { assertProperty, fc } from '@pkgs/property';

test('report CSS isolates chess cells from table cells and flush content from markdown', () => {
  // regression: ui-quality-css-module-collision
  const chess = compileCssModule(
    'chess-board.module.css',
    '.cell{position:absolute;width:12.5cqw}'
  );
  const table = compileCssModule(
    'data-table.module.css',
    '.cell:first-child > *{padding-left:12px}'
  );
  const flush = compileCssModule(
    'content-edge-padding.module.css',
    '.content{padding-left:16px}'
  );
  const markdown = compileCssModule(
    'markdown-editor.module.css',
    ':is(.editor,.content) h1{font-size:1.5em}'
  );
  expect(chess.classes['cell']).not.toBe(table.classes['cell']);
  expect(flush.classes['content']).not.toBe(markdown.classes['content']);
  expect(chess.css).toContain(`.${chess.classes['cell']}`);
  expect(table.css).not.toContain(`.${chess.classes['cell']}`);
  expect(markdown.css).not.toContain(`.${flush.classes['content']}`);
});

test('module names are portable across worktrees and retain globals, URLs and animations', () => {
  assertProperty(
    'portable CSS module exports',
    fc.property(fc.integer({ min: 0, max: 255 }), (channel) => {
      const source = `.cell{color:rgb(${channel},0,0);animation:spin 1s;background:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")} .cell :global(.public){display:block} @keyframes spin{to{opacity:0}}`;
      const local = compileCssModule(
        '/worktrees/local/board.module.css',
        source
      );
      const ci = compileCssModule('/home/runner/board.module.css', source);
      expect(local).toEqual(ci);
      expect(local.css).toContain('.public');
      expect(local.css).toContain('data:image/svg+xml,');
      expect(local.css).toContain(local.classes['spin']!);
      expect(local.classes['cell']).not.toBe('cell');
    })
  );
});
