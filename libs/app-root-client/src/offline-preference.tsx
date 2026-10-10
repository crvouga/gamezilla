/** @jsxImportSource solid-js */
import { defineContext } from '@pkgs/solid-context-client/define-context';
import {
  type Accessor,
  createSignal,
  type JSX,
  onCleanup,
  untrack,
} from 'solid-js';
import type { OfflineNetworkController } from './offline-network-controller';

export type OfflinePreference = {
  readonly offline: Accessor<boolean>;
  readonly setOffline: (offline: boolean) => void;
};

const OfflinePreferenceContext =
  defineContext<OfflinePreference>('OfflinePreference');

export function OfflinePreferenceProvider(props: {
  readonly controller: OfflineNetworkController;
  readonly children: JSX.Element;
}): JSX.Element {
  const controller = untrack(() => props.controller);
  const [offline, setOfflineState] = createSignal(controller.isOffline());
  const stop = controller.subscribe(setOfflineState);
  onCleanup(stop);
  const value: OfflinePreference = {
    offline,
    setOffline: controller.setOffline,
  };
  return (
    <OfflinePreferenceContext.Provider value={value}>
      {props.children}
    </OfflinePreferenceContext.Provider>
  );
}

export function useOfflinePreference(): OfflinePreference {
  return OfflinePreferenceContext.use();
}
