import { describe, expect, it, mock } from 'bun:test';
import type { Locator, Page } from '@playwright/test';
import { createDriver } from '../../driver/create-driver';
import type { PlaywrightDriver } from './playwright-driver';

type FakeLocator = {
  click: ReturnType<typeof mock>;
  pressSequentially: ReturnType<typeof mock>;
  fill: ReturnType<typeof mock>;
  waitFor: ReturnType<typeof mock>;
  isVisible: ReturnType<typeof mock>;
  count: ReturnType<typeof mock>;
  inputValue: ReturnType<typeof mock>;
  innerText: ReturnType<typeof mock>;
  evaluate: ReturnType<typeof mock>;
  boundingBox: ReturnType<typeof mock>;
};

function createFakeLocator(overrides: Partial<FakeLocator> = {}): FakeLocator {
  const locator: FakeLocator = {
    click: mock(() => Promise.resolve()),
    pressSequentially: mock(() => Promise.resolve()),
    fill: mock(() => Promise.resolve()),
    waitFor: mock(() => Promise.resolve()),
    isVisible: mock(() => Promise.resolve(true)),
    count: mock(() => Promise.resolve(1)),
    inputValue: mock(() => Promise.resolve('typed')),
    innerText: mock(() => Promise.resolve('label')),
    evaluate: mock(() => Promise.resolve()),
    boundingBox: mock(() =>
      Promise.resolve({ x: 0, y: 0, width: 100, height: 100 })
    ),
    ...overrides,
  };
  return locator;
}

function createFakePage(locator: FakeLocator): Page {
  return {
    goto: mock(() => Promise.resolve()),
    content: mock(() => Promise.resolve('<html><body>ok</body></html>')),
    keyboard: { press: mock(() => Promise.resolve()) },
    getByTestId: mock(() => locator as unknown as Locator),
  } as unknown as Page;
}

describe('PlaywrightDriver', () => {
  it('maps testIds and user intents onto Page APIs', async () => {
    const locator = createFakeLocator();
    const page = createFakePage(locator);
    const driver = createDriver({
      kind: 'playwright',
      page,
      baseUrl: 'http://localhost:3000',
    }) as PlaywrightDriver;

    await driver.launch();
    expect(page.goto).toHaveBeenCalledWith('http://localhost:3000');

    await driver.tap('submit');
    expect(page.getByTestId).toHaveBeenCalledWith('submit');
    expect(locator.waitFor).toHaveBeenCalledWith({ state: 'visible' });
    expect(locator.click).toHaveBeenCalled();

    await driver.tapAt('board', { xRatio: 0.5, yRatio: 0.25 });
    expect(locator.boundingBox).toHaveBeenCalled();
    expect(locator.click).toHaveBeenCalledWith({
      position: { x: 50, y: 25 },
    });

    await driver.input('email', 'a@b.c');
    expect(page.getByTestId).toHaveBeenCalledWith('email');
    expect(locator.pressSequentially).toHaveBeenCalledWith('a@b.c');

    await driver.clear('email');
    expect(locator.fill).toHaveBeenCalledWith('');

    await driver.key('enter');
    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');

    await driver.scroll('list', 'down', 50);
    expect(locator.evaluate).toHaveBeenCalled();

    await driver.wait('go', 'visible');
    expect(page.getByTestId).toHaveBeenCalledWith('go');
    expect(locator.waitFor).toHaveBeenCalledWith({ state: 'visible' });

    expect(await driver.isVisible('hi')).toBe(true);
    expect(await driver.getText('email')).toBe('typed');
    expect(await driver.snapshotHtml()).toBe('<html><body>ok</body></html>');
    expect(page.content).toHaveBeenCalled();

    await driver.close();
  });
});
