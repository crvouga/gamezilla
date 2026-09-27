/**
 * The seed a model's traces are drawn from — the seed policy of
 * `@pkgs/property`, as the hex string Quint takes: `FC_SEED` (default
 * `424242`) on every machine, so a verdict is a function of the code; any
 * seed under `PBT_RANDOM=1` (`bun run test:pbt:random`), which the test
 * names print, so a find replays with `FC_SEED=<that seed>`.
 */

const DEFAULT_SEED = 424_242;

export function quintSeed(): string {
  if (process.env['PBT_RANDOM'] === '1') {
    const [draw = 0] = crypto.getRandomValues(new Uint32Array(1));
    return `0x${draw.toString(16)}`;
  }
  const raw = process.env['FC_SEED'];
  const seed = raw !== undefined && raw.length > 0 ? Number(raw) : DEFAULT_SEED;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error(`quint: FC_SEED=${String(raw)} is not a whole number`);
  }
  return `0x${seed.toString(16)}`;
}
