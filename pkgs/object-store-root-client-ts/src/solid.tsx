/** @jsxImportSource solid-js */

import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { JSX, ParentProps } from 'solid-js';

const ObjectStoreContext = defineContext<ObjectStore>('ObjectStore');

export type ObjectStoreProviderProps = ParentProps<{
  readonly value: ObjectStore;
}>;

/**
 * Mounts the platform {@link ObjectStore} (e.g. `@pkgs/object-store-opfs-shared-ts` on
 * the web) once near the app root. Consumers read it via {@link useObjectStore}.
 */
export const ObjectStoreProvider: (
  props: ObjectStoreProviderProps
) => JSX.Element = ObjectStoreContext.Provider;

export function useObjectStore(): ObjectStore {
  return ObjectStoreContext.use();
}
