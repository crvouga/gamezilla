import { spawn, spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { basename } from 'node:path';

export type PbtFailureNotice = {
  readonly seed: number;
  readonly failedFiles: readonly string[];
};

function shouldFailLoud(): boolean {
  if (process.env['PBT_FAIL_LOUD'] === '0') return false;
  if (process.env['CI'] === 'true') return false;
  return true;
}

function spawnDetached(cmd: string, args: readonly string[]): void {
  try {
    const child = spawn(cmd, [...args], { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    // Missing dialog/sound helpers must not mask the test failure.
  }
}

function commandExists(cmd: string): boolean {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.error === undefined;
}

function playFailureSound(): void {
  const os = platform();

  if (os === 'darwin') {
    spawnDetached('afplay', ['/System/Library/Sounds/Basso.aiff']);
    spawnDetached('afplay', ['/System/Library/Sounds/Basso.aiff']);
    return;
  }

  if (os === 'win32') {
    spawnDetached('powershell', [
      '-NoProfile',
      '-Command',
      "(New-Object Media.SoundPlayer 'C:\\Windows\\Media\\chord.wav').PlaySync();",
    ]);
    return;
  }

  if (commandExists('paplay')) {
    spawnDetached('paplay', [
      '/usr/share/sounds/freedesktop/stereo/dialog-error.oga',
    ]);
  } else {
    process.stderr.write('\x07\x07\x07');
  }
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function failurePreview(failedFiles: readonly string[]): string {
  const failed = failedFiles.map((file) => basename(file));
  if (failed.length === 0) return 'see terminal output';
  if (failed.length <= 3) return failed.join(', ');
  return `${failed.slice(0, 3).join(', ')} +${String(failed.length - 3)} more`;
}

function showFailureDialog(notice: PbtFailureNotice): void {
  const os = platform();
  const preview = failurePreview(notice.failedFiles);
  const body = `PBT random failed\nseed ${String(notice.seed)}\n${preview}`;

  if (os === 'darwin') {
    spawnDetached('osascript', [
      '-e',
      `display dialog "${escapeAppleScriptString(body)}" with title "PBT random failed" buttons {"OK"} default button 1 with icon stop`,
    ]);
    return;
  }

  if (os === 'win32') {
    const escaped = body.replace(/'/g, "''");
    spawnDetached('powershell', [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${escaped}','PBT random failed', 'OK', 'Error')`,
    ]);
    return;
  }

  if (commandExists('notify-send')) {
    spawnDetached('notify-send', [
      '--urgency=critical',
      '--icon=dialog-error',
      'PBT random failed',
      body,
    ]);
  }
}

/** Sound + native alert so long local runs fail visibly. Opt out with PBT_FAIL_LOUD=0. */
export function notifyPbtFailure(notice: PbtFailureNotice): void {
  if (!shouldFailLoud()) return;
  playFailureSound();
  showFailureDialog(notice);
}
