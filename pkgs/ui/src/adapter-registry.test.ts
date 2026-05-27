/**
 * Boot-time `switch (UI_IMPL)` should resolve to a fully-populated UIAdapter
 * regardless of which key was selected. heroUIAdapter is currently empty
 * (Partial<UIAdapter>), so the spread merge must fall through to
 * inhouseAdapter for every slot.
 *
 * The test reads the source files instead of importing them at runtime
 * because executing the adapter modules requires React Native's JSX/Flow
 * loader (the same reason scripts/check-ui-adapter-conformance.ts is a
 * static parser).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const SRC_DIR = join(import.meta.dirname);

function readSlots(file: string, preamble: string): string[] {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf(preamble);
  const braceStart = source.indexOf('{', start);
  const braceEnd = source.indexOf('}', braceStart);
  const body = source.slice(braceStart + 1, braceEnd);
  const slots: string[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('//')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*[:,]/.exec(line);
    if (match?.[1]) slots.push(match[1]);
  }
  return slots;
}

describe('adapter-registry', () => {
  const portSlots = readSlots(
    join(SRC_DIR, 'ports/ui-adapter.ts'),
    'export interface UIAdapter'
  );
  const inhouseSlots = readSlots(
    join(SRC_DIR, 'adapters/inhouse/index.ts'),
    'export const inhouseAdapter'
  );
  const herouiSlots = readSlots(
    join(SRC_DIR, 'adapters/heroui/index.ts'),
    'export const heroUIAdapter'
  );

  test('UIAdapter has at least one slot', () => {
    expect(portSlots.length).toBeGreaterThan(0);
  });

  test('inhouseAdapter covers every UIAdapter slot', () => {
    const missing = portSlots.filter((s) => !inhouseSlots.includes(s));
    expect(missing).toEqual([]);
  });

  test('heroUIAdapter slots are all valid UIAdapter slots', () => {
    const portSet = new Set(portSlots);
    const stray = herouiSlots.filter((s) => !portSet.has(s));
    expect(stray).toEqual([]);
  });

  test('public index re-exports every UIAdapter slot', () => {
    const indexSlots = readSlots(join(SRC_DIR, 'index.ts'), 'export const {');
    const missing = portSlots.filter((s) => !indexSlots.includes(s));
    expect(missing).toEqual([]);
  });
});
