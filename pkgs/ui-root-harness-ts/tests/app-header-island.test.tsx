/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { HouseIcon, SettingsIcon } from '@pkgs/ui-root-client-ts/icons';
import { ScreenBase } from '@pkgs/ui-root-client-ts/screen-base';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createContext, createSignal, Show, useContext } from 'solid-js';
import { mustQuery, renderUi } from './render';

const WIDE = { width: 1280, height: 900 };

describe('AppHeaderIsland', () => {
  test('renders leading, a navigation of current-page buttons and explicit trailing', async () => {
    const user = userEvent.setup();
    const onHome = mock();
    const onSettings = mock();
    renderUi(
      () => (
        <AppHeaderIsland
          leading={<p class="text">{'Logo'}</p>}
          items={[
            {
              id: 'home',
              label: 'Home',
              icon: HouseIcon,
              active: true,
              onClick: onHome,
            },
            {
              id: 'settings',
              label: 'Settings',
              icon: SettingsIcon,
              active: false,
              onClick: onSettings,
            },
          ]}
          trailing={<p class="text">{'Avatar'}</p>}
        />
      ),
      WIDE
    );
    const root = mustQuery('[data-component="AppHeaderIsland"]');
    expect(root.tagName).toBe('HEADER');
    expect(screen.getByText('Logo')).toBeTruthy();
    expect(screen.getByText('Avatar')).toBeTruthy();
    expect(root.className).not.toMatch(/\bborder-b\b/);
    expect(root.querySelector('[data-slot="hairline"]')).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Navigation' });
    expect(screen.queryByRole('tablist')).toBeNull();
    const items = Array.from(nav.querySelectorAll('button'));
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('aria-current')).toBe('page');
    expect(items[1]?.hasAttribute('aria-current')).toBe(false);
    expect(items[0]?.className).toMatch(/\brounded-full\b/);
    expect(items[1]?.className).toMatch(/\bborder-transparent\b/);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();
  });

  test('omits the navigation without items and falls back to AppFrame global trailing', () => {
    renderUi(
      () => (
        <AppFrameChromeProvider globalTrailing={<p class="text">{'Global'}</p>}>
          <AppFrame
            header={<AppHeaderIsland leading={<p class="text">{'Logo'}</p>} />}
          >
            <p class="text">{'body'}</p>
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      WIDE
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByText('Global')).toBeTruthy();
    expect(mustQuery('[data-component="AppHeaderIsland"]')).toBeTruthy();
  });
});

// regression: shell-breadcrumb-pills
test('screen breadcrumbs replace root pills, retain navigation and reset after unmount', async () => {
  const ancestor = mock();
  const [open, setOpen] = createSignal(true);
  const [title, setTitle] = createSignal('Username');
  renderUi(
    () => (
      <AppFrameChromeProvider screenNavigation>
        <AppFrame
          header={
            <AppHeaderIsland
              items={[
                {
                  id: 'profile',
                  label: 'Profile tab',
                  icon: HouseIcon,
                  active: true,
                  onClick: ancestor,
                },
              ]}
            />
          }
        >
          <Show when={open()}>
            <ScreenBase
              screenId="profile-handle"
              breadcrumbs={[
                { name: 'Profile', onClick: ancestor },
                { name: 'Edit profile', onClick: ancestor },
                { name: title() },
              ]}
              content={() => <p>Form</p>}
            />
          </Show>
        </AppFrame>
      </AppFrameChromeProvider>
    ),
    WIDE
  );
  expect(screen.queryByRole('button', { name: 'Profile tab' })).toBeNull();
  expect(
    document.querySelector('[data-component="ScreenBaseHeader"]')
  ).toBeNull();
  expect(
    screen.getByRole('heading', { name: 'Username', level: 1 })
  ).toBeTruthy();
  const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
  expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe(
    'Username'
  );
  await userEvent.setup().click(screen.getByRole('link', { name: 'Profile' }));
  expect(ancestor).toHaveBeenCalledTimes(1);
  setTitle('Avatar');
  expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe(
    'Avatar'
  );
  setOpen(false);
  expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Profile tab' })).toBeTruthy();
});

test('root screens keep primary navigation without a redundant body header', () => {
  renderUi(
    () => (
      <AppFrameChromeProvider screenNavigation>
        <AppFrame
          header={
            <AppHeaderIsland
              items={[
                {
                  id: 'profile',
                  label: 'Profile tab',
                  icon: HouseIcon,
                  active: true,
                  onClick: () => {},
                },
              ]}
            />
          }
        >
          <ScreenBase
            screenId="profile"
            breadcrumbs={[{ name: 'Profile' }]}
            content={() => <p>Identity</p>}
          />
        </AppFrame>
      </AppFrameChromeProvider>
    ),
    WIDE
  );
  expect(screen.getByRole('button', { name: 'Profile tab' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
  expect(
    document.querySelector('[data-component="ScreenBaseHeader"]')
  ).toBeNull();
});

test('compact screens retain their own back/title bar', () => {
  renderUi(
    () => (
      <AppFrameChromeProvider screenNavigation>
        <AppFrame header={<AppHeaderIsland />}>
          <ScreenBase
            screenId="profile-edit"
            breadcrumbs={[
              { name: 'Profile', onClick: () => {} },
              { name: 'Edit profile' },
            ]}
            content={() => <p>Form</p>}
          />
        </AppFrame>
      </AppFrameChromeProvider>
    ),
    { width: 390, height: 844 }
  );
  expect(
    document.querySelector('[data-component="AppHeaderIsland"]')
  ).toBeNull();
  expect(
    document.querySelector('[data-component="ScreenBaseHeader"]')
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
});

test('screen actions remain usable when navigation moves into the shell', async () => {
  const save = mock();
  renderUi(
    () => (
      <AppFrameChromeProvider screenNavigation>
        <AppFrame header={<AppHeaderIsland />}>
          <ScreenBase
            screenId="editor"
            breadcrumbs={[
              { name: 'Profile', onClick: () => {} },
              { name: 'Editor' },
            ]}
            actions={[{ type: 'submit', label: 'Save', onClick: save }]}
            content={() => <p>Form</p>}
          />
        </AppFrame>
      </AppFrameChromeProvider>
    ),
    WIDE
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

test('persistent shell resolves newly routed ancestors to their named destinations', async () => {
  const push = mock();
  const back = mock();
  const [routed, setRouted] = createSignal(false);
  renderUi(
    () => (
      <StaticAppRouterProvider
        router={{ push, back, replace: mock(), canGoBack: () => true }}
      >
        <AppFrameChromeProvider screenNavigation>
          <AppFrame header={<AppHeaderIsland />}>
            <ScreenBase
              screenId="editor"
              breadcrumbs={
                routed()
                  ? [
                      { name: 'Profile', href: '/profile' },
                      { name: 'Username' },
                    ]
                  : [{ name: 'Profile', onClick: () => {} }, { name: 'Editor' }]
              }
              content={() => <p>Form</p>}
            />
          </AppFrame>
        </AppFrameChromeProvider>
      </StaticAppRouterProvider>
    ),
    WIDE
  );
  setRouted(true);
  await userEvent.setup().click(screen.getByRole('link', { name: 'Profile' }));
  expect(push).toHaveBeenCalledWith('/profile');
  expect(back).not.toHaveBeenCalled();
});

// regression: shell-breadcrumb-jsx-title
test('a JSX breadcrumb title mounts once and remains the accessible page heading', () => {
  const title = <em>Username</em>;
  renderUi(
    () => (
      <AppFrameChromeProvider screenNavigation>
        <AppFrame header={<AppHeaderIsland />}>
          <ScreenBase
            screenId="profile-handle"
            breadcrumbs={[{ name: 'Profile' }, { name: title }]}
            content={() => <p>Form</p>}
          />
        </AppFrame>
      </AppFrameChromeProvider>
    ),
    WIDE
  );
  expect(
    screen.getByRole('navigation', { name: 'Breadcrumb' })
  ).toHaveTextContent('Username');
  expect(
    screen.getByRole('heading', { name: 'Username', level: 1 })
  ).toBeTruthy();
  expect(document.querySelectorAll('h1')).toHaveLength(1);
});

test('keyboard focus reaches the pill heading and returns to the previous screen control', async () => {
  const [editing, setEditing] = createSignal(false);
  renderUi(
    () => (
      <AppFrameChromeProvider screenNavigation>
        <AppFrame header={<AppHeaderIsland />}>
          <Show
            when={editing()}
            fallback={
              <ScreenBase
                screenId="profile"
                breadcrumbs={[{ name: 'Profile' }]}
                content={() => (
                  <button type="button" onClick={() => setEditing(true)}>
                    Edit username
                  </button>
                )}
              />
            }
          >
            <ScreenBase
              screenId="profile-handle"
              breadcrumbs={[
                { name: 'Profile', onClick: () => setEditing(false) },
                { name: 'Username' },
              ]}
              content={() => <p>Form</p>}
            />
          </Show>
        </AppFrame>
      </AppFrameChromeProvider>
    ),
    WIDE
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Edit username' }));
  const heading = screen.getByRole('heading', { name: 'Username', level: 1 });
  expect(document.activeElement).toBe(heading);
  expect(heading.closest('[data-component="AppHeaderIsland"]')).toBeTruthy();
  await user.click(screen.getByRole('link', { name: 'Profile' }));
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Edit username' })
  );
});

// regression: shell-breadcrumb-label-context
test('breadcrumb JSX keeps the screen provider context and mounts once', () => {
  const LabelContext = createContext('Missing context');
  let mounts = 0;
  function Label() {
    mounts++;
    return <span>{useContext(LabelContext)}</span>;
  }
  renderUi(
    () => (
      <AppFrameChromeProvider screenNavigation>
        <AppFrame header={<AppHeaderIsland />}>
          <LabelContext.Provider value="Scoped username">
            <ScreenBase
              screenId="scoped-editor"
              breadcrumbs={[
                { name: 'Profile', onClick: () => {} },
                {
                  get name() {
                    return <Label />;
                  },
                },
              ]}
              content={() => <p>Form</p>}
            />
          </LabelContext.Provider>
        </AppFrame>
      </AppFrameChromeProvider>
    ),
    WIDE
  );
  expect(screen.getByRole('heading', { name: 'Scoped username' })).toBeTruthy();
  expect(mounts).toBe(1);
});
