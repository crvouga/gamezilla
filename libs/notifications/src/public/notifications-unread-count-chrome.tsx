/** @jsxImportSource solid-js */
/**
 * Chrome (AppFrame header island, compact tab bar) mounts above the SQLite
 * gate and the notifications registry. Tab icons must not call
 * `useNotificationsShell` / `createQuery`. Mirror the shell `SyncStatusRoot`:
 * this root supplies unread count 0; `NotificationsUnreadCountLiveBridge`
 * (loaded with the sync tree) publishes the query into the same signal.
 */

import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  useContext,
} from 'solid-js';

export const BOOT_NOTIFICATIONS_UNREAD_COUNT = 0;

const UnreadCountContext = createContext<Accessor<number>>();

type UnreadCountPublisher = (count: number) => void;

const UnreadCountPublisherContext = createContext<UnreadCountPublisher>();

/** Tracked unread count for chrome; 0 when the sync tree has not published. */
export function useNotificationsUnreadCountChrome(): Accessor<number> {
  const ctx = useContext(UnreadCountContext);
  if (ctx === undefined) {
    throw new Error(
      'useNotificationsUnreadCountChrome requires NotificationsUnreadCountRoot'
    );
  }
  return ctx;
}

export function useNotificationsUnreadCountPublisher(): UnreadCountPublisher {
  const publish = useContext(UnreadCountPublisherContext);
  if (publish === undefined) {
    throw new Error(
      'useNotificationsUnreadCountPublisher requires NotificationsUnreadCountRoot'
    );
  }
  return publish;
}

/**
 * Boot-time unread count for chrome above the SQLite gate. Nest under the
 * product shell; the ready tree mounts `NotificationsUnreadCountLiveBridge`.
 */
export function NotificationsUnreadCountRoot(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [count, setCount] = createSignal(BOOT_NOTIFICATIONS_UNREAD_COUNT);
  return (
    <UnreadCountPublisherContext.Provider value={setCount}>
      <UnreadCountContext.Provider value={count}>
        {props.children}
      </UnreadCountContext.Provider>
    </UnreadCountPublisherContext.Provider>
  );
}
