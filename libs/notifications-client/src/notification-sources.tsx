/** @jsxImportSource solid-js */
/**
 * Where notifications come from.
 *
 * Notifications owns the inbox — fetching, read state, rendering rows. It
 * does not know what a friend request is, or a space invite. Each feature
 * that can produce a notification registers a source here, and notifications
 * renders whatever it was given.
 *
 * Sources accumulate down the tree: each provider appends to the set its
 * parent published, so contributing features nest in composition order and
 * none of them has to know about the others. A shell composed with no
 * sources has an empty inbox, which is a real state rather than a broken one.
 */

import { defineContext } from '@pkgs/solid-context-client/define-context';
import { type Accessor, createMemo, type JSX } from 'solid-js';

import type { NotificationProvider } from '@libs/notifications-shared/notification-provider';

const NotificationSourcesContext = defineContext<
  Accessor<readonly NotificationProvider[]>
>('NotificationSources');

const NO_SOURCES: Accessor<readonly NotificationProvider[]> = () => [];

/** Every source registered above this point, in registration order. */
export function useNotificationSources(): Accessor<
  readonly NotificationProvider[]
> {
  return NotificationSourcesContext.useOptional() ?? NO_SOURCES;
}

/**
 * Register one feature's sources. Mount above the notifications session
 * provider — context flows down, so a source published below it is invisible.
 */
export function NotificationSourceProvider(props: {
  readonly sources: Accessor<readonly NotificationProvider[]>;
  readonly children: JSX.Element;
}): JSX.Element {
  const inherited = useNotificationSources();
  const merged = createMemo((): readonly NotificationProvider[] => [
    ...inherited(),
    ...props.sources(),
  ]);
  return (
    <NotificationSourcesContext.Provider value={merged}>
      {props.children}
    </NotificationSourcesContext.Provider>
  );
}
