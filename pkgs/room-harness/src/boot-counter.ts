import { counterSystem } from './example-counter/system';
import { expectInSync } from './expect-in-sync';
import { addClient, type RoomArgs } from './scenario';

export type BootCounterOpts = {
  readonly seed?: number | bigint | string;
  readonly args?: Partial<RoomArgs>;
};

/** Counter script with named clients joined and inSync. */
export async function bootCounter(
  ids: readonly string[],
  opts?: BootCounterOpts
) {
  const s = await counterSystem.run({
    seed: opts?.seed ?? 42,
    args: opts?.args ?? {},
  });
  for (const id of ids) {
    await s.apply(addClient, { id });
  }
  await expectInSync(s);
  return s;
}
