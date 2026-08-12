import { describe, expect, it } from 'bun:test';
import { NotImplementedError } from '../../core/errors';
import { createDriver } from '../../driver/create-driver';
import type { DetoxLike } from './detox-driver';

const stubDetox: DetoxLike = {
  device: {
    launchApp: async () => undefined,
    terminateApp: async () => undefined,
    pressBack: async () => undefined,
  },
};

describe('DetoxDriver stub', () => {
  it('implements Driver but throws NotImplementedError for every op', async () => {
    const driver = createDriver({ kind: 'detox', detox: stubDetox });
    expect(driver.kind).toBe('detox');

    await expect(driver.launch()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(driver.close()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(driver.tap('x')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(
      driver.tapAt('x', { xRatio: 0.5, yRatio: 0.5 })
    ).rejects.toBeInstanceOf(NotImplementedError);
    await expect(driver.input('x', 'a')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.clear('x')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(driver.key('enter')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.scroll('x', 'down')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.wait('x', 'visible')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.expect.visible('x')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.expect.hidden('x')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.expect.text('x', 'hi')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.isVisible('x')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.getText('x')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    expect(await driver.snapshotHtml()).toBeNull();
  });
});
