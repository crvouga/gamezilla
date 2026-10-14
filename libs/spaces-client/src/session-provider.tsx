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
import { HostingLimitInviteProvider } from './hosting-limit-invite';
import { LeaveSpaceModalProvider } from './leave-space-modal-provider';
import { MeetHostedSpaces } from './meet-hosted-spaces';
import { ReconcileEndedOpenSessions } from './reconcile-ended-open-sessions';
import { SpaceGameSessionEffects } from './space-game-session-effects';
import { SpacePresenceProbe } from './space-presence-probe';
import { AppSpaceRoomsProvider } from './space-rooms-provider';

export default function SpacesSession(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <>
      <ReconcileEndedOpenSessions />
      <AppSpaceRoomsProvider>
        <HostingLimitInviteProvider>
          <MeetHostedSpaces />
          <SpacePresenceProbe />
          <SpaceGameSessionEffects />
          <EndSpaceModalProvider>
            <LeaveSpaceModalProvider>{props.children}</LeaveSpaceModalProvider>
          </EndSpaceModalProvider>
        </HostingLimitInviteProvider>
      </AppSpaceRoomsProvider>
    </>
  );
}
