// Runtime flags belong after run/test. Leading flags stay in front of that
// subcommand; native CLI commands inherit stamps without runtime flags.
const NATIVE_COMMANDS = new Set([
  'x',
  'install',
  'add',
  'remove',
  'update',
  'pm',
  'build',
  'create',
  'init',
  'upgrade',
  'link',
  'unlink',
  'outdated',
  'audit',
  'completions',
]);

// These consume the next argv entry, so a later `run` or `test` is still the subcommand.
const VALUED_FLAGS = new Set([
  '--bunfig',
  '--conditions',
  '--config',
  '--cwd',
  '--define',
  '--env-file',
  '--filter',
  '--import',
  '--loader',
  '--preload',
  '--require',
  '--shell',
  '--target',
  '--tsconfig-override',
  '-c',
  '-d',
  '-F',
  '-l',
  '-r',
]);

function subcommandIndex(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === 'run' || arg === 'test') return index;
    if (arg === '--' || !arg.startsWith('-')) return -1;
    if (!arg.includes('=') && VALUED_FLAGS.has(arg)) index += 1;
  }
  return -1;
}

function ownedBunArgs(command, args, hook) {
  const name = require('node:path').basename(command);
  if (name !== 'bun') return args;
  const index = subcommandIndex(args);
  if (index >= 0) {
    return [
      ...args.slice(0, index + 1),
      '--preload',
      hook,
      ...args.slice(index + 1),
    ];
  }
  if (NATIVE_COMMANDS.has(args[0])) return args;
  return ['--preload', hook, ...args];
}

module.exports = { ownedBunArgs };
