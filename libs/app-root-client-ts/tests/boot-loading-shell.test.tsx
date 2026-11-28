import { expect, test } from 'bun:test';
import { BootLoadingShell } from '@libs/app-root-client-ts/boot-loading-shell';
import {
  BrowserOpening,
  OpeningContent,
  useBrowserOpening,
} from '@libs/app-root-client-ts/browser-opening';
import { IdentityBootScreenView } from '@libs/app-root-client-ts/identity-boot-screen-view';
import { setupI18n } from '@lingui/core';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { SpinnerProvider } from '@pkgs/ui-root-client-ts/spinner-context';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { render } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { createSignal, flush, Show } from 'solid-js';

function PassiveActivity(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const opening = useBrowserOpening();
  return (
    <SpinnerProvider quietActivity={opening?.quietActivity}>
      {props.children}
    </SpinnerProvider>
  );
}

function openDocument(content: () => JSX.Element) {
  const shell = document.createElement('section');
  shell.dataset['startupShell'] = '';
  const button = document.createElement('button');
  button.dataset['testid'] = 'theme-option-dark';
  shell.append(button);
  const root = document.createElement('div');
  document.body.append(shell, root);
  const time = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const view = render(
    () => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <I18nProvider i18n={i18n}>
          <ThemeProvider colorScheme="light">
            <BrowserOpening root={root}>
              <PassiveActivity>{content()}</PassiveActivity>
            </BrowserOpening>
          </ThemeProvider>
        </I18nProvider>
      </ClockProvider>
    ),
    { container: root }
  );
  const dispose = () => {
    view.unmount();
    shell.remove();
    root.remove();
  };
  return { view, shell, button, dispose };
}

// regression: boot-spinner-size-jump
test('the opening stays usable until the route commits, including when its list is still reading', () => {
  const [ready, setReady] = createSignal(false);
  const [working, setWorking] = createSignal(false);
  const { view, shell, button, dispose } = openDocument(() => (
    <Show when={ready()} fallback={<BootLoadingShell />}>
      <OpeningContent>
        <button
          data-testid="theme-option-dark"
          onClick={() => setWorking(true)}
        >
          Dark
        </button>
        <LoadingState caption="Reading your spaces" />
        <Show when={working()}>
          <LoadingState caption="Creating space" />
        </Show>
      </OpeningContent>
    </Show>
  ));
  try {
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(shell.isConnected).toBe(true);
    expect(view.container.querySelector('svg')).toBeNull();
    setReady(true);
    flush();
    expect(shell.isConnected).toBe(false);
    const live = view.getByRole('button', { name: 'Dark' });
    expect(document.activeElement).toBe(live);
    expect(view.getByRole('status').textContent).toBe('Reading your spaces');
    expect(
      view.container.querySelector('[data-activity-indicator]')
    ).toBeNull();
    live.click();
    flush();
    expect(
      view.container.querySelectorAll('[data-activity-indicator]')
    ).toHaveLength(1);
  } finally {
    dispose();
  }
});

test('a failed identity hands the opening document to recovery', () => {
  const [stuck, setStuck] = createSignal(false);
  const { view, shell, dispose } = openDocument(() => (
    <IdentityBootScreenView
      status={stuck() ? 'stuck' : 'pending'}
      onReload={() => {}}
    />
  ));
  try {
    expect(shell.isConnected).toBe(true);
    setStuck(true);
    flush();
    expect(shell.isConnected).toBe(false);
    expect(
      view.getByRole('button', { name: 'Reload app' })
    ).toBeInTheDocument();
  } finally {
    dispose();
  }
});

test('a search being composed keeps focus until the input method commits its final text', () => {
  const [ready, setReady] = createSignal(false);
  const { view, shell, dispose } = openDocument(() => (
    <Show when={ready()} fallback={<BootLoadingShell />}>
      <OpeningContent>
        <input name="people-search" aria-label="Find people" />
      </OpeningContent>
    </Show>
  ));
  const draft = document.createElement('input');
  draft.name = 'people-search';
  draft.dataset['composing'] = '';
  shell.append(draft);
  const frames: FrameRequestCallback[] = [];
  const window = document.defaultView;
  if (!window) throw new Error('Test document requires a window');
  const request = window.requestAnimationFrame;
  window.requestAnimationFrame = (frame) => frames.push(frame);
  try {
    draft.focus();
    setReady(true);
    flush();
    expect(shell.isConnected).toBe(true);
    draft.removeAttribute('data-composing');
    draft.dispatchEvent(new Event('compositionend', { bubbles: true }));
    draft.value = '明';
    draft.dispatchEvent(new Event('input', { bubbles: true }));
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) frame(0);
    expect(shell.isConnected).toBe(false);
    const field = view.getByRole('textbox', { name: 'Find people' });
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty('value', '明');
  } finally {
    window.requestAnimationFrame = request;
    dispose();
  }
});

// regression: opening-spaces-action
test('an opening New space request activates the mounted action once', () => {
  const [ready, setReady] = createSignal(false);
  let starts = 0;
  const { button, dispose } = openDocument(() => (
    <Show when={ready()}>
      <OpeningContent>
        <button
          data-testid="space-create"
          onClick={() => {
            starts++;
          }}
        >
          New space
        </button>
      </OpeningContent>
    </Show>
  ));
  try {
    button.setAttribute('data-startup-create', '');
    button.disabled = true;
    setReady(true);
    flush();
    expect(starts).toBe(1);
  } finally {
    dispose();
  }
});
