// @io-wall-ok — the element the notification screens are drawn into.
/**
 * The notifications the simulated vendors deliver, on the screens their
 * recipients would read them on: a phone's messages and lock screen, a mail
 * inbox, a team chat. It is Mockingbird's notification harness, running in
 * this page over the emulators it can read (an SMS, email, push or chat
 * vendor's), and it only reads them.
 */

import type { HarnessEmulator } from '@libs/harness-ts/emulators';
import type {
  ProductHarnessEmulator,
  ProductHarnessEmulatorElement,
} from '@pkgs/harness-console-shared-ts/ports';

export const NOTIFICATIONS_EMULATOR_ID = 'notifications';
export const NOTIFICATIONS_EMULATOR_TITLE = 'Notifications';

/** The vendors the notification harness reads, by the emulator's id. */
const NOTIFYING_SERVICES = [
  'twilio',
  'resend',
  'fcm',
  'ses',
  'sns',
  'customerio',
  'mailosaur',
  'slack',
  'cognito',
] as const;

type NotifyingService = (typeof NOTIFYING_SERVICES)[number];

type NotifyingEmulator = {
  readonly fetch: (request: Request) => Promise<Response>;
  readonly service: NotifyingService;
};

/** The emulators that deliver something to a person, as the harness takes them. */
export function notifyingEmulators(
  emulators: readonly HarnessEmulator[]
): Record<string, NotifyingEmulator> {
  const found: Record<string, NotifyingEmulator> = {};
  for (const emulator of emulators) {
    const service = NOTIFYING_SERVICES.find((each) => each === emulator.id);
    if (service !== undefined)
      found[emulator.id] = {
        fetch: (request) => emulator.fetch(request),
        service,
      };
  }
  return found;
}

/**
 * The notification screens, as an element that fills the room it is given,
 * reading the emulators there are when it opens. The harness and its
 * screens are loaded then, not before: no page pays for them that never
 * looks.
 */
export function openNotificationsEmulator(
  emulators: () => readonly HarnessEmulator[]
): ProductHarnessEmulatorElement & { readonly element: HTMLElement } {
  const element = document.createElement('div');
  element.style.width = '100%';
  element.style.height = '100%';
  let close: (() => void) | null = null;
  let disposed = false;
  const load = async (): Promise<void> => {
    const [{ createNotificationHarness }, { mountNotifications }] =
      await Promise.all([
        import('@crvouga/mockingbird-notifications'),
        import('@crvouga/mockingbird-notifications/ui'),
      ]);
    if (disposed) return;
    const harness = createNotificationHarness({
      services: notifyingEmulators(emulators()),
    });
    const ui = mountNotifications(element, {
      harness,
      title: NOTIFICATIONS_EMULATOR_TITLE,
    });
    close = () => {
      ui.destroy();
      harness.close();
    };
  };
  void load().catch((error: unknown) => {
    element.textContent = `The notification screens could not be loaded: ${
      error instanceof Error ? error.message : String(error)
    }`;
  });
  return {
    element,
    dispose: () => {
      disposed = true;
      close?.();
    },
  };
}

/**
 * The emulators a session shows: each vendor's, with its dashboard's
 * address, then the notification screens where the page can open them.
 */
export function sessionEmulators(args: {
  readonly harness: { emulators(): readonly HarnessEmulator[] };
  readonly emulatorDashboardUrl: (emulator: string) => string | null;
  readonly openNotifications?: () => ProductHarnessEmulatorElement;
}): readonly ProductHarnessEmulator[] {
  const vendors = args.harness.emulators().map((emulator) => ({
    id: emulator.id,
    title: emulator.title,
    dashboardUrl: args.emulatorDashboardUrl(emulator.id),
  }));
  if (args.openNotifications === undefined) return vendors;
  return [
    ...vendors,
    {
      id: NOTIFICATIONS_EMULATOR_ID,
      title: NOTIFICATIONS_EMULATOR_TITLE,
      dashboardUrl: null,
      open: args.openNotifications,
    },
  ];
}
