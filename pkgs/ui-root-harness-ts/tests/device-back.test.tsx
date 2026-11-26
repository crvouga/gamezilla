import { expect, test } from 'bun:test';
import { eventConstructor } from '@pkgs/bun-test-solid-client-ts/native-event';
import {
  AppRouterProvider,
  useDeviceBack,
  useRouter,
} from '@pkgs/ui-root-client-ts/app-router';
import { browserHistory, createRouter } from '@solidjs/router';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

test('device Back on a directly opened board stays in the space and Minimize reaches its lobby', async () => {
  const history = browserHistory();
  const original = history.get();
  history.set({ value: '/space/friday', replace: true, scroll: false });
  function Board() {
    const [backs, setBacks] = createSignal(0);
    const router = useRouter();
    useDeviceBack(
      () => () => {
        setBacks((n) => n + 1);
      },
      '/'
    );
    return (
      <>
        <output>Board backs {backs()}</output>
        <button type="button" onClick={router.back}>
          Minimize
        </button>
      </>
    );
  }
  const Router = createRouter({
    history,
    routes: [
      { path: '/space/:id', component: Board },
      { path: '/', component: () => <output>Spaces lobby</output> },
    ],
  });
  const rendered = renderUi(() => (
    <Router>
      {(p) => (
        <AppRouterProvider documentHistory>{p.children}</AppRouterProvider>
      )}
    </Router>
  ));
  try {
    expect(screen.getByText('Board backs 0')).toBeDefined();
    // Happy DOM traverses history, while Bun owns the worker's window events.
    const WindowEvent = eventConstructor(window);
    const popState = () => window.dispatchEvent(new WindowEvent('popstate'));
    window.history.back();
    popState();
    await screen.findByText('Board backs 1');
    await waitFor(() => expect(window.location.pathname).toBe('/space/friday'));
    popState();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    popState();
    await screen.findByText('Spaces lobby');
  } finally {
    rendered.unmount();
    history.set({
      value: typeof original === 'string' ? original : original.value,
      replace: true,
      scroll: false,
    });
  }
});
