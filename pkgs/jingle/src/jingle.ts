#!/usr/bin/env bun
/**
 * jingle
 *
 * Runs a command and plays a happy sound if it exits 0, or a sad sound
 * if it exits non-zero. The command's own exit code is passed through,
 * so jingle is safe to use in && / || chains too.
 *
 * Usage:
 *   jingle bun test
 *   jingle -- bun test --watch
 *   jingle npm run build
 */

import { spawn, spawnSync } from 'node:child_process';
import { platform } from 'node:os';

function parseArgs(argv: readonly string[]): string[] {
  const args = argv.slice(2);
  if (args[0] === '--') {
    return args.slice(1);
  }
  return [...args];
}

function commandExists(cmd: string): boolean {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.error === undefined;
}

function spawnDetached(cmd: string, args: readonly string[]): void {
  try {
    const child = spawn(cmd, [...args], { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    // If the sound player itself can't be launched, fail silently —
    // a missing sound is not worth crashing over.
  }
}

function playSound(success: boolean): void {
  const os = platform();

  if (os === 'darwin') {
    const sound = success
      ? '/System/Library/Sounds/Glass.aiff'
      : '/System/Library/Sounds/Basso.aiff';
    spawnDetached('afplay', [sound]);
    return;
  }

  if (os === 'win32') {
    const sound = success
      ? 'C:\\Windows\\Media\\tada.wav'
      : 'C:\\Windows\\Media\\chord.wav';
    spawnDetached('powershell', [
      '-NoProfile',
      '-Command',
      `(New-Object Media.SoundPlayer '${sound}').PlaySync();`,
    ]);
    return;
  }

  if (commandExists('paplay')) {
    const sound = success
      ? '/usr/share/sounds/freedesktop/stereo/complete.oga'
      : '/usr/share/sounds/freedesktop/stereo/dialog-error.oga';
    spawnDetached('paplay', [sound]);
  } else if (commandExists('aplay')) {
    const sound = success
      ? '/usr/share/sounds/alsa/Front_Center.wav'
      : '/usr/share/sounds/alsa/Front_Left.wav';
    spawnDetached('aplay', [sound]);
  } else {
    process.stdout.write(success ? '\x07' : '\x07\x07');
  }
}

function main(): void {
  const args = parseArgs(process.argv);

  if (args.length === 0) {
    console.error('Usage: jingle <command> [args...]');
    console.error('       jingle -- <command> [args...]');
    process.exit(1);
  }

  const [cmd, ...cmdArgs] = args;
  if (cmd === undefined) {
    console.error('Usage: jingle <command> [args...]');
    process.exit(1);
  }

  const useShell = platform() === 'win32';

  const child = spawn(cmd, cmdArgs, { stdio: 'inherit', shell: useShell });

  child.on('error', (err) => {
    console.error(`jingle: failed to run "${cmd}": ${err.message}`);
    playSound(false);
    process.exit(127);
  });

  child.on('exit', (code, signal) => {
    const exitCode = code ?? (signal ? 1 : 0);
    playSound(exitCode === 0);
    process.exit(exitCode);
  });
}

main();
