// @io-wall-ok — checkout-owned dynamic connector entry.
import { type ChildProcess, spawn } from 'node:child_process';
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

type Tunnel = { readonly child: ChildProcess; readonly origin: string };

/** One email-protected quick tunnel to a loopback listener of this checkout. */
async function startTunnel(
  context: ServiceContext,
  args: {
    readonly label: string;
    readonly origin: string;
    readonly hostname: string;
    readonly configPath: string;
    readonly emails: readonly string[];
    readonly publish: (origin: string) => void;
  }
): Promise<Tunnel> {
  writeFileSync(args.configPath, '{}\n', { mode: 0o600 });
  const child = spawn(
    'cloudflared',
    quickPreviewCommand({
      origin: args.origin,
      hostname: args.hostname,
      configPath: args.configPath,
      emails: args.emails,
    }),
    {
      cwd: context.repoRoot,
      env: localProcessEnv(process.env),
      stdio: ['ignore', 'inherit', 'pipe'],
    }
  );
  observeChildFailures(
    child,
    { dataDir: context.plan.dataDir, instanceId: 'dev' },
    args.label
  );
  try {
    const origin = await quickPreviewReady(child, wallTimers, args.publish);
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(
        'Preview tunnel stopped during startup; retry Start stack'
      );
    return { child, origin };
  } catch (error) {
    if (child.pid !== undefined) await stopChild(child);
    throw error;
  }
}

/** The stack's Storybook listener (see `pkgs/ui-root-harness-ts/storybook/network.ts`). */
function storybookLoopbackOrigin(env: NodeJS.ProcessEnv): string {
  const port = env['STORYBOOK_PORT'] || '6006';
  return `http://127.0.0.1:${port}`;
}

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
  const storybookConfigPath = join(dir, 'storybook-quick-config.json');
  const originPath = previewOriginPath(context.plan.dataDir);
  const temporary = `${originPath}.tmp`;
  rmSync(originPath, { force: true });
  const cleanup = (): void => {
    for (const path of [configPath, storybookConfigPath, originPath, temporary])
      rmSync(path, { force: true });
  };
  const [app, storybook] = await Promise.allSettled([
    startTunnel(context, {
      label: 'workspace-preview',
      origin: web.origin,
      hostname: `${workspaceKey}-preview.localhost`,
      configPath,
      emails,
      publish: (origin) => {
        writeFileSync(temporary, JSON.stringify({ workspaceKey, origin }), {
          mode: 0o600,
        });
        renameReplacing(temporary, originPath);
      },
    }),
    // Storybook allows the `localhost` host; its live channels follow the
    // page's own origin, so no public origin has to be configured.
    startTunnel(context, {
      label: 'workspace-preview-storybook',
      origin: storybookLoopbackOrigin(process.env),
      hostname: 'localhost',
      configPath: storybookConfigPath,
      emails,
      publish: () => undefined,
    }),
  ]);
  if (app.status === 'rejected') {
    if (storybook.status === 'fulfilled')
      await stopChild(storybook.value.child);
    cleanup();
    throw app.reason;
  }
  const tunnels = [
    app.value,
    ...(storybook.status === 'fulfilled' ? [storybook.value] : []),
  ];
  return {
    value: {
      origin: app.value.origin,
      workspaceKey,
      storybookOrigin:
        storybook.status === 'fulfilled' ? storybook.value.origin : null,
    },
    children: tunnels.map((tunnel) => tunnel.child),
    async stop() {
      await Promise.all(tunnels.map((tunnel) => stopChild(tunnel.child)));
      cleanup();
    },
  };
}
