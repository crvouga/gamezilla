import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { specProcessExit } from './spec-process';

test('a suite yields to the emulator event loop before completing', async () => {
  // regression: stack-suite-blocks-emulators
  const child = new EventEmitter();
  let served = false;
  const exit = specProcessExit(child);
  await Promise.resolve().then(() => {
    served = true;
    child.emit('exit', 0);
  });
  expect(await exit).toBe(0);
  expect(served).toBe(true);
});

test('suite failures and termination cannot become a green result', async () => {
  for (const code of [1, 7, null]) {
    const child = new EventEmitter();
    const exit = specProcessExit(child);
    child.emit('exit', code);
    expect(await exit).toBe(code ?? 1);
  }
  const child = new EventEmitter();
  const exit = specProcessExit(child);
  child.emit('error', new Error('spawn failed'));
  await expect(exit).rejects.toThrow('spawn failed');
});
