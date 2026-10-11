/** @jsxImportSource solid-js */
/**
 * Provider tree mounted once the identity-scoped engine is ready. Loaded
 * lazily by `sync-engine-boot.tsx` (with the engine) because
 * `@pkgs/sync-engine/solid` pulls the mutation client and its SQL AST parser,
 * which must stay out of the initial chunk.
 *
 * Sub session providers (space rooms, leave/end modals, notifications,
 * profile) live here rather than in the outer shell, so the entry graph does
 * not static-import mutation hubs / dicebear.
 */

import { AuthModalsProvider } from '@libs/auth-client/auth-modals-provider';
import { AuthSyncBridge } from '@libs/auth-client/auth-sync-bridge';
import { MutationClientProvider } from '@libs/auth-client/mutation-client-provider';
import { SqlClientProvider } from '@pkgs/sql-client-root-client/solid';
import {
  SyncEnginePaintGateProvider,
  SyncEngineProvider,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { type JSX, untrack } from 'solid-js';
import { AppClientConfig } from './app-client-config';
import { AppSignInCapabilities } from './app-sign-in-capabilities';
import { useAppSubs } from './app-subs-context';
import { AppUiProvider } from './app-ui-provider';
import type { ReadySyncEngine } from './create-sync-engine-boot-state';
import { DeviceEntityBootstrap } from './device-bootstrap';
import { SyncLocalDataActions } from './local-data-actions';
import { SyncStatusLiveBridge } from './sync-status-context';

function SyncStatusBridge(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const engine = useSyncEngine();
  return (
    <SyncStatusLiveBridge status={engine.status}>
      {props.children}
    </SyncStatusLiveBridge>
  );
}

/**
 * Shell session scaffolding, then whatever the composed subs contribute.
 * Sub providers nest in sub order, so a later sub may read an
 * earlier one's context and the order is the composition root's to choose.
 */
function SessionSubProviders(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const subs = useAppSubs();
  return (
    <SyncLocalDataActions>
      <DeviceEntityBootstrap>
        <subs.Session>{props.children}</subs.Session>
      </DeviceEntityBootstrap>
    </SyncLocalDataActions>
  );
}

export type ReadyEngineTreeProps = {
  readonly ready: ReadySyncEngine;
  readonly userId: string;
  readonly deviceId: string;
  readonly paintReady: () => boolean;
  readonly children: JSX.Element;
};

export default function ReadyEngineTree(
  props: ReadyEngineTreeProps
): JSX.Element {
  // Keyed per engine by the parent `<Match keyed>`: static for this instance.
  const ready = untrack(() => props.ready);
  return (
    <SyncEnginePaintGateProvider ready={props.paintReady}>
      <SyncEngineProvider value={ready.engine}>
        <SyncStatusBridge>
          <SqlClientProvider value={ready.engine.db}>
            <AuthSyncBridge>
              <MutationClientProvider registry={ready.registry}>
                <AppSignInCapabilities>
                  {/* Sign-in modal needs the outer AppUiPortals surface
                        stack plus this session chrome (palette / banners). */}
                  <AppUiProvider>
                    <AuthModalsProvider>
                      <AppClientConfig>
                        <SessionSubProviders>
                          {props.children}
                        </SessionSubProviders>
                      </AppClientConfig>
                    </AuthModalsProvider>
                  </AppUiProvider>
                </AppSignInCapabilities>
              </MutationClientProvider>
            </AuthSyncBridge>
          </SqlClientProvider>
        </SyncStatusBridge>
      </SyncEngineProvider>
    </SyncEnginePaintGateProvider>
  );
}
