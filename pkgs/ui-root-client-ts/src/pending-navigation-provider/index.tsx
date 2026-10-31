import { Trans } from '@lingui/solid/macro';
import { createEffect, type JSX, onCleanup, Show } from 'solid-js';
import { ConfirmationModal } from '../confirmation-modal/index';
import {
  PendingNavigationContext,
  usePendingNavigation,
} from '../pending-navigation';
import { createPendingNavigation } from '../pending-navigation-state';

/** State lives above route outlets so a blocked departure keeps their owner alive. */
export function PendingNavigationProvider(props: {
  children: JSX.Element;
}): JSX.Element {
  const navigation = createPendingNavigation();
  createEffect(() => {
    if (!navigation.blocked()) return;
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    onCleanup(() => window.removeEventListener('beforeunload', beforeUnload));
  });
  return (
    <PendingNavigationContext.Provider value={navigation}>
      {props.children}
    </PendingNavigationContext.Provider>
  );
}

/** Mount inside the app's localization and surface portal providers. */
export function PendingNavigationConfirmation(): JSX.Element {
  const navigation = usePendingNavigation();
  return (
    <Show when={navigation?.confirming()}>
      <ConfirmationModal
        visible
        title={<Trans>Leave while work is in progress?</Trans>}
        message={
          <Trans>
            An upload or change is still in progress. Leaving may interrupt it.
          </Trans>
        }
        confirmLabel={<Trans>Leave anyway</Trans>}
        cancelLabel={<Trans>Stay here</Trans>}
        variant="destructive"
        onConfirm={() => navigation?.confirm()}
        onCancel={() => navigation?.stay()}
        dataSet={{ testid: 'pending-navigation-warning' }}
        confirmDataSet={{ testid: 'pending-navigation-leave' }}
        cancelDataSet={{ testid: 'pending-navigation-stay' }}
      />
    </Show>
  );
}
