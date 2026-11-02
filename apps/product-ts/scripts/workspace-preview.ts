// @io-wall-ok — checkout-owned dynamic connector entry.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import { renameReplacing } from '@pkgs/fs-server-ts/rename-replacing';
import { stopChild } from './boot-stack';
import type { RunningService, ServiceContext } from './dev-services';
import { localProcessEnv } from './local-process-env';
import { quickPreviewCommand } from './preview-quick-command';
import { quickPreviewReady } from './preview-quick-readiness';
import { observeChildFailures } from './process-observability';
import type { StackServices } from './stack-services';
import { previewOriginPath } from './workspace-preview-runtime';
import {
  localWorkspacePreviewScope,
  previewDeveloperEmails,
  workspacePreviewKey,
} from './workspace-preview-scope';

export async function startWorkspacePreview(
  context: ServiceContext
): Promise<RunningService<StackServices['preview']> | null> {
  if (context.plan.options.instanceId !== 'dev') return null;
  const emails = previewDeveloperEmails(context.repoRoot);
  const web = await context.need('web');
  if (web === null)
    throw new Error('Preview requires this checkout’s web listener');
  const workspaceKey = workspacePreviewKey(
    localWorkspacePreviewScope(context.repoRoot, 'dev')
  );
  const dir = join(context.plan.dataDir, 'preview');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const configPath = join(dir, 'quick-config.json');
  const originPath = previewOriginPath(context.plan.dataDir);
  const temporary = `${originPath}.tmp`;
  rmSync(originPath, { force: true });
  writeFileSync(configPath, '{}\n', { mode: 0o600 });
  const args = quickPreviewCommand({
    origin: web.origin,
    hostname: `${workspaceKey}-preview.localhost`,
    configPath,
    emails,
  });
  const child = spawn('cloudflared', args, {
    cwd: context.repoRoot,
    env: localProcessEnv(process.env),
    stdio: ['ignore', 'inherit', 'pipe'],
  });
  observeChildFailures(
    child,
    { dataDir: context.plan.dataDir, instanceId: 'dev' },
    'workspace-preview'
  );
  const cleanup = (): void => {
    for (const path of [configPath, originPath, temporary])
      rmSync(path, { force: true });
  };
  try {
    const origin = await quickPreviewReady(child, wallTimers, (origin) => {
      writeFileSync(temporary, JSON.stringify({ workspaceKey, origin }), {
        mode: 0o600,
      });
      renameReplacing(temporary, originPath);
    });
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('Preview tunnel stopped during startup; retry Run');
    return {
      value: { origin, workspaceKey },
      children: [child],
      async stop() {
        await stopChild(child);
        cleanup();
      },
    };
  } catch (error) {
    if (child.pid !== undefined) await stopChild(child);
    cleanup();
    throw error;
  }
}
