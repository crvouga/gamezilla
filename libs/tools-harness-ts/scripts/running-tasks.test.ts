import { describe, expect, test } from 'bun:test';
import { formatRunningTasks, parsePs, runningTasks } from './running-tasks';

// `ps -axo pid=,ppid=,etime=,command=` under turbo-ci-run: the npm `turbo`
// shim (100) spawns the Go binary (101), whose children are the tasks; a
// task's own children (bun test workers) are not tasks.
const PS = `
    1     0 10-02:00:00 /sbin/launchd
   50     1    20:05 bun run libs/tools-harness-ts/scripts/turbo-ci-run.ts verify
  100    50    20:00 node /repo/node_modules/.bin/turbo run @libs/chess#test:spec @apps/client-ts#build
  101   100    19:59 /repo/node_modules/turbo-linux-64/bin/turbo run @libs/chess#test:spec @apps/client-ts#build
  200   101    18:40 bun run test:spec
  201   200    18:39 bun test --parallel tests/harness
  300   101    01:12 bun run build
  400     1    05:00 /usr/bin/unrelated turbo run elsewhere
`;

describe('running-tasks', () => {
  // regression: verify-deadline-kill-silent
  test('names the children of the turbo binary, not their workers or strangers', () => {
    expect(runningTasks(parsePs(PS), 100)).toEqual([
      { pid: 200, elapsed: '18:40', command: 'bun run test:spec' },
      { pid: 300, elapsed: '01:12', command: 'bun run build' },
    ]);
  });

  test('says so when nothing was running', () => {
    expect(runningTasks(parsePs(PS), 999)).toEqual([]);
    expect(formatRunningTasks([])).toContain('no task was running');
  });
});
