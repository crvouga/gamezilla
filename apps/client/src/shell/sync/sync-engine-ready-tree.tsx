/** @jsxImportSource solid-js */
/**
 * Provider tree mounted once the identity-scoped engine is ready. Loaded
 * lazily by `sync-engine-boot.tsx` (with the engine) because
 * `@pkgs/sync-engine/solid` pulls the mutation client and its SQL AST parser,
 * which must stay out of the initial chunk.
 */

import { AuthModalsProvider } from '@libs/auth/public/auth-modals-provider';
import { MutationClientProvider } from '@libs/auth/public/mutation-client-provider';
import { AuthSyncBridge } from '@libs/auth/root/client/auth-sync-bridge';
import { SqlClientProvider } from '@pkgs/sql-client/solid';
import {
  SyncEnginePaintGateProvider,
  SyncEngineProvider,
  useSyncEngine,
} from '@pkgs/sync-engine/solid';
import { type JSX, untrack } from 'solid-js';
import { AppClientConfig } from '../providers/app-client-config';
import { AppSignInCapabilities } from '../providers/app-sign-in-capabilities';
import { AppUiProvider } from '../providers/app-ui-provider';

import type { ReadySyncEngine } from './create-sync-engine-boot-state';
import { SyncStatusProvider } from './sync-status-context';

function SyncStatusBridge(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const engine = useSyncEngine();
  return (
    <SyncStatusProvider value={engine.status}>
      {props.children}
    </SyncStatusProvider>
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
                  {/* UI hosts (surface stack, overlays, command palette) must
                      wrap the sign-in modal: surfaces throw without
                      SurfaceStackProvider. */}
                  <AppUiProvider>
                    <AuthModalsProvider>
                      <AppClientConfig>{props.children}</AppClientConfig>
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
