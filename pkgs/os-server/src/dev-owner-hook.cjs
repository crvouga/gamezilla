// @io-wall-ok — preload launch gate for vendor workers (Node and Bun).
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const moduleApi = require('node:module');
const { ownedBunArgs } = require('./dev-owner-command.cjs');
const gate = 'kill -STOP $$; exec "$@"';
const retained = new Set();

function record(pid, command, cwd) {
  if (!(pid > 1)) throw new Error('Owned worker has no PID');
  let stopped = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (
      cp
        .execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], {
          encoding: 'utf8',
        })
        .includes('T')
    ) {
      stopped = true;
      break;
    }
  }
  if (!stopped) {
    process.kill(pid, 'SIGKILL');
    throw new Error('Worker gate did not stop');
  }
  persist(pid, command, cwd);
  process.kill(pid, 'SIGCONT');
}

function persist(pid, command, cwd) {
  const line = cp.execFileSync(
    'ps',
    ['-p', String(pid), '-o', 'ppid=,pgid=,lstart='],
    { encoding: 'utf8' }
  );
  const match = /^\s*(\d+)\s+(\d+)\s+(.{24})/.exec(line);
  if (!match) throw new Error('Cannot identify owned worker');
  const root = process.env.DEV_OWNER_ROOT;
  const boot = process.env.DEV_OWNER_BOOT;
  const dir = path.join(root, '.cache/dev-owner');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `pid-${pid}.json`);
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(
    temp,
    JSON.stringify({
      pid,
      ppid: Number(match[1]),
      pgid: Number(match[2]),
      identity: match[3],
      command,
      cwd: cwd || process.cwd(),
      root,
      boot,
      stamp: { DEV_OWNER_ROOT: root, DEV_OWNER_BOOT: boot },
    })
  );
  fs.renameSync(temp, file);
}

function workerArgs(file, args) {
  return ownedBunArgs(file, args, __filename);
}

function installNodeGate() {
  const original = cp.ChildProcess.prototype.spawn;
  cp.ChildProcess.prototype.spawn = function ownedSpawn(options) {
    if (!process.env.DEV_OWNER_ROOT || options.args?.includes(gate))
      return original.call(this, options);
    const command = options.file;
    const args = workerArgs(command, options.args.slice(1));
    const inherited = options.envPairs.filter(
      (pair) => !/^(DEV_OWNER_ROOT|DEV_OWNER_BOOT|NODE_OPTIONS)=/.test(pair)
    );
    const envPairs = [
      ...inherited,
      `DEV_OWNER_ROOT=${process.env.DEV_OWNER_ROOT}`,
      `DEV_OWNER_BOOT=${process.env.DEV_OWNER_BOOT}`,
      `NODE_OPTIONS=${process.env.NODE_OPTIONS || ''}`,
    ];
    const result = original.call(this, {
      ...options,
      file: '/bin/sh',
      args: ['/bin/sh', '-c', gate, 'dev-owner-gate', command, ...args],
      envPairs,
      detached: true,
    });
    if (result !== 0) return result;
    retained.add(this);
    this.once('close', () => retained.delete(this));
    record(this.pid, [command, ...args].join(' '), options.cwd);
    return result;
  };
  moduleApi.syncBuiltinESMExports();
}

function installBunGate() {
  const original = Bun.spawn.bind(Bun);
  Bun.spawn = function ownedBunSpawn(input, options = {}) {
    const request = Array.isArray(input) ? { ...options, cmd: input } : input;
    if (!process.env.DEV_OWNER_ROOT || request.cmd.includes(gate))
      return original(input, options);
    const [command, ...args] = request.cmd;
    const child = original({
      ...request,
      cmd: [
        '/bin/sh',
        '-c',
        gate,
        'dev-owner-gate',
        command,
        ...workerArgs(command, args),
      ],
      detached: true,
      env: {
        ...process.env,
        ...request.env,
        DEV_OWNER_ROOT: process.env.DEV_OWNER_ROOT,
        DEV_OWNER_BOOT: process.env.DEV_OWNER_BOOT,
        NODE_OPTIONS: process.env.NODE_OPTIONS,
      },
    });
    retained.add(child);
    child.exited.finally(() => retained.delete(child));
    record(child.pid, request.cmd.join(' '), request.cwd);
    return child;
  };
}
function installBunNodeGate() {
  const original = cp.spawn;
  cp.spawn = function ownedSpawn(command, args = [], options = {}) {
    if (!Array.isArray(args)) {
      options = args;
      args = [];
    }
    if (args.includes(gate)) return original(command, args, options);
    const child = original(
      '/bin/sh',
      ['-c', gate, 'dev-owner-gate', command, ...workerArgs(command, args)],
      {
        ...options,
        detached: true,
        env: {
          ...process.env,
          ...options.env,
          DEV_OWNER_ROOT: process.env.DEV_OWNER_ROOT,
          DEV_OWNER_BOOT: process.env.DEV_OWNER_BOOT,
          NODE_OPTIONS: process.env.NODE_OPTIONS,
        },
      }
    );
    retained.add(child);
    child.once('close', () => retained.delete(child));
    record(child.pid, [command, ...args].join(' '), options.cwd);
    return child;
  };
  moduleApi.syncBuiltinESMExports();
}
if (process.env.DEV_OWNER_ROOT && !globalThis[Symbol.for('dev.owner.hook')]) {
  globalThis[Symbol.for('dev.owner.hook')] = true;
  persist(process.pid, process.argv.join(' '), process.cwd());
  if (typeof Bun !== 'undefined') {
    installBunNodeGate();
    installBunGate();
  } else installNodeGate();
}
