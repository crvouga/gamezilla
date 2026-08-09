import { createContext, type ReactNode, useContext, useMemo } from 'react';

import {
  type CreateId,
  cryptoCreateId,
  mathRandom,
  type Random,
} from './create-id';

export type IdContextValue = {
  readonly createId: CreateId;
  readonly random: Random;
};

const Ctx = createContext<IdContextValue | null>(null);

export type IdProviderProps = {
  readonly children: ReactNode;
  readonly createId?: CreateId;
  readonly random?: Random;
};

/**
 * Injects {@link CreateId} (+ optional {@link Random}) for the React tree.
 */
export function IdProvider({
  children,
  createId,
  random,
}: IdProviderProps): ReactNode {
  const value = useMemo<IdContextValue>(
    () => ({
      createId: createId ?? cryptoCreateId,
      random: random ?? mathRandom,
    }),
    [createId, random]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIdContext(): IdContextValue {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useIdContext: IdProvider missing — wrap the tree with IdProvider'
    );
  }
  return v;
}

export function useCreateId(): CreateId {
  return useIdContext().createId;
}

export function useRandom(): Random {
  return useIdContext().random;
}
