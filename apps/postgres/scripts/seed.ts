/**
 * Local-dev seed orchestrator. Invoked after migrate on `@apps/postgres` boot.
 * Register lightweight seed steps here; keep heavy seeds (e.g. chess puzzles)
 * as explicit manual scripts.
 */
import { LOCAL_DATABASE_URL } from './ports';

export type LocalSeedStep = {
  readonly name: string;
  readonly run: () => Promise<void>;
};

const STEPS: readonly LocalSeedStep[] = [
  // Add local seed steps here, e.g.:
  // { name: 'demo-fixtures', run: async () => { … } },
];

export async function runLocalSeed(): Promise<void> {
  process.stdout.write(
    `[postgres] seed start (${String(STEPS.length)} step(s)) ${LOCAL_DATABASE_URL}\n`
  );
  for (const step of STEPS) {
    process.stdout.write(`[postgres] seed: ${step.name}…\n`);
    await step.run();
  }
  process.stdout.write('[postgres] seed complete\n');
}

if (import.meta.main) {
  await runLocalSeed();
}
