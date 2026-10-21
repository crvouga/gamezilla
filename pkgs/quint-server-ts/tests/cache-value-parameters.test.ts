// @io-wall-ok — temporary model inputs exercise the actual Quint compiler.
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheValueParameters } from '@pkgs/quint-server-ts/cache-value-parameters';
import { typecheck } from '@pkgs/quint-server-ts/typecheck';
import { verify } from '@pkgs/quint-server-ts/verify';

// regression: quint-untyped-record-parameters-expanded
test('record field reads cache inferred values while operator parameters remain callable', () => {
  const source = `module inferred {
    pure def advance(view) = view.count + (view.count - view.count) + 1
    pure def applyTwice(transform, value) = transform(transform(value))
    pure val example = applyTwice(x => advance({ count: x }), 1)
  }`;
  const dir = mkdtempSync(join(tmpdir(), 'quint-inferred-record-'));
  const path = join(dir, 'inferred.qnt');
  try {
    const cached = cacheValueParameters(source);
    expect(cached).toContain('pure val view = cached_input_');
    // regression: quint-repeated-record-fields-inference
    expect(cached.match(/view\.count/g)).toHaveLength(1);
    expect(cached).toContain('applyTwice(transform, value)');
    expect(cacheValueParameters(cached)).toBe(cached);
    writeFileSync(path, cached);
    expect(typecheck(path)).toEqual({ ok: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// regression: quint-cached-sum-type-syntax
test('cached value parameters preserve sum constructors and local shadowing', () => {
  const source = `module choice {
    type Choice = Waiting | Selected(str)
    type View = { choice: Choice, count: int }
    pure def show(view: View): View = {
      val changed = { ...view, count: view.count + 1 }
      if (changed.count > 3) {
        val view = { choice: Waiting, count: 0 }
        view
      } else changed
    }
    pure val example = show({ choice: Selected("rival"), count: 1 })
  }`;
  const dir = mkdtempSync(join(tmpdir(), 'quint-cached-choice-'));
  const path = join(dir, 'choice.qnt');
  try {
    writeFileSync(path, source);
    expect(typecheck(path)).toEqual({ ok: true });
    const cached = cacheValueParameters(source);
    expect(cached).toContain('pure val view: View = cached_input_');
    expect(cacheValueParameters(cached)).toBe(cached);
    writeFileSync(path, cached);
    expect(typecheck(path)).toEqual({ ok: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cached verification retains imported rules and refutes the same violating step', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quint-cached-import-'));
  const specPath = join(dir, 'counter.qnt');
  try {
    writeFileSync(
      join(dir, 'rules.qnt'),
      `module rules {
      pure def advance(view: { count: int }): int = view.count + (view.count - view.count) + 1
    }`
    );
    writeFileSync(
      specPath,
      `module counter {
      import rules.* from "./rules"
      var count: int
      action init = count' = 0
      action step = count' = advance({ count: count })
      val invAtMostOne = count <= 1
    }`
    );
    const result = await verify({
      specPath,
      invariants: ['invAtMostOne'],
      maxSteps: 2,
      inferPolymorphicTypes: false,
      outDir: join(dir, 'proof'),
      timeoutMs: 120_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.output).toContain('found a counterexample');
    expect(result.output).toContain('[State 2] { count: 2 }');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120_000);
