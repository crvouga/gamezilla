/** @jsxImportSource solid-js */
import {
  AppFrame,
  AppFrameChromeProvider,
  Card,
  Center,
  Divider,
  Island,
  IslandGrid,
  NavRail,
  Spacer,
  Text,
  TopBar,
  TopBarTitle,
  useSetAppFrameHeader,
} from '@pkgs/ui';
import { screen } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';
import { cssOf, renderUi } from './support/render';

describe('layout primitives', () => {
  test('Center / Spacer / Divider / Card compile expected declarations', () => {
    renderUi(() => (
      <>
        <Center data-testid="c" />
        <Spacer dataSet={{ testid: 's' }} />
        <Divider data-testid="d" orientation="vertical" />
        <Card data-testid="card" elevation={2} />
      </>
    ));
    expect(cssOf(screen.getByTestId('c'))).toContain('justify-content:center');
    expect(cssOf(screen.getByTestId('s'))).toContain('flex-grow:1');
    const divider = screen.getByTestId('d');
    expect(divider).toHaveAttribute('role', 'separator');
    expect(cssOf(divider)).toContain('border-left-width:1px');
    const card = cssOf(screen.getByTestId('card'));
    expect(card).toContain('border-radius:14px');
    expect(card).toContain('background-color:var(--ui-elevation-2)');
  });
});

describe('Island + IslandGrid', () => {
  test('compact mode is a pass-through stack', () => {
    renderUi(
      () => (
        <IslandGrid columns={2} dataSet={{ testid: 'grid' }}>
          <Island title="Ignored on compact" dataSet={{ testid: 'i' }}>
            <Text label="body" />
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
            <Text label="body" />
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

describe('TopBar + NavRail', () => {
  test('slots, safe-area padding and breakpoint height', () => {
    renderUi(
      () => (
        <TopBar
          dataSet={{ testid: 'tb' }}
          leading={<Text label="L" />}
          center={<TopBarTitle label="Title" />}
          trailing={<Text label="R" />}
          centerAlign="center"
        />
      ),
      { width: 1280 }
    );
    const bar = screen.getByTestId('tb');
    expect(bar.tagName).toBe('HEADER');
    expect(bar.className).toMatch(/safeTop/);
    const row = bar.firstElementChild;
    if (row === null) throw new Error('missing row');
    expect(cssOf(row)).toContain('height:72px');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Title'
    );
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  test('NavRail pins header/footer around a growing body', () => {
    renderUi(() => (
      <NavRail
        dataSet={{ testid: 'rail' }}
        width={200}
        header={<Text label="head" />}
        footer={<Text label="foot" />}
      >
        <Text label="body" />
      </NavRail>
    ));
    const rail = screen.getByTestId('rail');
    expect(rail.tagName).toBe('NAV');
    expect(cssOf(rail)).toContain('width:200px');
    expect(rail.children).toHaveLength(3);
  });
});

describe('AppFrame', () => {
  function Override() {
    useSetAppFrameHeader(<Text label="override header" />);
    return <Text label="screen" />;
  }

  test('wide frame shows the default header, screens can override it', () => {
    renderUi(
      () => (
        <AppFrameChromeProvider>
          <AppFrame header={<Text label="default header" />}>
            <Override />
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      { width: 1280 }
    );
    expect(screen.getByText('override header')).toBeInTheDocument();
    expect(screen.queryByText('default header')).toBeNull();
    expect(screen.getByRole('main')).toHaveAttribute('data-mode', 'wide');
  });

  test('compact frame ignores the header', () => {
    renderUi(
      () => (
        <AppFrame header={<Text label="default header" />}>
          <Text label="screen" />
        </AppFrame>
      ),
      { width: 390 }
    );
    expect(screen.queryByText('default header')).toBeNull();
    expect(screen.getByRole('main')).toHaveAttribute('data-mode', 'compact');
  });
});
