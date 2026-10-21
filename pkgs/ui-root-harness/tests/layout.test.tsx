/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client/app-frame';
import {
  AppFrameChromeProvider,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client/app-frame-chrome';
import { Island } from '@pkgs/ui-root-client/island';
import { IslandGrid } from '@pkgs/ui-root-client/island-grid';
import { TopBar } from '@pkgs/ui-root-client/top-bar';
import { TopBarTitle } from '@pkgs/ui-root-client/top-bar-title';
import { screen } from '@solidjs/testing-library';
import { cssOf, renderUi } from './render';

describe('layout host classes', () => {
  test('Center / Spacer / Divider / Card class contracts', () => {
    renderUi(() => (
      <>
        <div class="box items-center justify-center" data-testid="c" />
        <div class="box flex-1" data-testid="s" aria-hidden="true" />
        <div class="divider" role="separator" data-testid="d" />
        <div class="card" data-testid="card" />
      </>
    ));
    expect(screen.getByTestId('c').className).toMatch(/items-center/);
    expect(screen.getByTestId('c').className).toMatch(/justify-center/);
    expect(screen.getByTestId('s').className).toMatch(/flex-1/);
    const divider = screen.getByTestId('d');
    expect(divider).toHaveAttribute('role', 'separator');
    expect(divider.className).toMatch(/divider/);
    expect(screen.getByTestId('card').className).toMatch(/card/);
  });
});

describe('Island + IslandGrid', () => {
  test('compact mode is a pass-through stack', () => {
    renderUi(
      () => (
        <IslandGrid columns={2} dataSet={{ testid: 'grid' }}>
          <Island title="Ignored on compact" dataSet={{ testid: 'i' }}>
            <p class="text">{'body'}</p>
          </Island>
        </IslandGrid>
      ),
      { width: 400 }
    );
    expect(cssOf(screen.getByTestId('grid'))).not.toContain('display:grid');
    expect(screen.queryByText('Ignored on compact')).toBeNull();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  test('wide mode renders a CSS grid with spanning titled islands', () => {
    renderUi(
      () => (
        <IslandGrid columns={3} dataSet={{ testid: 'grid' }}>
          <Island
            title="Stats"
            caption="Today"
            span={2}
            dataSet={{ testid: 'i' }}
          >
            <p class="text">{'body'}</p>
          </Island>
        </IslandGrid>
      ),
      { width: 1280 }
    );
    expect(cssOf(screen.getByTestId('grid'))).toContain(
      'grid-template-columns:repeat(3,minmax(0,1fr))'
    );
    const island = screen.getByTestId('i');
    expect(island.tagName).toBe('SECTION');
    expect(cssOf(island)).toContain('grid-column:span2');
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});

describe('TopBar', () => {
  test('slots, safe-area padding, hairline and one row height at every breakpoint', () => {
    renderUi(
      () => (
        <TopBar
          dataSet={{ testid: 'tb' }}
          leading={<p class="text">{'L'}</p>}
          center={<TopBarTitle label="Title" />}
          trailing={<p class="text">{'R'}</p>}
          centerAlign="center"
        />
      ),
      { width: 1280 }
    );
    const bar = screen.getByTestId('tb');
    expect(bar.tagName).toBe('HEADER');
    expect(bar.className).toMatch(/safeTop/);
    expect(bar.className).toMatch(/\bborder-b\b/);
    const row = bar.firstElementChild;
    if (row === null) throw new Error('missing row');
    expect(row.className).toMatch(/\bh-13\b/);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Title'
    );
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  test('flex center/trailing share the row with a trailing max-width cap', () => {
    renderUi(
      () => (
        <TopBar
          dataSet={{ testid: 'tb-flex' }}
          leading={<p class="text">{'L'}</p>}
          center={<TopBarTitle label="A very long navigation title" />}
          trailing={<p class="text">{'R'}</p>}
          centerPosition="flex"
        />
      ),
      { width: 320 }
    );
    const bar = screen.getByTestId('tb-flex');
    const row = bar.firstElementChild;
    if (row === null) throw new Error('missing row');
    const trailing = row.lastElementChild;
    if (trailing === null) throw new Error('missing trailing');
    expect(trailing.className).toMatch(/max-w-1\/2/);
    expect(trailing.className).toMatch(/min-w-0/);
    expect(screen.getByRole('heading', { level: 1 }).className).toMatch(
      /line-clamp-1/
    );
  });
});

describe('AppFrame', () => {
  function Override() {
    useSetAppFrameHeader(<p class="text">{'override header'}</p>);
    return <p class="text">{'screen'}</p>;
  }

  test('wide frame shows the default header, screens can override it', () => {
    renderUi(
      () => (
        <AppFrameChromeProvider>
          <AppFrame header={<p class="text">{'default header'}</p>}>
            <Override />
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      { width: 1280 }
    );
    expect(screen.getByText('override header')).toBeInTheDocument();
    expect(screen.queryByText('default header')).toBeNull();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('data-mode', 'wide');
    const header = main.querySelector('[data-region="header"]');
    const content = main.querySelector('[data-region="content"]');
    expect(header).toHaveTextContent('override header');
    expect(content).toHaveTextContent('screen');
  });

  test('compact frame ignores the header', () => {
    renderUi(
      () => (
        <AppFrame header={<p class="text">{'default header'}</p>}>
          <p class="text">{'screen'}</p>
        </AppFrame>
      ),
      { width: 390 }
    );
    expect(screen.queryByText('default header')).toBeNull();
    expect(screen.getByRole('main')).toHaveAttribute('data-mode', 'compact');
  });

  test('wide frame hosts banner portals outside the max-width column', () => {
    renderUi(
      () => (
        <AppFrame>
          <p class="text" data-testid="body">
            {'body'}
          </p>
        </AppFrame>
      ),
      { width: 1280 }
    );
    const main = screen.getByRole('main');
    const topHost = main.querySelector(
      '[data-component="DismissibleBannerPortalHost"][data-position="top"]'
    );
    const body = screen.getByTestId('body');
    if (topHost === null) throw new Error('missing top banner host');
    expect(topHost.compareDocumentPosition(body)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    const column = body.closest('[data-region="column"]');
    expect(column).not.toBeNull();
    expect(column?.contains(topHost)).toBe(false);
  });
});
