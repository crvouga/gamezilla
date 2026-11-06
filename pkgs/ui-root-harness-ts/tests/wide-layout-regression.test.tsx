/** @jsxImportSource solid-js */
/**
 * One canvas and one leading edge on wide layouts: the frame paints the
 * `background` tone edge to edge, every screen starts at the frame column's
 * edge with its title in the same column, menus and collections take the
 * whole column, and only prose keeps a reading measure. Compact hosts wider
 * than a measure (tablets) center it.
 */

import { describe, expect, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import {
  AppFrameChromeProvider,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
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
  test('a desktop menu screen takes the whole column from its leading edge, title included', () => {
    renderUi(
      framed(() => (
        <MenuScreen screenId="settings" breadcrumbs={[{ name: 'Settings' }]}>
          <MenuSection title="Preferences">
            <MenuRow title="Sound" />
          </MenuSection>
        </MenuScreen>
      )),
      WIDE
    );
    for (const selector of [
      '[data-component="ScreenBaseHeader"]',
      '[data-component="ScreenColumn"]',
    ]) {
      expect(classes(selector)).not.toMatch(/\bmx-auto\b/);
      expect(style(selector).maxWidth).toBe('');
    }
  });

  test('inside a space a menu screen starts at the same edge as a tab screen', () => {
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
    expect(classes('[data-component="ScreenColumn"]')).not.toMatch(
      /\bmx-auto\b/
    );
    expect(style('[data-component="ScreenColumn"]').maxWidth).toBe('');
  });

  test('a desktop menu screen puts each section label beside its rows', () => {
    renderUi(
      framed(() => (
        <MenuScreen screenId="settings" breadcrumbs={[{ name: 'Settings' }]}>
          <MenuSection title="Preferences">
            <MenuRow title="Sound" />
          </MenuSection>
        </MenuScreen>
      )),
      WIDE
    );
    expect(
      mustQuery('[data-component="MenuSection"]').getAttribute('data-layout')
    ).toBe('aside');
  });

  test('a menu section outside a menu screen stays stacked on desktop', () => {
    renderUi(
      framed(() => (
        <MenuSection title="Preferences">
          <MenuRow title="Sound" />
        </MenuSection>
      )),
      WIDE
    );
    expect(
      mustQuery('[data-component="MenuSection"]').getAttribute('data-layout')
    ).toBeNull();
  });

  test('a desktop collection shows its aside beside the list; a phone does not', () => {
    const screenUnderTest = () => (
      <CollectionScreen
        screenId="friends"
        breadcrumbs={[{ name: 'Friends' }]}
        aside={<p class="text">{'Playing now'}</p>}
      >
        <p class="text">{'rows'}</p>
      </CollectionScreen>
    );
    renderUi(framed(screenUnderTest), WIDE);
    expect(mustQuery('[data-component="CollectionAside"]').textContent).toBe(
      'Playing now'
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
