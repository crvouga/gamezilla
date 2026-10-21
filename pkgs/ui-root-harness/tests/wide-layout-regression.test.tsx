/** @jsxImportSource solid-js */
/**
 * One canvas and centered measures on wide layouts: the frame paints the
 * `background` tone edge to edge, a capped column sits in the middle of the
 * frame, and its page title sits in that same column.
 */

import { describe, expect, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client/app-frame-chrome';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import { MenuScreen } from '@pkgs/ui-root-client/menu-screen';
import { SCREEN_MAX_WIDTH } from '@pkgs/ui-root-client/screen-measure';
import type { JSX } from 'solid-js';
import { mustQuery, renderUi } from './render';

const WIDE = { width: 1440, height: 900 };
const COMPACT = { width: 390, height: 800 };

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
  test('an embedded main menu centers its column with its title inside it', () => {
    renderUi(
      () => (
        <MainMenuScreen
          screenId="games"
          title="Games"
          items={[{ key: 'chess', title: 'Chess' }]}
        />
      ),
      WIDE
    );
    const column = mustQuery('[data-component="ScrollViewContent"]');
    expect(column.className).toMatch(/\bmx-auto\b/);
    expect((column as HTMLElement).style.maxWidth).toBe(SCREEN_MAX_WIDTH.menu);
    expect(column.querySelector('[data-component="ScreenIntro"]')).not.toBe(
      null
    );
  });

  test('compact keeps the column on the page edge', () => {
    renderUi(
      framed(() => (
        <MenuScreen screenId="settings" breadcrumbs={[{ name: 'Settings' }]}>
          <p class="text">{'rows'}</p>
        </MenuScreen>
      )),
      COMPACT
    );
    expect(classes('[data-component="ScreenColumn"]')).not.toMatch(
      /\bmx-auto\b/
    );
  });
});
