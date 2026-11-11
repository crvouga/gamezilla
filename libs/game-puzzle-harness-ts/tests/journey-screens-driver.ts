import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

type TextOptions = { readonly exact?: boolean } | undefined;

/** A device as a few named screens: what each shows and where a press leads. */
export type JourneyScreens = {
  readonly start: string;
  /** The handles each screen shows; Back shows on every one. */
  readonly screens: Readonly<Record<string, readonly string[]>>;
  /** `<screen>:<handle>` to the screen that press opens. */
  readonly leads: Readonly<Record<string, string>>;
  /** The screen a wait settles into, for one that is still arriving. */
  readonly arrives?: Readonly<Record<string, string>>;
  readonly attribute?: (id: string, name: string) => string | null;
  readonly expectText?: (
    at: { readonly id: string; readonly screen: string },
    value: string,
    options: TextOptions
  ) => void;
};

/**
 * A scripted driver over `JourneyScreens`: a handle is visible only on the
 * screens that list it, a press on anything else fails as a real one does,
 * and every press is recorded in order.
 */
export function journeyScreensDriver(model: JourneyScreens) {
  let screen = model.start;
  const taps: string[] = [];
  const unused = (): never => {
    throw new Error('Unexpected driver operation');
  };
  const shown = (id: string): boolean =>
    id === 'nav-back' || (model.screens[screen] ?? []).includes(id);
  const requireVisible = (id: string): void => {
    if (!shown(id)) throw new Error(`${id} is unavailable on ${screen}`);
  };
  const settle = (): void => {
    screen = model.arrives?.[screen] ?? screen;
  };
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      text: unused,
      attribute: async (name) => model.attribute?.(id, name) ?? null,
      isVisible: async () => shown(id),
      wait: async (_state, options) => {
        settle();
        if (options?.visibleOr?.some(shown)) return;
        requireVisible(id);
      },
      tap: async () => {
        requireVisible(id);
        const next = model.leads[`${screen}:${id}`];
        if (next === undefined)
          throw new Error(`${id} leads nowhere from ${screen}`);
        taps.push(id);
        screen = next;
      },
      expect: {
        visible: async () => {
          settle();
          requireVisible(id);
        },
        hidden: unused,
        text: async (value, options) => {
          requireVisible(id);
          model.expectText?.({ id, screen }, value, options);
        },
      },
    }),
  };
  return { ui, taps, screen: () => screen };
}
