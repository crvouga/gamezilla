import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  CLI_TIMEOUT_MS,
  MODEL_DIR,
  MODELS,
  modelPath,
} from './campaign-config';
import { examples, obligation, quint, sample } from './campaign-tools';

const files = readdirSync(MODEL_DIR)
  .filter((path) => path.endsWith('.qnt'))
  .sort();
const imports = new Map(
  files.map((file) => [
    file,
    [
      ...readFileSync(modelPath(file.slice(0, -4)), 'utf8').matchAll(
        /from "\.\/([^"\n]+)"/g
      ),
    ].map((match) => `${basename(match[1]!)}.qnt`),
  ])
);
const imported = new Set([...imports.values()].flat());
const roots = files.filter((path) => !imported.has(path));
const EXAMPLE_MODELS = [
  'adversarial-examples',
  'recovery',
  'boundary-assumptions',
  'notification-machine',
] as const;
// `quint run` and `quint test` typecheck their module and its transitive
// imports and fail on a type error, exactly like `quint typecheck`. A root
// already simulated or tested is compiled there; typechecking it again only
// repeats that work, so the standalone typecheck covers the rest.
const compiledByRun = new Set<string>([
  ...MODELS.map((model) => `${model.name}.qnt`),
  ...EXAMPLE_MODELS.map((name) => `${name}.qnt`),
]);
const typecheckOnly = roots.filter((file) => !compiledByRun.has(file));

describe('composed product verification abstractions', () => {
  test('every module is reached by a checked root', () => {
    const todo = [...roots];
    const reachable = new Set<string>();
    for (let file = todo.pop(); file; file = todo.pop()) {
      if (reachable.has(file)) continue;
      reachable.add(file);
      todo.push(...(imports.get(file) ?? []));
    }
    // An unreachable import cycle must fail instead of silently checking nothing.
    expect([...reachable].sort()).toEqual(files);
    // regression: product-typecheck-batch-timeout
    expect(roots).toContain('adversarial-examples.qnt');
  });

  test('every root is compiled exactly once', () => {
    // regression: github-product-test-repeated-typecheck
    const compiled = [
      ...typecheckOnly,
      ...roots.filter((file) => compiledByRun.has(file)),
    ].sort();
    expect(compiled).toEqual([...roots].sort());
    expect(typecheckOnly.filter((file) => compiledByRun.has(file))).toEqual([]);
  });

  for (const file of typecheckOnly) {
    test.concurrent(
      `${file}: transitive modules type check`,
      async () => {
        // Checking roots checks their complete transitive imports. Avoid starting
        // the CLI again for every shared module already checked through a root.
        const result = await quint(['typecheck', modelPath(file.slice(0, -4))]);
        expect(result.status, `${file}: ${result.output}`).toBe(0);
      },
      CLI_TIMEOUT_MS
    );
  }

  for (const model of MODELS) {
    test.concurrent(
      `${model.name}: seeded adversarial safety exploration`,
      async () => {
        await obligation(model.name, 'campaign-simulation', () =>
          sample(model.name, model.samples, model.steps)
        );
      },
      CLI_TIMEOUT_MS
    );
  }

  for (const name of EXAMPLE_MODELS) {
    test.concurrent(
      `${name}: literal counterexample guards execute`,
      async () => {
        await obligation(name, 'campaign-examples', () => examples(name));
      },
      CLI_TIMEOUT_MS
    );
  }
});
