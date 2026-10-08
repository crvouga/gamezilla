// @io-wall-ok — temporary model inputs exercise the actual Quint compiler.
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheValueParameters } from '@pkgs/quint-server/cache-value-parameters';
import { typecheck } from '@pkgs/quint-server/typecheck';
import { verify } from '@pkgs/quint-server/verify';

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
      pure def advance(view: { count: int }): int = view.count + 1
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
