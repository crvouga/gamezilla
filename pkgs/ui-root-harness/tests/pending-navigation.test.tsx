import { expect, mock, test } from 'bun:test';
import { eventConstructor } from '@pkgs/bun-test-solid-client/native-event';
import { AppRouterProvider, useRouter } from '@pkgs/ui-root-client/app-router';
import { Button } from '@pkgs/ui-root-client/button';
import {
  useConfirmNavigation,
  usePendingOperation,
} from '@pkgs/ui-root-client/pending-navigation';
import { PendingNavigationConfirmation } from '@pkgs/ui-root-client/pending-navigation-provider';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import { SurfaceStackProvider } from '@pkgs/ui-root-client/surface-stack';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { A, createMemoryHistory, MemoryRouter, Route } from '@solidjs/router';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal, onCleanup, Show } from 'solid-js';
import { renderUi } from './render';

function Editor(props: {
  operation: () => Promise<void>;
  dispose: () => void;
  hide: () => void;
}) {
  const router = useRouter();
  const confirmNavigation = useConfirmNavigation();
  const save = useMutationButton({
    operation: () => props.operation(),
    labels: {
      idle: 'Save',
      loading: 'Saving',
      success: 'Saved',
      error: 'Try again',
    },
  });
  onCleanup(() => props.dispose());
  return (
    <>
      <Button {...save.buttonProps} dataSet={{ testid: 'save' }} />
      <button type="button" onClick={() => router.push('/next')}>
        Next
      </button>
      <button type="button" onClick={() => confirmNavigation(props.hide)}>
        Close embedded editor
      </button>
      <A href="/next">Open next place</A>
    </>
  );
}

function BackgroundWork(props: { cancel: () => void }) {
  usePendingOperation(
    () => true,
    () => props.cancel()
  );
  return null;
}

function setup(inDialog = false, cancelBackground?: () => void) {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const work = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  const dispose = mock();
  const [shown, setShown] = createSignal(true);
  const rendered = renderUi(() => (
    <MemoryRouter
      history={createMemoryHistory()}
      root={(props) => (
        <AppRouterProvider>
          <SurfaceStackProvider>
            <Show when={cancelBackground}>
              {(cancel) => <BackgroundWork cancel={cancel()} />}
            </Show>
            {props.children}
            <PendingNavigationConfirmation />
          </SurfaceStackProvider>
        </AppRouterProvider>
      )}
    >
      <Route
        path="/"
        component={() => (
          <Show when={shown()} fallback={<p>Embedded editor closed</p>}>
            <Show
              when={inDialog}
              fallback={
                <Editor
                  operation={() => work}
                  dispose={dispose}
                  hide={() => setShown(false)}
                />
              }
            >
              <ResponsiveSurface
                visible
                title="Editor"
                onClose={() => setShown(false)}
                closeDataSet={{ testid: 'close-editor' }}
              >
                <Editor
                  operation={() => work}
                  dispose={dispose}
                  hide={() => setShown(false)}
                />
              </ResponsiveSurface>
            </Show>
          </Show>
        )}
      />
      <Route path="/next" component={() => <p>Next place</p>} />
    </MemoryRouter>
  ));
  return { ...rendered, resolve, reject, dispose };
}

function reloadIsBlocked(): boolean {
  const Event = eventConstructor(window);
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

async function startSaving() {
  fireEvent.click(screen.getByTestId('save'));
  await screen.findByRole('button', { name: 'Saving' });
}

test('staying keeps a pending mutation mounted and leaving disposes it only after confirmation', async () => {
  const app = setup();
  expect(reloadIsBlocked()).toBe(false);
  await startSaving();
  expect(reloadIsBlocked()).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByTestId('pending-navigation-warning')).toBeInTheDocument();
  expect(app.dispose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('pending-navigation-stay'));
  expect(screen.queryByTestId('pending-navigation-warning')).toBeNull();
  expect(screen.getByRole('button', { name: 'Saving' })).toBeInTheDocument();
  expect(reloadIsBlocked()).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByTestId('pending-navigation-leave'));
  expect(await screen.findByText('Next place')).toBeInTheDocument();
  expect(app.dispose).toHaveBeenCalledTimes(1);
  expect(reloadIsBlocked()).toBe(false);
  app.resolve();
});

test('embedded navigation keeps its owner alive until departure is confirmed', async () => {
  const app = setup();
  await startSaving();
  fireEvent.click(
    screen.getByRole('button', { name: 'Close embedded editor' })
  );
  expect(app.dispose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('pending-navigation-stay'));
  expect(app.dispose).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Close embedded editor' })
  );
  fireEvent.click(screen.getByTestId('pending-navigation-leave'));
  expect(screen.getByText('Embedded editor closed')).toBeInTheDocument();
  expect(app.dispose).toHaveBeenCalledTimes(1);
  app.resolve();
});

test('router links also require confirmation while a mutation is pending', async () => {
  const app = setup();
  await startSaving();
  fireEvent.click(screen.getByRole('link', { name: 'Open next place' }));
  expect(screen.getByTestId('pending-navigation-warning')).toBeInTheDocument();
  expect(app.dispose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('pending-navigation-leave'));
  expect(await screen.findByText('Next place')).toBeInTheDocument();
  expect(app.dispose).toHaveBeenCalledTimes(1);
  app.resolve();
});

test('dismissing a dialog keeps its mutation mounted until departure is confirmed', async () => {
  const app = setup(true);
  await startSaving();
  fireEvent.click(screen.getByTestId('close-editor'));
  expect(app.dispose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('pending-navigation-stay'));
  expect(app.dispose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('close-editor'));
  fireEvent.click(screen.getByTestId('pending-navigation-leave'));
  expect(screen.getByText('Embedded editor closed')).toBeInTheDocument();
  expect(app.dispose).toHaveBeenCalledTimes(1);
  expect(reloadIsBlocked()).toBe(false);
  app.resolve();
});

test('closing a dialog cancels only work belonging to that dialog', async () => {
  const cancelBackground = mock();
  const app = setup(true, cancelBackground);
  await startSaving();
  fireEvent.click(screen.getByTestId('close-editor'));
  fireEvent.click(screen.getByTestId('pending-navigation-leave'));
  expect(app.dispose).toHaveBeenCalledTimes(1);
  expect(cancelBackground).not.toHaveBeenCalled();
  expect(reloadIsBlocked()).toBe(true);
  app.resolve();
});

test('closing an idle dialog does not interrupt work elsewhere', () => {
  const cancelBackground = mock();
  const app = setup(true, cancelBackground);
  fireEvent.click(screen.getByTestId('close-editor'));
  expect(app.dispose).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('pending-navigation-warning')).toBeNull();
  expect(cancelBackground).not.toHaveBeenCalled();
  expect(reloadIsBlocked()).toBe(true);
  app.resolve();
});

test.each(['success', 'failure'] as const)(
  'reload protection clears after mutation %s',
  async (outcome) => {
    const app = setup();
    await startSaving();
    if (outcome === 'success') app.resolve();
    else app.reject(new Error('The save was refused.'));
    await screen.findByRole('button', {
      name: outcome === 'success' ? 'Saved' : 'Try again',
    });
    expect(reloadIsBlocked()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Next place')).toBeInTheDocument();
    expect(screen.queryByTestId('pending-navigation-warning')).toBeNull();
  }
);

test('finishing during confirmation makes the requested departure safe', async () => {
  const app = setup();
  await startSaving();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  app.resolve();
  expect(await screen.findByText('Next place')).toBeInTheDocument();
  expect(screen.queryByTestId('pending-navigation-warning')).toBeNull();
  expect(reloadIsBlocked()).toBe(false);
  expect(app.dispose).toHaveBeenCalledTimes(1);
});
