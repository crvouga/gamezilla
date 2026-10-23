// @io-wall-ok — reads this package's turbo.json.
/**
 * The closed-world and mutation tests read the conformance manifest and the
 * decision tables from the repository's specs/ (`specs.ts`). Turbo reruns
 * the package's tests only when a declared input changes, so those specs are
 * the `test` task's inputs: moving or editing a decision table reruns them
 * instead of replaying a stale pass.
 */
import { expect, test } from 'bun:test';
import { join } from 'node:path';

type TurboConfig = {
  readonly tasks: Readonly<
    Record<string, { readonly inputs?: readonly string[] }>
  >;
};

// regression: permissions-harness-spec-inputs-unhashed
test('the specs the permission tests read are inputs of their test task', async () => {
  const config = (await Bun.file(
    join(import.meta.dir, '../turbo.json')
  ).json()) as TurboConfig;
  expect(config.tasks['test']?.inputs).toEqual(
    expect.arrayContaining([
      '$TURBO_EXTENDS$',
      '$TURBO_ROOT$/specs/conformance.yaml',
      '$TURBO_ROOT$/specs/*/*.dmn',
    ])
  );
});
