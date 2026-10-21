/** @jsxImportSource solid-js */
/**
 * `ToastProvider` -- owns the app's toasts (see `useToast` in `./toast`)
 * and the viewport they appear in: bottom-center above the safe area on
 * compact layouts, bottom-start on wide ones, inside the overlay portal so
 * it floats above the page and open surfaces. Mount it once, inside the
 * clock, theme, localization and overlay providers.
 */

import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client/solid';
import { componentId } from '@pkgs/ui-root-shared/component-id';
import {
  enqueueToast,
  removeToast,
  TOAST_EXIT_MS,
} from '@pkgs/ui-root-shared/toast-queue';
import { createSignal, For, type JSX, onCleanup } from 'solid-js';
import { spaced } from './layout-classes';
import { OverlayPortal } from './overlay-portal';
import type { ToastApi, ToastOptions } from './toast';
import { ToastCard, ToastContext } from './toast';
import styles from './toast.module.css';
import { useLayoutMode } from './use-layout-mode';

type ToastEntry = { readonly id: string; readonly options: ToastOptions };

export type ToastProviderProps = {
  children: JSX.Element;
};

function createToastStore() {
  const timers = useTimers();
  const [entries, setEntries] = createSignal<readonly ToastEntry[]>([]);
  const [leaving, setLeaving] = createSignal<ReadonlySet<string>>(new Set());
  const pending = new Set<unknown>();
  let counter = 0;
  const setLeavingId = (id: string, on: boolean): void => {
    setLeaving((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const api: ToastApi = {
    show: (options) => {
      counter += 1;
      const id = options.id ?? `toast-${counter}`;
      setLeavingId(id, false);
      setEntries((list) => enqueueToast(list, { id, options }));
      return id;
    },
    dismiss: (id) => {
      if (!entries().some((entry) => entry.id === id)) return;
      if (leaving().has(id)) return;
      setLeavingId(id, true);
      const handle = timers.setTimeout(() => {
        pending.delete(handle);
        setEntries((list) => removeToast(list, id));
        setLeavingId(id, false);
      }, TOAST_EXIT_MS);
      pending.add(handle);
    },
  };
  onCleanup(() => {
    for (const handle of pending) timers.clearTimeout(handle);
  });
  return { api, entries, leaving };
}

export function ToastProvider(props: ToastProviderProps): JSX.Element {
  const { t } = useLingui();
  const store = createToastStore();
  const mode = useLayoutMode();
  return (
    <ToastContext.Provider value={store.api}>
      {props.children}
      <OverlayPortal>
        <div
          class={spaced([
            'box absolute inset-x-0 bottom-0 boxNone gap-ui-sm px-ui-lg',
            mode() === 'wide' ? 'items-start' : 'items-center',
            styles['viewport'],
          ])}
          data-component={componentId('ToastViewport')}
          role="region"
          aria-label={t`Notifications`}
        >
          <For each={store.entries()}>
            {(entry) => (
              <ToastCard
                options={entry.options}
                leaving={store.leaving().has(entry.id)}
                onDismiss={() => store.api.dismiss(entry.id)}
              />
            )}
          </For>
        </div>
      </OverlayPortal>
    </ToastContext.Provider>
  );
}
