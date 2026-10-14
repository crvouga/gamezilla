import { expect, test } from 'bun:test';
import { createClient } from '@libs/app-root-client/create-client';
import { APP_SUB_CLIENTS } from '@libs/runtime-client/app-sub-clients';
import { APP } from '@libs/runtime-shared/app-subs';
import { Handles } from '@libs/test-ids-shared/handles';
import { createMemoryHistory } from '@solidjs/router';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { harnessClientEnv } from './harness-client-env';
import { hostedSpaceFixture } from './hosted-space-fixture';

// regression: duplicate-hosting-limit-invitations
test.each([false, true])(
  'New space keeps one invitation across attempts and routes (recovered: %s)',
  async (recovered) => {
    const harness = await harnessClientEnv({ seed: 38 });
    const client = createClient(harness.env, {
      subs: [hostedSpaceFixture(recovered), ...APP_SUB_CLIENTS],
      loadApp: () => Promise.resolve(APP),
    });
    const history = createMemoryHistory();
    const view = render(() => <client.App embedded history={history} />);
    try {
      await harness.session.advanceTime(1_000);
      await harness.session.waitForIdle();
      await waitFor(() =>
        expect(
          screen.getByTestId(Handles.spacesHostingCount)
        ).toHaveTextContent('Hosting 1 space')
      );
      await waitFor(() =>
        expect(
          screen.queryAllByTestId(Handles.spacesHostingLimit)
        ).toHaveLength(recovered ? 1 : 0)
      );

      for (let attempt = 0; attempt < 3; attempt++) {
        fireEvent.click(screen.getByTestId(Handles.spaceCreate));
        await harness.session.waitForIdle();
        await waitFor(() =>
          expect(
            screen.queryAllByTestId(Handles.spacesHostingLimit)
          ).toHaveLength(1)
        );
        expect(
          screen.getAllByRole('button', { name: 'See plans' })
        ).toHaveLength(1);
        expect(screen.getByTestId(Handles.spacesHostingLimit)).toHaveAttribute(
          'data-component',
          'ActionNotice'
        );
        expect(
          screen.getByTestId(`${Handles.spacesHostingLimit}-action`)
        ).toHaveAttribute('data-intent', 'neutral');
        expect(
          screen.getByTestId(Handles.spacesHostingCount)
        ).toHaveTextContent('Hosting 1 space');
      }

      history.set({ value: '/more' });
      await waitFor(() =>
        expect(document.querySelector('[data-screen="more"]')).not.toBeNull()
      );
      expect(screen.getAllByTestId(Handles.spacesHostingLimit)).toHaveLength(1);
      fireEvent.click(
        screen.getByTestId(`${Handles.spacesHostingLimit}-action`)
      );
      await waitFor(() =>
        expect(document.querySelector('[data-screen="billing"]')).not.toBeNull()
      );
      expect(screen.getAllByTestId(Handles.spacesHostingLimit)).toHaveLength(1);
      history.set({ value: '/' });
      await waitFor(() =>
        expect(
          screen.getByTestId(Handles.spacesHostingCount)
        ).toHaveTextContent('Hosting 1 space')
      );
      expect(screen.getAllByTestId(Handles.spacesHostingLimit)).toHaveLength(1);
    } finally {
      view.unmount();
      await client.close();
      await harness.dispose();
    }
  },
  30_000
);
