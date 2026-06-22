import { spawn } from 'node:child_process';
import type { Writable } from 'node:stream';
import { which } from '@pkgs/os/command';
import { formatDuration, healLog } from './log';

export interface InvokeAgentOptions {
  readonly prompt: string;
  readonly workspace: string;
  readonly apiKey: string;
  readonly continueSession: boolean;
  readonly model?: string;
}

export interface InvokeAgentResult {
  readonly exitCode: number;
  readonly output: string;
  readonly durationMs: number;
}

function resolveAgentCommand(): {
  readonly cmd: string;
  readonly prefix: string[];
} {
  if (which('agent')) {
    return { cmd: 'agent', prefix: [] };
  }
  if (which('cursor')) {
    return { cmd: 'cursor', prefix: ['agent'] };
  }
  throw new Error(
    'Cursor CLI not found on PATH. Install Cursor and ensure `agent` or `cursor` is available.'
  );
}

function formatAgentCommand(
  cmd: string,
  args: ReadonlyArray<string>,
  prompt: string
): string {
  const redacted = args.map((a) =>
    a === prompt ? '<prompt>' : a.length > 12 ? `${a.slice(0, 8)}…` : a
  );
  return [cmd, ...redacted].join(' ');
}

async function mirrorChildStream(
  stream: NodeJS.ReadableStream | null | undefined,
  chunks: string[],
  mirror: Writable
): Promise<void> {
  if (stream === null || stream === undefined) return;
  for await (const chunk of stream) {
    const text = typeof chunk === 'string' ? chunk : chunk.toString();
    chunks.push(text);
    mirror.write(text);
  }
}

export async function invokeAgent(
  options: InvokeAgentOptions
): Promise<InvokeAgentResult> {
  const { cmd, prefix } = resolveAgentCommand();
  const args = [
    ...prefix,
    '-p',
    '--force',
    '--trust',
    '--workspace',
    options.workspace,
    '--output-format',
    'text',
    '--api-key',
    options.apiKey,
  ];
  if (options.continueSession) {
    args.push('--continue');
  }
  if (options.model !== undefined && options.model.trim() !== '') {
    args.push('--model', options.model.trim());
  }
  args.push(options.prompt);

  healLog(`agent: starting (${formatAgentCommand(cmd, args, options.prompt)})`);
  if (options.continueSession) {
    healLog('agent: continuing previous session');
  }
  if (options.model !== undefined && options.model.trim() !== '') {
    healLog(`agent: model=${options.model.trim()}`);
  }
  healLog(`agent: prompt length=${String(options.prompt.length)} chars`);

  const started = Date.now();
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.workspace,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));

    void Promise.all([
      mirrorChildStream(child.stdout, stdoutChunks, process.stdout),
      mirrorChildStream(child.stderr, stderrChunks, process.stderr),
    ]).catch(reject);
  });

  const durationMs = Date.now() - started;
  const stdout = stdoutChunks.join('');
  const stderr = stderrChunks.join('');
  const output =
    stdout.trimEnd() === ''
      ? stderr.trimEnd()
      : stderr.trimEnd() === ''
        ? stdout.trimEnd()
        : `${stdout.trimEnd()}\n\n--- stderr ---\n${stderr.trimEnd()}`;

  if (exitCode === 0) {
    healLog(`agent: finished ok (${formatDuration(durationMs)})`);
  } else {
    healLog(
      `agent: finished exit ${String(exitCode)} (${formatDuration(durationMs)})`
    );
  }

  return { exitCode, output, durationMs };
}

export function requireApiKey(explicit?: string): string {
  const key = (explicit ?? process.env.CURSOR_API_KEY ?? '').trim();
  if (key === '') {
    throw new Error(
      'CURSOR_API_KEY is required. Run via `bun run check:heal` (Vault dev config) or pass --api-key.'
    );
  }
  return key;
}

export function describeApiKeySource(explicit?: string): string {
  if (explicit !== undefined && explicit.trim() !== '') {
    return '--api-key flag';
  }
  if ((process.env.CURSOR_API_KEY ?? '').trim() !== '') {
    return 'CURSOR_API_KEY (Vault/env)';
  }
  return 'missing';
}
