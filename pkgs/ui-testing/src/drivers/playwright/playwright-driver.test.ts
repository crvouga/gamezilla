import { describe, expect, it, mock } from 'bun:test';
import type { Locator, Page } from '@playwright/test';
import { createDriver } from '../../driver/create-driver';
import { by, first } from '../../selector/selector';
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
  nth: ReturnType<typeof mock>;
};

function createFakeLocator(
  overrides: Partial<FakeLocator> = {}
): FakeLocator {
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
    nth: mock(() => locator as unknown as Locator),
    ...overrides,
  };
  return locator;
}

function createFakePage(locator: FakeLocator): Page {
  return {
    goto: mock(() => Promise.resolve()),
    goBack: mock(() => Promise.resolve()),
    keyboard: { press: mock(() => Promise.resolve()) },
    getByTestId: mock(() => locator as unknown as Locator),
    getByText: mock(() => locator as unknown as Locator),
    getByLabel: mock(() => locator as unknown as Locator),
    getByRole: mock(() => locator as unknown as Locator),
  } as unknown as Page;
}

describe('PlaywrightDriver', () => {
  it('maps selectors and user intents onto Page APIs', async () => {
    const locator = createFakeLocator();
    const page = createFakePage(locator);
    const driver = createDriver({
      kind: 'playwright',
      page,
      baseUrl: 'http://localhost:3000',
    }) as PlaywrightDriver;

    await driver.launch();
    expect(page.goto).toHaveBeenCalledWith('http://localhost:3000');

    await driver.tap(by.testId('submit'));
    expect(page.getByTestId).toHaveBeenCalledWith('submit');
    expect(locator.click).toHaveBeenCalled();

    await driver.tapAt(by.testId('board'), { xRatio: 0.5, yRatio: 0.25 });
    expect(locator.boundingBox).toHaveBeenCalled();
    expect(locator.click).toHaveBeenCalledWith({
      position: { x: 50, y: 25 },
    });

    await driver.tap(first(by.role('heading', 'Spaces')));
    expect(locator.nth).toHaveBeenCalledWith(0);

    await driver.typeText(by.label('Email'), 'a@b.c');
    expect(page.getByLabel).toHaveBeenCalledWith('Email');
    expect(locator.pressSequentially).toHaveBeenCalledWith('a@b.c');

    await driver.clearText(by.testId('email'));
    expect(locator.fill).toHaveBeenCalledWith('');

    await driver.pressKey('enter');
    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');

    await driver.scroll(by.testId('list'), 'down', 50);
    expect(locator.evaluate).toHaveBeenCalled();

    await driver.navigateBack();
    expect(page.goBack).toHaveBeenCalled();

    await driver.waitFor(by.role('button', 'Go'), 'visible');
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Go' });
    expect(locator.waitFor).toHaveBeenCalledWith({ state: 'visible' });

    expect(await driver.isVisible(by.text('Hi'))).toBe(true);
    expect(await driver.getText(by.testId('email'))).toBe('typed');

    await driver.close();
  });
});
