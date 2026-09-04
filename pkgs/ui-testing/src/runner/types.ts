/** Sim fidelity tier — selects host runner + system wiring. */
export type UiTestFidelity = 'sim' | 'max';

/** UI driver backend bound to a fidelity tier. */
export type UiDriverKind = 'rntl' | 'playwright' | 'bun-webview' | 'detox';

/** Describe-scoped surface passed to scenario authors. */
export type UiTestCtx = {
  readonly fidelity: UiTestFidelity;
  readonly driverKind: UiDriverKind;
  test(name: string, fn: () => Promise<void> | void, timeoutMs?: number): void;
  beforeAll(fn: () => Promise<void> | void): void;
  afterAll(fn: () => Promise<void> | void): void;
  beforeEach(fn: () => Promise<void> | void): void;
  afterEach(fn: () => Promise<void> | void): void;
};

export type UiTestRunnerConfig = {
  readonly fidelity: UiTestFidelity;
  readonly driverKind: UiDriverKind;
};

/** Runtime test runner installed once per process (Jest, Playwright, Detox). */
export type UiTestRunner = {
  readonly config: UiTestRunnerConfig;
  describe(name: string, fn: (ctx: UiTestCtx) => void): void;
};

/** Hooks a host adapter maps onto its native runner API. */
export type UiTestHostHooks = {
  describe(name: string, fn: () => void): void;
  test(name: string, fn: () => Promise<void> | void, timeoutMs?: number): void;
  beforeAll(fn: () => Promise<void> | void): void;
  afterAll(fn: () => Promise<void> | void): void;
  beforeEach(fn: () => Promise<void> | void): void;
  afterEach(fn: () => Promise<void> | void): void;
};
