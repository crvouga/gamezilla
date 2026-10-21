/** @jsxImportSource solid-js */
import { useSyncedProfiles } from '@libs/profile-client-ts/use-synced-profiles';
import { profilesByIds } from '@libs/profile-shared-ts/profiles-by-ids-query';
import { SyncEngineProvider } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { INITIAL_SYNC_STATUS } from '@pkgs/sync-engine-client-ts/sync-status';
import { render } from '@solidjs/testing-library';
import type { Accessor } from 'solid-js';

type ProfileSubscription = {
  readonly ids: readonly string[];
  readonly params: Readonly<Record<string, unknown>>;
  closed: boolean;
};

function subscriptionEngine() {
  const subscriptions: ProfileSubscription[] = [];
  const engine = {
    watch: () => ({
      getSnapshot: () => [],
      getHydrated: () => true,
      subscribe: () => () => undefined,
    }),
    status: {
      getSnapshot: () => INITIAL_SYNC_STATUS,
      subscribe: () => () => undefined,
    },
    subscribeQuery: (
      name: string,
      params: Readonly<Record<string, unknown>>
    ) => {
      if (name !== profilesByIds.name)
        throw new Error('Unexpected profile query');
      const ids = params['ids'];
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
        throw new Error('Expected profile identifiers');
      }
      const subscription = { ids, params, closed: false };
      subscriptions.push(subscription);
      return {
        unsubscribe: () => {
          subscription.closed = true;
        },
        waitForFirstSync: () => Promise.resolve(),
      };
    },
  } as unknown as SyncEngine;
  return { engine, subscriptions };
}

function ProfileSubscriptions(props: {
  readonly ids: Accessor<readonly string[]>;
}) {
  useSyncedProfiles(props.ids);
  return null;
}

export function mountProfileSubscriptions(ids: Accessor<readonly string[]>) {
  const probe = subscriptionEngine();
  const view = render(() => (
    <SyncEngineProvider value={probe.engine}>
      <ProfileSubscriptions ids={ids} />
    </SyncEngineProvider>
  ));
  return {
    subscriptions: probe.subscriptions,
    activeIds: () =>
      probe.subscriptions
        .filter((subscription) => !subscription.closed)
        .flatMap((subscription) => subscription.ids)
        .sort(),
    unmount: view.unmount,
  };
}
