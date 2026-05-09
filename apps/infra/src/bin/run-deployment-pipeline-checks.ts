import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLocalLlmFixPromptMarkdown } from '../cli/lib/build-llm-fix-prompt';
import { DEPLOYMENT_PIPELINE_CHECK_STEPS } from '../cli/lib/deployment-pipeline-check-steps';

function repoRootFromThisFile(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
}

function combineStreams(stdout: Uint8Array, stderr: Uint8Array): string {
  const dec = new TextDecoder();
  const out = dec.decode(stdout).trimEnd();
  const err = dec.decode(stderr).trimEnd();
  const parts: string[] = [];
  if (err !== '') parts.push('--- stderr ---\n' + err);
  if (out !== '') parts.push('--- stdout ---\n' + out);
  return parts.length > 0 ? parts.join('\n\n') : '(no output)';
}

function copyToClipboard(text: string): boolean {
  if (process.platform === 'darwin') {
    const r = spawnSync('pbcopy', { input: text, encoding: 'utf-8' });
    return r.status === 0;
  }
  if (process.platform === 'linux') {
    const wl = spawnSync('wl-copy', { input: text, encoding: 'utf-8' });
    if (wl.status === 0) return true;
    const x = spawnSync('xclip', ['-selection', 'clipboard'], {
      input: text,
      encoding: 'utf-8',
    });
    return x.status === 0;
  }
  return false;
}

const root = repoRootFromThisFile();
const failures: { jobId: string; output: string }[] = [];

for (const step of DEPLOYMENT_PIPELINE_CHECK_STEPS) {
  const proc = Bun.spawnSync(['bun', 'run', step.bunScript], {
    cwd: root,
    env: process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (proc.exitCode !== 0) {
    failures.push({
      jobId: step.jobId,
      output: combineStreams(proc.stdout, proc.stderr),
    });
  }
}

if (failures.length === 0) {
  process.stdout.write(
    'All deployment pipeline checks passed (same jobs as deploy.needs in deployment-pipeline.yml).\n'
  );
  process.exit(0);
}

const md = buildLocalLlmFixPromptMarkdown(failures);
process.stdout.write(`${md}\n`);

const copied = copyToClipboard(md);
if (copied) {
  process.stdout.write('\nCopied LLM fix prompt to clipboard.\n');
} else {
  console.error(
    '\nCould not copy to clipboard (install pbcopy on macOS, or wl-copy / xclip on Linux).'
  );
}

process.exit(1);
