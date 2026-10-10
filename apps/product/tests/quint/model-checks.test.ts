import { test } from 'bun:test';
import { join } from 'node:path';
import { verifyTemporal } from '@pkgs/quint-server/temporal';
import { verify } from '@pkgs/quint-server/verify';
import {
  CLI_TIMEOUT_MS,
  MODELS,
  modelPath,
  REPORT_DIR,
} from './campaign-config';
import { obligation } from './campaign-tools';
import { withSymbolicInput } from './symbolic-input';

// regression: product-symbolic-model-compilation-timeout
for (const model of MODELS) {
  test.concurrent(
    `${model.name}: exhaustive symbolic safety through ${model.verifySteps} transitions`,
    async () => {
      await obligation(model.name, 'campaign-symbolic', () =>
        withSymbolicInput(model.name, async (path, bound) => {
          const result = await verify({
            specPath: path,
            invariants: ['invSafety'],
            maxSteps: model.verifySteps,
            inferPolymorphicTypes: true,
            outDir: join(REPORT_DIR, model.name),
            timeoutMs: CLI_TIMEOUT_MS,
          });
          if (!result.ok) throw new Error(result.output);
          return `Apalache exhaustive bounded safety, depth ${model.verifySteps}; ${result.durationMs} ms. Not unbounded liveness or production conformance. ${bound}`;
        })
      );
    },
    CLI_TIMEOUT_MS + 5_000
  );
}

test.concurrent(
  'fair recovery: complete finite temporal verification',
  async () => {
    await obligation(
      'fair-recovery',
      'temporal:eventualConvergence',
      async () => {
        const result = await verifyTemporal({
          specPath: modelPath('fair-recovery'),
          properties: ['eventualConvergence'],
          invariants: ['invSafety'],
          outDir: join(REPORT_DIR, 'fair-recovery-temporal'),
          timeoutMs: CLI_TIMEOUT_MS,
        });
        if (!result.ok) throw new Error(result.output);
        return `TLC complete finite graph: ${result.statesExplored} distinct states; weakly fair recovery after quiescence.`;
      }
    );
  },
  CLI_TIMEOUT_MS + 5_000
);

// @io-wall-ok — temporary verifier inputs exercise the temporal checker itself.
test.concurrent(
  'temporal verification detects starvation when fairness is removed',
  async () => {
    const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { expect } = await import('bun:test');
    const { MODEL_DIR } = await import('./campaign-config');
    const dir = mkdtempSync(join(tmpdir(), 'product-quint-unfair-'));
    try {
      cpSync(MODEL_DIR, dir, { recursive: true });
      const path = join(dir, 'fair-recovery.qnt');
      const source = readFileSync(path, 'utf8');
      const fair = '_fair.implies(always(frozen implies eventually(done)))';
      expect(source.split(fair)).toHaveLength(2);
      writeFileSync(
        path,
        source.replace(fair, 'always(frozen implies eventually(done))')
      );
      await obligation(
        'fair-recovery',
        'campaign-progress-sensitivity',
        async () => {
          const result = await verifyTemporal({
            specPath: path,
            properties: ['eventualConvergence'],
            outDir: join(dir, 'output'),
            timeoutMs: CLI_TIMEOUT_MS,
          });
          expect(result.ok).toBe(false);
          if (result.ok) throw new Error('Starvation was not detected.');
          expect(result.output).toMatch(
            /temporal.*violated|temporal.*violation/i
          );
          return 'Removing weak fairness produces a temporal counterexample; a parser error or timeout is not accepted.';
        }
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  CLI_TIMEOUT_MS + 5_000
);
