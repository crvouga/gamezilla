/** @jsxImportSource solid-js */
/**
 * Spaces' session tree: the open-room registry every space screen and the
 * miniplayer read, and the leave / end confirmations that outlive the screen
 * that opened them.
 *
 * Loaded with the sync engine, not with the shell entry — everything here
 * pulls room and mutation graphs.
 */

import type { JSX } from 'solid-js';

import { EndSpaceModalProvider } from './end-space-modal-provider';
import { LeaveSpaceModalProvider } from './leave-space-modal-provider';
import { ReconcileEndedOpenSessions } from './reconcile-ended-open-sessions';
import { SpaceGameSessionEffects } from './space-game-session-effects';
import { AppSpaceRoomsProvider } from './space-rooms-provider';

export default function SpacesSession(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <>
      <ReconcileEndedOpenSessions />
      <AppSpaceRoomsProvider>
        <SpaceGameSessionEffects />
        <EndSpaceModalProvider>
          <LeaveSpaceModalProvider>{props.children}</LeaveSpaceModalProvider>
        </EndSpaceModalProvider>
      </AppSpaceRoomsProvider>
    </>
  );
}
