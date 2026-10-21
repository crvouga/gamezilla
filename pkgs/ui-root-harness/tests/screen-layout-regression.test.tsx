import { expect, test } from 'bun:test';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { FormActionsFooter } from '@pkgs/ui-root-client/form-actions-footer';
import { FormScreen } from '@pkgs/ui-root-client/form-screen';
import { GameReviewScreen } from '@pkgs/ui-root-client/game-review-screen';
import { GameLayout } from '@pkgs/ui-root-client/game-screen';
import { GameSetupPanel } from '@pkgs/ui-root-client/game-setup-panel';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import { ScreenIntro } from '@pkgs/ui-root-client/screen-intro';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, Show } from 'solid-js';
import { mustQuery, renderUi } from './render';

// regression: ui-menu-helper-nested-paragraph
test('menu helpers accept block content without nesting paragraphs', () => {
  const view = renderUi(() => (
    <MainMenuScreen
      screenId="menu-helper"
      items={[]}
      helper={<p>The host picks the game.</p>}
    />
  ));
  expect(view.container.querySelectorAll('p p').length).toBe(0);
  expect(view.getByText('The host picks the game.').textContent).toBe(
    'The host picks the game.'
  );
});

// regression: ui-screen-empty-reactive-slots
test('false reactive slots do not reserve rails, footer chrome or setup actions', () => {
  const [visible, setVisible] = createSignal(false);
  const view = renderUi(() => (
    <ContentScreen
      screenId="slots"
      breadcrumbs={[{ name: 'Slots' }]}
      footer={<Show when={visible()}>Footer</Show>}
    >
      <GameLayout aside={<Show when={visible()}>Record</Show>}>
        <input aria-label="Board" />
      </GameLayout>
      <GameSetupPanel
        title="Setup"
        actions={<Show when={visible()}>Start</Show>}
        details={<Show when={visible()}>Options</Show>}
      />
    </ContentScreen>
  ));
  const input = view.getByRole('textbox');
  expect(view.container.querySelector('[data-has-aside="true"]') === null).toBe(
    true
  );
  expect(
    view.container.querySelector('[data-component="ScreenFooter"]') === null
  ).toBe(true);
  expect(
    view.container.querySelector('[data-component="GameActions"]') === null
  ).toBe(true);
  setVisible(true);
  expect(
    view.container.querySelector('[data-has-aside="true"]')
  ).not.toBeNull();
  expect(
    view.container.querySelector('[data-component="ScreenFooter"]')
  ).not.toBeNull();
  expect(view.getByRole('textbox') === input).toBe(true);
  setVisible(false);
  expect(view.container.querySelector('[data-has-aside="true"]') === null).toBe(
    true
  );
  expect(view.getByRole('textbox') === input).toBe(true);
});

// regression: ui-screen-empty-reactive-slots
test('a review with an empty reactive rail keeps the menu measure', () => {
  const [visible, setVisible] = createSignal(false);
  renderUi(() => (
    <GameReviewScreen
      screenId="review"
      aside={<Show when={visible()}>Record</Show>}
    >
      <input aria-label="Board" />
    </GameReviewScreen>
  ));
  const content = () =>
    mustQuery('[data-component="ScrollViewContent"]') as HTMLElement;
  expect(content().style.maxWidth).toBe('480px');
  setVisible(true);
  expect(content().style.maxWidth).toBe('100%');
  setVisible(false);
  expect(content().style.maxWidth).toBe('480px');
});

// regression: ui-form-screen-native-submit
test('native form submission and save clicks share one operation and stay on the editor', async () => {
  let submissions = 0;
  let finish: () => void = () => {};
  const view = renderUi(() => (
    <FormScreen
      screenId="form"
      breadcrumbs={[{ name: 'Editor' }]}
      submit={{
        label: 'Save',
        successLabel: 'Saved',
        operation: () => {
          submissions += 1;
          return new Promise<void>((resolve) => {
            finish = resolve;
          });
        },
      }}
    >
      <input aria-label="Name" />
    </FormScreen>
  ));
  const input = view.getByRole('textbox') as HTMLInputElement;
  expect(input.form).not.toBeNull();
  const form = input.form;
  if (form === null) throw new Error('Editor is not associated with a form');
  const button = view.getByRole('button', {
    name: 'Save',
  }) as HTMLButtonElement;
  expect(button.form === form).toBe(true);
  fireEvent.submit(form);
  fireEvent.submit(form);
  fireEvent.click(button);
  expect(submissions).toBe(1);
  finish();
  await Promise.resolve();
  await Promise.resolve();
  expect(view.getByRole('textbox') === input).toBe(true);
  expect(view.getByRole('button', { name: 'Saved' })).toBeDefined();
});

// regression: ui-form-actions-stale-props
test('replacing form actions updates labels, disabled state and operation', async () => {
  let calls = 0;
  let cancellations = 0;
  const save = () => {
    calls += 100;
    return Promise.resolve();
  };
  const publish = () => {
    calls += 1;
    return Promise.resolve();
  };
  const [enabled, setEnabled] = createSignal(false);
  const view = renderUi(() => (
    <FormActionsFooter
      submit={{
        label: enabled() ? 'Publish' : 'Save',
        disabled: !enabled(),
        operation: enabled() ? publish : save,
      }}
      cancel={
        enabled()
          ? {
              label: 'Back',
              onClick: () => {
                cancellations += 1;
              },
            }
          : undefined
      }
    />
  ));
  expect(
    view.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled
  ).toBe(true);
  setEnabled(true);
  const button = view.getByRole('button', {
    name: 'Publish',
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  await Promise.resolve();
  expect(calls).toBe(1);
  fireEvent.click(view.getByRole('button', { name: 'Back' }));
  expect(cancellations).toBe(1);
});

// regression: ui-screen-empty-reactive-slots
test('empty setup stages disappear while zero remains valid supporting content', () => {
  const [record, setRecord] = createSignal(false);
  const view = renderUi(() => (
    <GameLayout aside={<Show when={record()}>{0}</Show>}>{null}</GameLayout>
  ));
  expect(
    view.container.querySelector('[data-component="GameLayout"]') === null
  ).toBe(true);
  setRecord(true);
  expect(
    view.container.querySelector('[data-has-aside="true"]')?.textContent
  ).toBe('0');
  setRecord(false);
  expect(
    view.container.querySelector('[data-component="GameLayout"]') === null
  ).toBe(true);
});

// regression: ui-screen-empty-reactive-slots
test('an empty lazy title does not create an invisible heading', () => {
  const [visible, setVisible] = createSignal(false);
  const view = renderUi(() => (
    <ScreenIntro
      title={<Show when={visible()}>Round review</Show>}
      subtitle={null}
    />
  ));
  expect(view.queryAllByRole('heading').length).toBe(0);
  expect(
    view.container.querySelector('[data-component="ScreenIntro"]') === null
  ).toBe(true);
  setVisible(true);
  expect(view.getByRole('heading', { level: 1 }).textContent).toBe(
    'Round review'
  );
  setVisible(false);
  expect(view.queryAllByRole('heading').length).toBe(0);
});
