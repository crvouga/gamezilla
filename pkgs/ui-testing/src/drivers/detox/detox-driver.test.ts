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
    await expect(driver.get('x').tap()).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(
      driver.get('x').tapAt({ xRatio: 0.5, yRatio: 0.5 })
    ).rejects.toBeInstanceOf(NotImplementedError);
    await expect(driver.get('x').input('a')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.get('x').clear()).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.key('enter')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.get('x').scroll('down')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.get('x').wait('visible')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.get('x').expect.visible()).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.get('x').expect.hidden()).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.get('x').expect.text('hi')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.get('x').isVisible()).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.get('x').text()).rejects.toBeInstanceOf(
      NotImplementedError
    );
    expect(await driver.snapshotHtml()).toBeNull();
  });
});
