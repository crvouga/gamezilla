import type { UntilTarget } from '@pkgs/dst';
import { isSimPollable } from '@pkgs/dst';

export type {
  NeverOpts,
  SimPollablePromise,
  UntilContext,
  UntilOpts,
  UntilTarget,
} from '@pkgs/dst';
export { isSimPollable, never, until } from '@pkgs/dst';

async function targetReady(target: UntilTarget): Promise<boolean> {
  if (typeof target === 'function') {
    return Boolean(await target());
  }
  if (isSimPollable(target)) {
    return target.__simPoll();
  }
  return false;
}

/** Predicate true when every target is ready. */
export function untilAll(...targets: UntilTarget[]): () => Promise<boolean> {
  return async () => {
    for (const t of targets) {
      if (!(await targetReady(t))) return false;
    }
    return true;
  };
}

/** Predicate true when any target is ready. */
export function untilAny(...targets: UntilTarget[]): () => Promise<boolean> {
  return async () => {
    for (const t of targets) {
      if (await targetReady(t)) return true;
    }
    return false;
  };
}
