import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

/** A failed gesture's existing public screen, without product storage access. */
export function journeyDiagnosticDriver(input: {
  readonly html: string | null;
  readonly visible: readonly string[];
  readonly texts: Readonly<Record<string, string>>;
  readonly captions: Readonly<Record<string, string>>;
  readonly refusedVisible?: string;
}) {
  const taps: string[] = [];
  const unused = (): never => {
    throw new Error('Unexpected diagnostic gesture');
  };
  const ui: Driver = {
    kind: 'journey-diagnostic-example',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: async () => input.html,
    get: (id): DriverNode => ({
      get: unused,
      attribute: async (name) =>
        name === 'aria-label' ? (input.captions[id] ?? null) : null,
      tap: async () => {
        taps.push(id);
      },
      tapAt: unused,
      drag: unused,
      layout: unused,
      input: unused,
      selectFile: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      isVisible: async () => input.visible.includes(id),
      text: async () => input.texts[id] ?? null,
      expect: {
        visible: async () => {
          if (input.refusedVisible === id)
            throw new Error('Timed out after 20000ms waiting for visible');
        },
        hidden: async () => {
          if (input.visible.includes(id))
            throw new Error('Timed out after 20000ms waiting for hidden');
        },
        text: unused,
      },
    }),
  };
  return { ui, taps };
}
