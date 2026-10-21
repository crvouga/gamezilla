/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import {
  AppFrameChromeProvider,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { TopBar } from '@pkgs/ui-root-client-ts/top-bar';
import { TopBarTitle } from '@pkgs/ui-root-client-ts/top-bar-title';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

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

  test('in flow, the title keeps a basis and truncates; trailing items share its row', () => {
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
    expect(row.lastElementChild).toBe(screen.getByText('R'));
    const center = row.children[1];
    if (center === undefined) throw new Error('missing center');
    expect(center.className).toMatch(/\bmin-w-0\b/);
    expect(center.className).toMatch(/\bshrink\b/);
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
