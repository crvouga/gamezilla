/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { createDemoClock, DemoApp } from './demo-app';

test('range input selects an absolute value while text input appends', async () => {
  // regression: range-driver-appends-position
  const harness = createDemoClock();
  const driver = createSolidDomDriver({
    clock: harness.clock,
    pump: harness.pump,
    harness: { createRoot: () => () => <DemoApp harness={harness} /> },
  });
  try {
    await driver.launch();
    expect(await driver.get('position').text()).toBe('500');
    await driver.get('position').input('200');
    expect(await driver.get('position-value').text()).toBe('200');
    await driver.get('position').input('800');
    expect(await driver.get('position-value').text()).toBe('800');
    await driver.get('email').input('alice');
    await driver.get('email').input('@example.com');
    expect(await driver.get('email').text()).toBe('alice@example.com');
  } finally {
    await driver.close();
  }
});
