/** @jsxImportSource solid-js */
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { CreateId, Random } from '@pkgs/uuid-shared-ts/create-id';
import type { JSX, ParentProps } from 'solid-js';

export type IdContextValue = {
  readonly createId: CreateId;
  readonly random: Random;
};

const IdContext = defineContext<IdContextValue>('Id');

export type IdProviderProps = ParentProps<IdContextValue>;

/**
 * Injects {@link CreateId} + {@link Random} for the Solid tree.
 * Both are required — construct at a composition root.
 */
export function IdProvider(props: IdProviderProps): JSX.Element {
  return (
    <IdContext.Provider value={props}>{props.children}</IdContext.Provider>
  );
}

export function useIdContext(): IdContextValue {
  return IdContext.use();
}

export function useCreateId(): CreateId {
  return IdContext.use().createId;
}

export function useRandom(): Random {
  return IdContext.use().random;
}
