/** @jsxImportSource solid-js */
/**
 * One canvas and centered reading columns on wide layouts: the frame paints
 * the `background` tone edge to edge, a capped column sits in the middle of
 * the frame column, and its page title sits in that same column. Inside an
 * open space a capped column keeps the space bar's leading edge instead.
 */

import { describe, expect, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import {
  AppFrameChromeProvider,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { SCREEN_MAX_WIDTH } from '@pkgs/ui-root-client-ts/screen-measure';
import type { JSX } from 'solid-js';
import { mustQuery, renderUi } from './render';

const WIDE = { width: 1440, height: 900 };

function framed(screen: () => JSX.Element): () => JSX.Element {
  return () => (
    <AppFrameChromeProvider>
      <AppFrame header={<p class="text">{'header'}</p>}>{screen()}</AppFrame>
    </AppFrameChromeProvider>
  );
}

function style(selector: string): CSSStyleDeclaration {
  return (mustQuery(selector) as HTMLElement).style;
}

function classes(selector: string): string {
  return mustQuery(selector).className;
}

describe('wide layout canvas and centered measure', () => {
  // regression: wide-layout-canvas-and-centered-measure
  test('the wide frame paints the background canvas, never the surface well', () => {
    renderUi(
      framed(() => <p class="text">{'body'}</p>),
      WIDE
    );
    const frame = classes('[data-component="AppFrame"]');
    expect(frame).toMatch(/\bbg-background\b/);
    expect(frame).not.toMatch(/\bbg-surface\b/);
  });

  // regression: wide-layout-canvas-and-centered-measure
  test('a menu screen centers its column and holds its title to the same column', () => {
    renderUi(
      framed(() => (
        <MenuScreen screenId="settings" breadcrumbs={[{ name: 'Settings' }]}>
          <p class="text">{'rows'}</p>
        </MenuScreen>
      )),
      WIDE
    );
    expect(classes('[data-component="ScreenBaseHeader"]')).toMatch(
      /\bmx-auto\b/
    );
    expect(classes('[data-component="ScreenColumn"]')).toMatch(/\bmx-auto\b/);
    expect(style('[data-component="ScreenBaseHeader"]').maxWidth).toBe(
      SCREEN_MAX_WIDTH.menu
    );
    expect(style('[data-component="ScreenColumn"]').maxWidth).toBe(
      SCREEN_MAX_WIDTH.menu
    );
  });

  test('inside a space a capped column keeps the space bar edge', () => {
    function InSpace(): JSX.Element {
      useSetAppFrameHeader(<p class="text">{'Space bar'}</p>);
      return (
        <MenuScreen screenId="games" breadcrumbs={[{ name: 'Games' }]}>
          <p class="text">{'rows'}</p>
        </MenuScreen>
      );
    }
    renderUi(
      framed(() => <InSpace />),
      WIDE
    );
    expect(classes('[data-component="ScreenBaseHeader"]')).not.toMatch(
      /\bmx-auto\b/
    );
    expect(classes('[data-component="ScreenColumn"]')).not.toMatch(
      /\bmx-auto\b/
    );
  });

  // regression: header-action-floats-above-title
  test('header actions sit on the title line, under the breadcrumb', () => {
    renderUi(
      framed(() => (
        <MenuScreen
          screenId="friends"
          breadcrumbs={[
            { name: 'Profile', onClick: () => {} },
            { name: 'Friends' },
          ]}
          actions={[
            { type: 'secondary', label: 'Find friends', onClick: () => {} },
          ]}
        >
          <p class="text">{'rows'}</p>
        </MenuScreen>
      )),
      WIDE
    );
    const actions = mustQuery('[data-component="ScreenBaseHeaderActions"]');
    expect(actions.className).toMatch(/\bself-end\b/);
    expect(actions.textContent).toContain('Find friends');
    expect(classes('[data-component="ScreenBaseHeader"]')).toMatch(
      /\bitems-end\b/
    );
  });

  // regression: wide-layout-canvas-and-centered-measure
  test('a content screen shares the prose measure between title and body', () => {
    renderUi(
      framed(() => (
        <ContentScreen screenId="privacy" breadcrumbs={[{ name: 'Privacy' }]}>
          <p class="text">{'prose'}</p>
        </ContentScreen>
      )),
      WIDE
    );
    expect(style('[data-component="ScreenBaseHeader"]').maxWidth).toBe(
      SCREEN_MAX_WIDTH.prose
    );
    expect(style('[data-component="ScreenColumn"]').maxWidth).toBe(
      SCREEN_MAX_WIDTH.prose
    );
  });

  // regression: wide-layout-canvas-and-centered-measure
  // regression: compact-menus-not-centered
  test.each([390, 768, 1024, 1440])(
    'an embedded menu centers its title and rows at width %i',
    (width) => {
      renderUi(
        () => (
          <MainMenuScreen
            screenId="games"
            title="Games"
            items={[{ key: 'chess', title: 'Chess' }]}
          />
        ),
        { width, height: 900 }
      );
      const column = mustQuery('[data-component="ScrollViewContent"]');
      expect(column.className).toMatch(/\bmx-auto\b/);
      expect((column as HTMLElement).style.maxWidth).toBe(
        SCREEN_MAX_WIDTH.menu
      );
      expect(column.querySelector('[data-component="ScreenIntro"]')).not.toBe(
        null
      );
    }
  );

  // regression: compact-menus-not-centered
  // 1024 and up is the wide layout: the measure keeps the frame column edge.
  test.each([390, 768])(
    'a routed menu centers its column at compact width %i',
    (width) => {
      renderUi(
        framed(() => (
          <MenuScreen screenId="settings" breadcrumbs={[{ name: 'Settings' }]}>
            <p class="text">{'rows'}</p>
          </MenuScreen>
        )),
        { width, height: 800 }
      );
      expect(classes('[data-component="ScreenColumn"]')).toMatch(/\bmx-auto\b/);
    }
  );
});
