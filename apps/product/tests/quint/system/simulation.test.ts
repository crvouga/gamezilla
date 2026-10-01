import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { typecheck } from '@pkgs/quint/typecheck';
import {
  CLI_TIMEOUT_MS,
  MODEL_DIR,
  MODELS,
  modelPath,
} from './campaign-config';
import { examples, obligation, sample } from './campaign-tools';

describe('composed product verification abstractions', () => {
  test(
    'every module type checks',
    () => {
      const files = readdirSync(MODEL_DIR).filter((path) =>
        path.endsWith('.qnt')
      );
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
      const todo = [...roots];
      const reachable = new Set<string>();
      for (let file = todo.pop(); file; file = todo.pop()) {
        if (reachable.has(file)) continue;
        reachable.add(file);
        todo.push(...(imports.get(file) ?? []));
      }
      // An unreachable import cycle must fail instead of silently checking nothing.
      expect([...reachable].sort()).toEqual([...files].sort());
      // Checking roots checks their complete transitive imports. Avoid starting
      // the CLI again for every shared module already checked through a root.
      for (const file of roots) {
        const result = typecheck(modelPath(file.slice(0, -4)));
        expect(result, file).toMatchObject({ ok: true });
      }
    },
    CLI_TIMEOUT_MS
  );

  for (const model of MODELS) {
    test(
      `${model.name}: seeded adversarial safety exploration`,
      async () => {
        await obligation(model.name, 'campaign-simulation', () =>
          sample(model.name, model.samples, model.steps)
        );
      },
      CLI_TIMEOUT_MS
    );
  }

  for (const name of [
    'adversarial-examples',
    'recovery',
    'boundary-assumptions',
    'notification-machine',
  ]) {
    test(
      `${name}: literal counterexample guards execute`,
      async () => {
        await obligation(name, 'campaign-examples', () => examples(name));
      },
      CLI_TIMEOUT_MS
    );
  }
});
