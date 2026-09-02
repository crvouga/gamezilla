import type { Action } from '../harness/actions';
import type { AnyScenarioDef } from '../harness/define-scenario';
import { openWorld } from '../harness/world';
import type { JsonValue } from '../kernel/json';

export async function runEpisode(args: {
  readonly scenario: AnyScenarioDef;
  readonly seed: number | bigint | string;
  readonly knobs: Record<string, JsonValue>;
  readonly actions: readonly Action[];
}): Promise<void> {
  const world = await openWorld(args.scenario as never, {
    seed: args.seed,
    knobs: args.knobs,
  });
  try {
    await world.apply(args.actions);
    await world.converge();
  } finally {
    await world.dispose();
  }
}

export async function deltaDebugShrink(args: {
  readonly scenario: AnyScenarioDef;
  readonly seed: number | bigint | string;
  readonly knobs: Record<string, JsonValue>;
  readonly actions: readonly Action[];
}): Promise<Action[]> {
  let current = [...args.actions];

  const stillFails = async (candidate: readonly Action[]): Promise<boolean> => {
    try {
      await runEpisode({ ...args, actions: candidate });
      return false;
    } catch {
      return true;
    }
  };

  if (!(await stillFails(current))) return current;

  let changed = true;
  while (changed && current.length > 1) {
    changed = false;
    for (
      let len = Math.max(1, Math.floor(current.length / 2));
      len >= 1;
      len -= 1
    ) {
      for (let start = 0; start + len <= current.length; start += 1) {
        const candidate = [
          ...current.slice(0, start),
          ...current.slice(start + len),
        ];
        if (await stillFails(candidate)) {
          current = candidate;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return current;
}
