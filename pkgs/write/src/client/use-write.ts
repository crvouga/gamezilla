import type { AsyncStatus } from '@pkgs/async/use-async';
import { useAsync } from '@pkgs/async/use-async';
import { useCallback, useRef } from 'react';

import type { WriteDefinition } from '../shared/define-write';
import type { WriteContext } from '../shared/write-context';
import {
  failureToError,
  unwrap,
  type WriteError,
  type WriteFailure,
} from '../shared/write-result';
import type { WriteStore } from '../shared/write-store';
import { runWrite } from '../shared/run-write';

export type MutationPhase = 'idle' | 'loading' | 'success' | 'error';

export type UseWriteOptions = {
  readonly getContext: () => WriteContext;
  readonly getStore: () => WriteStore;
  readonly mapError?: (failure: WriteFailure) => string;
};

function phaseFromStatus(status: AsyncStatus): MutationPhase {
  if (status === 'running') return 'loading';
  if (status === 'success') return 'success';
  if (status === 'error') return 'error';
  return 'idle';
}

export function useWrite<TInput, TOutput>(
  write: WriteDefinition<TInput, TOutput>,
  options: UseWriteOptions
) {
  const getContextRef = useRef(options.getContext);
  const getStoreRef = useRef(options.getStore);
  getContextRef.current = options.getContext;
  getStoreRef.current = options.getStore;

  const async = useAsync<TOutput, [TInput]>({
    operation: async (_ctx, input) => {
      const result = await runWrite({
        write,
        ctx: getContextRef.current(),
        rawInput: input,
        store: getStoreRef.current(),
        mode: 'full',
      });
      return unwrap(result);
    },
  });

  const run = useCallback((input: TInput) => async.run(input), [async]);

  const error: WriteError | null =
    async.error !== null && async.error.name === 'WriteError'
      ? (async.error as WriteError)
      : null;

  const mapErrorMessage =
    error !== null && options.mapError !== undefined
      ? options.mapError({
          ok: false,
          code: error.code,
          message: error.message,
          ...(error.meta !== undefined ? { meta: error.meta } : {}),
        })
      : null;

  return {
    run,
    phase: phaseFromStatus(async.status),
    error,
    reset: async.reset,
    mapErrorMessage,
  };
}

export { failureToError };
