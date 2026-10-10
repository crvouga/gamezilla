// Runtime flags belong after run/test; native CLI commands inherit stamps without runtime flags.
function ownedBunArgs(command, args, hook) {
  const name = require('node:path').basename(command);
  if (name !== 'bun') return args;
  if (args[0] === 'run' || args[0] === 'test')
    return [args[0], '--preload', hook, ...args.slice(1)];
  const nativeCommands = new Set([
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
  if (nativeCommands.has(args[0])) return args;
  return ['--preload', hook, ...args];
}
module.exports = { ownedBunArgs };
