import { runWrite } from '../shared/run-write';
import type { WriteDefinition } from '../shared/define-write';
import type { WriteContext } from '../shared/write-context';
import { unwrap } from '../shared/write-result';
import type { WriteStore } from '../shared/write-store';

export async function runClientWrite<TInput, TOutput>(
  write: WriteDefinition<TInput, TOutput>,
  ctx: WriteContext,
  input: unknown,
  store: WriteStore
): Promise<TOutput> {
  const result = await runWrite({
    write,
    ctx,
    rawInput: input,
    store,
    mode: 'full',
  });
  return unwrap(result);
}
