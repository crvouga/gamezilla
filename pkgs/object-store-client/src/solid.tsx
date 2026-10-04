/** @jsxImportSource solid-js */
import { defineContext } from '@pkgs/solid-context-client/define-context';
import type { JSX, ParentProps } from 'solid-js';

import type { ObjectStore } from '@pkgs/object-store-shared/interface';

const ObjectStoreContext = defineContext<ObjectStore>('ObjectStore');

export type ObjectStoreProviderProps = ParentProps<{
  readonly value: ObjectStore;
}>;

/**
 * Mounts the platform {@link ObjectStore} (e.g. `@pkgs/object-store-opfs-shared` on
 * the web) once near the app root. Consumers read it via {@link useObjectStore}.
 */
export const ObjectStoreProvider: (
  props: ObjectStoreProviderProps
) => JSX.Element = ObjectStoreContext.Provider;

export function useObjectStore(): ObjectStore {
  return ObjectStoreContext.use();
}
