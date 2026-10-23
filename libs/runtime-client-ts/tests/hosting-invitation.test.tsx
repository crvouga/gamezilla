import { expect, test } from 'bun:test';
import { createClient } from '@libs/app-root-client-ts/create-client';
import { APP_SUB_CLIENTS } from '@libs/runtime-client-ts/app-sub-clients';
import { APP } from '@libs/runtime-shared-ts/app-subs';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { createMemoryHistory } from '@solidjs/router';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { harnessClientEnv } from './harness-client-env';
import { hostedSpaceFixture } from './hosted-space-fixture';

const modals = () => screen.queryAllByTestId(Handles.spacesHostingLimit);

// regression: duplicate-hosting-limit-invitations
test.each([false, true])(
  'New space opens one invitation modal per attempt, and closing it keeps it closed (recovered: %s)',
  async (recovered) => {
    const harness = await harnessClientEnv({ seed: 38 });
    const client = createClient(harness.env, {
      subs: [hostedSpaceFixture(recovered), ...APP_SUB_CLIENTS],
      loadApp: () => Promise.resolve(APP),
    });
    const history = createMemoryHistory();
    const view = render(() => <client.App embedded history={history} />);
    const notNow = async (): Promise<void> => {
      fireEvent.click(
        screen.getByTestId(`${Handles.spacesHostingLimit}-dismiss`)
      );
      await harness.session.waitForIdle();
      await waitFor(() => expect(modals()).toHaveLength(0));
    };
    try {
      await harness.session.advanceTime(1_000);
      await harness.session.waitForIdle();
      await waitFor(() =>
        expect(
          screen.getByTestId(Handles.spacesHostingCount)
        ).toHaveTextContent('Hosting 1 space')
      );
      await waitFor(() => expect(modals()).toHaveLength(recovered ? 1 : 0));
      if (recovered) {
        await notNow();
        await harness.session.advanceTime(1_000);
        await harness.session.waitForIdle();
        expect(modals()).toHaveLength(0);
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        fireEvent.click(screen.getByTestId(Handles.spaceCreate));
        await harness.session.waitForIdle();
        await waitFor(() => expect(modals()).toHaveLength(1));
        expect(screen.getByTestId(Handles.spacesHostingLimit)).toHaveAttribute(
          'data-component',
          'DenialModal'
        );
        expect(
          screen.getAllByRole('button', { name: 'See plans' })
        ).toHaveLength(1);
        expect(
          screen.getByTestId(Handles.spacesHostingCount)
        ).toHaveTextContent('Hosting 1 space');
        await notNow();
      }

      fireEvent.click(screen.getByTestId(Handles.spaceCreate));
      await harness.session.waitForIdle();
      await waitFor(() => expect(modals()).toHaveLength(1));
      fireEvent.click(
        screen.getByTestId(`${Handles.spacesHostingLimit}-action`)
      );
      await waitFor(() =>
        expect(document.querySelector('[data-screen="billing"]')).not.toBeNull()
      );
      expect(modals()).toHaveLength(0);
      // Leave billing for Spaces by way of another route, as the router's
      // memory history only moves on a change of value.
      history.set({ value: '/more' });
      await waitFor(() =>
        expect(document.querySelector('[data-screen="more"]')).not.toBeNull()
      );
      history.set({ value: '/' });
      await harness.session.waitForIdle();
      await waitFor(() =>
        expect(
          screen.getByTestId(Handles.spacesHostingCount)
        ).toHaveTextContent('Hosting 1 space')
      );
      expect(modals()).toHaveLength(0);
    } finally {
      view.unmount();
      await client.close();
      await harness.dispose();
    }
  },
  30_000
);
