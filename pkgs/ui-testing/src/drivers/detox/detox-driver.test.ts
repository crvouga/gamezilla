import { describe, expect, it } from 'bun:test';
import { NotImplementedError } from '../../core/errors';
import { createDriver } from '../../driver/create-driver';
import { by } from '../../selector/selector';
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
    await expect(driver.tap(by.testId('x'))).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(
      driver.tapAt(by.testId('x'), { xRatio: 0.5, yRatio: 0.5 })
    ).rejects.toBeInstanceOf(NotImplementedError);
    await expect(
      driver.typeText(by.testId('x'), 'a')
    ).rejects.toBeInstanceOf(NotImplementedError);
    await expect(driver.clearText(by.testId('x'))).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.pressKey('enter')).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(
      driver.scroll(by.testId('x'), 'down')
    ).rejects.toBeInstanceOf(NotImplementedError);
    await expect(driver.navigateBack()).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(
      driver.waitFor(by.testId('x'), 'visible')
    ).rejects.toBeInstanceOf(NotImplementedError);
    await expect(driver.isVisible(by.testId('x'))).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(driver.getText(by.testId('x'))).rejects.toBeInstanceOf(
      NotImplementedError
    );
  });
});
