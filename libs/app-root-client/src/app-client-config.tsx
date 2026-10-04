/** @jsxImportSource solid-js */
import { useClientConfig } from '@libs/app-config-client/use-client-config';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { createEffect, createMemo, type JSX } from 'solid-js';

/**
 * Live push needs the synced EMQX URL, which a fresh install / account DB
 * does not have when its engine connects. Attach push once it hydrates.
 */
export function AppClientConfig(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const engine = useSyncEngine();
  const { config } = useClientConfig();
  const emqxUrl = createMemo(() => config().emqx_wss_url?.trim() ?? '');
  createEffect(() => {
    if (emqxUrl().length > 0) engine.ensurePush();
  });
  return <>{props.children}</>;
}
