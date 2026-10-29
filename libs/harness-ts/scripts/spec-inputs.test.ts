import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  specInputProblems,
  writeSpecInputs,
} from '@libs/harness-ts/spec-inputs';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'spec-inputs-'));
  for (const dir of ['apps', 'pkgs', 'libs/example', 'specs/example'])
    mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(
    join(root, 'libs/example/package.json'),
    JSON.stringify({
      specDomains: ['example'],
      specParts: 8,
    })
  );
  for (const name of ['first', 'second'])
    writeFileSync(
      join(root, `specs/example/${name}.feature`),
      `Feature: ${name}\n  Scenario: initial\n    Given a person\n`
    );
  return root;
}

function fingerprints(root: string): string[] {
  return Array.from({ length: 8 }, (_, i) =>
    readFileSync(
      join(root, `libs/example/.cache/spec-inputs/part-${i}.json`),
      'utf8'
    )
  );
}

// regression: ci-spec-edit-invalidates-unrelated-parts
test('an edit invalidates its owned part while unrelated spec verdicts remain reusable', () => {
  const root = fixture();
  try {
    writeSpecInputs(root);
    expect(specInputProblems(join(root, 'libs/example'), root)).toEqual([]);
    const before = fingerprints(root);
    writeFileSync(
      join(root, 'specs/example/first.feature'),
      'Feature: first\n  Scenario: changed\n    Given another person\n'
    );
    expect(specInputProblems(join(root, 'libs/example'), root)).toHaveLength(1);
    writeSpecInputs(root);
    const after = fingerprints(root);
    expect(after.filter((value, i) => value !== before[i])).toHaveLength(1);
    const affected = after.findIndex((value, i) => value !== before[i]);
    expect(
      (
        JSON.parse(after[affected]!) as { units: { path: string }[] }
      ).units.some((unit: { path: string }) =>
        unit.path.endsWith('first.feature')
      )
    ).toBe(true);
    writeSpecInputs(root);
    expect(fingerprints(root)).toEqual(after);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

// regression: ci-model-import-missing-from-spec-inputs
test('an imported model edit invalidates every part that consumes the model', () => {
  const root = fixture();
  try {
    const dir = join(root, 'specs/example');
    writeFileSync(join(dir, 'events.qnt'), 'module events { val amount = 1 }');
    writeFileSync(
      join(dir, 'model.qnt'),
      'module model { import events.* from "./events" }'
    );
    writeSpecInputs(root);
    const before = fingerprints(root);
    writeFileSync(join(dir, 'events.qnt'), 'module events { val amount = 2 }');
    writeSpecInputs(root);
    const after = fingerprints(root);
    for (const [i, value] of after.entries()) {
      const consumes = (
        JSON.parse(value) as { units: { path: string }[] }
      ).units.some((unit: { path: string }) => unit.path.endsWith('model.qnt'));
      expect(value !== before[i]).toBe(consumes);
    }
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});
