#!/usr/bin/env bun
/**
 * Fail-fast guardrail: every `@pkgs/ui` adapter must conform to the
 * `UIAdapter` port contract.
 *
 *   - `inhouseAdapter` must implement every slot in `UIAdapter`.
 *   - `heroUIAdapter` is `Partial<UIAdapter>` -- it may omit slots (the
 *     boot-time switch spreads it on top of `inhouseAdapter` so missing
 *     slots fall through). But it MUST NOT export keys that aren't in
 *     `UIAdapter`, otherwise we'd silently expose adapter-specific
 *     primitives through the public surface.
 *
 * TypeScript already catches drift via the typed `const` declarations in
 * each adapter (`inhouseAdapter: UIAdapter`, `heroUIAdapter: Partial<UIAdapter>`).
 * This script is the runtime backstop, implemented as a static parser
 * (executing the adapter modules in Bun would require an RN/Flow loader).
 * It catches mistakes TypeScript can't, e.g. an extra key shoved into an
 * adapter via spread, or a slot removed from `UIAdapter` that nobody
 * cleaned up.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const PORTS_FILE = join(REPO_ROOT, 'pkgs/ui/src/ports/ui-adapter.ts');
const INHOUSE_FILE = join(REPO_ROOT, 'pkgs/ui/src/adapters/inhouse/index.ts');
const HEROUI_FILE = join(REPO_ROOT, 'pkgs/ui/src/adapters/heroui/index.ts');

function readObjectMemberKeys(
  filePath: string,
  preamble: string
): readonly string[] {
  const source = readFileSync(filePath, 'utf8');
  const start = source.indexOf(preamble);
  if (start < 0) {
    throw new Error(
      `check:ui-adapter-conformance: cannot find "${preamble}" in ${relative(REPO_ROOT, filePath)}`
    );
  }
  const braceStart = source.indexOf('{', start);
  const braceEnd = source.indexOf('}', braceStart);
  if (braceStart < 0 || braceEnd < 0) {
    throw new Error(
      `check:ui-adapter-conformance: malformed block after "${preamble}" in ${relative(REPO_ROOT, filePath)}`
    );
  }
  const body = source.slice(braceStart + 1, braceEnd);
  const keys: string[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('//')) continue;
    // `Foo: typeof Inhouse.Foo;` (port) or `Foo,` (adapter shorthand) or
    // `Foo: SomeValue,` (adapter renamed).
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*[:,]/.exec(line);
    if (match?.[1]) keys.push(match[1]);
  }
  return keys;
}

type Violation = { adapter: string; kind: 'missing' | 'extra'; key: string };

function diff(
  adapterName: string,
  adapterKeys: readonly string[],
  expectedSlots: readonly string[],
  options: { partial: boolean }
): Violation[] {
  const violations: Violation[] = [];
  const expected = new Set(expectedSlots);
  const actual = new Set(adapterKeys);

  if (!options.partial) {
    for (const slot of expected) {
      if (!actual.has(slot)) {
        violations.push({ adapter: adapterName, kind: 'missing', key: slot });
      }
    }
  }
  for (const key of actual) {
    if (!expected.has(key)) {
      violations.push({ adapter: adapterName, kind: 'extra', key });
    }
  }
  return violations;
}

function main(): never {
  const slots = readObjectMemberKeys(PORTS_FILE, 'export interface UIAdapter');
  if (slots.length === 0) {
    console.error(
      `check:ui-adapter-conformance: extracted zero UIAdapter slots from ${relative(REPO_ROOT, PORTS_FILE)}; aborting.`
    );
    process.exit(1);
  }

  const inhouseKeys = readObjectMemberKeys(
    INHOUSE_FILE,
    'export const inhouseAdapter'
  );
  // heroUIAdapter may be empty (`{}`) in Phase 1; readObjectMemberKeys returns []
  // for an empty block which is the correct conformance for a Partial adapter.
  let herouiKeys: readonly string[];
  try {
    herouiKeys = readObjectMemberKeys(
      HEROUI_FILE,
      'export const heroUIAdapter'
    );
  } catch (err) {
    console.error(
      `check:ui-adapter-conformance: could not parse heroUIAdapter — ${(err as Error).message}`
    );
    process.exit(1);
  }

  const violations: Violation[] = [
    ...diff('inhouseAdapter', inhouseKeys, slots, { partial: false }),
    ...diff('heroUIAdapter', herouiKeys, slots, { partial: true }),
  ];

  if (violations.length === 0) {
    console.log(
      `check:ui-adapter-conformance OK — ${slots.length} ports; inhouseAdapter covers all, heroUIAdapter has ${herouiKeys.length} overrides.`
    );
    process.exit(0);
  }

  console.error(
    `check:ui-adapter-conformance FAILED — ${violations.length} violation(s):`
  );
  for (const v of violations) {
    if (v.kind === 'missing') {
      console.error(
        `  - ${v.adapter}: missing required slot "${v.key}" (declared by UIAdapter but not implemented)`
      );
    } else {
      console.error(
        `  - ${v.adapter}: exports "${v.key}" which is not part of UIAdapter (add the slot to ports/ui-adapter.ts or remove it from the adapter)`
      );
    }
  }
  console.error(
    '\nFix by aligning pkgs/ui/src/adapters/<adapter>/index.ts with pkgs/ui/src/ports/ui-adapter.ts.'
  );
  process.exit(1);
}

main();
