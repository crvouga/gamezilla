// @io-wall-ok — compiler fixtures use isolated temporary directories.
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheValueParameters } from '@pkgs/quint-server/cache-value-parameters';
import { typecheck } from '@pkgs/quint-server/typecheck';
import { verify } from '@pkgs/quint-server/verify';

const SOURCE = `module counter {
  var state: { count: int }
  action init = state' = { count: 0 }
  action step = state' = { count: state.count + (state.count - state.count) + 1 }
  val invAtMostOne = state.count <= 1
  pure def shadow(state: { count: int }): int = state.count + state.count
}`;

// regression: product-symbolic-model-compilation-timeout
test('operators share the same pre-state field without duplicating its projection', () => {
  const source = `module shared {
    var state: { count: int }
    action init = state' = { count: 0 }
    val twice = state.count + state.count
    action step = state' = { count: state.count + state.count + 1 }
    val invConsistent = twice == state.count * 2
  }`;
  const cached = cacheValueParameters(source);
  expect(cached.match(/state\.count/g)).toHaveLength(1);
  expect(cacheValueParameters(cached)).toBe(cached);
  const dir = mkdtempSync(join(tmpdir(), 'quint-shared-state-'));
  try {
    const path = join(dir, 'shared.qnt');
    writeFileSync(path, cached);
    expect(typecheck(path)).toEqual({ ok: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// regression: product-symbolic-model-compilation-timeout
test('repeated pre-state projections are shared without capturing shadowed parameters', () => {
  const cached = cacheValueParameters(SOURCE);
  expect(cached).toContain('val cached_state_');
  expect(cached.match(/state\.count/g)).toHaveLength(2);
  expect(cacheValueParameters(cached)).toBe(cached);
  const dir = mkdtempSync(join(tmpdir(), 'quint-cached-state-'));
  try {
    const path = join(dir, 'counter.qnt');
    writeFileSync(path, cached);
    expect(typecheck(path)).toEqual({ ok: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('shared pre-state projections preserve a violating mixed-state transition', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quint-state-counterexample-'));
  try {
    const path = join(dir, 'counter.qnt');
    writeFileSync(path, SOURCE);
    const result = await verify({
      specPath: path,
      invariants: ['invAtMostOne'],
      maxSteps: 2,
      inferPolymorphicTypes: false,
      outDir: join(dir, 'proof'),
      timeoutMs: 120_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('The violating transition was lost.');
    expect(result.output).toContain('found a counterexample');
    expect(result.output).toContain('count: 2');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120_000);
