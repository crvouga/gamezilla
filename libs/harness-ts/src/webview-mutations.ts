/**
 * A live browser device's own mutation client, through the test hook the web
 * app exposes (`@libs/app-root-shared-ts/test-mutations`). The harness's
 * in-process client is not the device in a browser run: it never opens the
 * person's database, so a write must be sent from the page.
 */

import {
  TEST_MUTATIONS_GLOBAL,
  type TestMutationVerdict,
} from '@libs/app-root-shared-ts/test-mutations';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { waitUntil } from '@pkgs/ui-testing-root-shared-ts/wait';

type Evaluate = { evaluate(script: string): Promise<unknown> };

/** Writes sent from a device as its screen sends them, and their verdicts. */
export type DeviceMutations = {
  /** Sends `name` with `args`; returns the ticket to read the verdict by. */
  readonly send: (
    name: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<string>;
  /** The ticket's verdict, or `null` while the device has none yet. */
  readonly verdict: (ticket: string) => Promise<TestMutationVerdict | null>;
};

const HOOK = `globalThis[${JSON.stringify(TEST_MUTATIONS_GLOBAL)}]`;

/** How long a device that just opened may take to open its mutation client. */
const READY_MS = 20_000;

export function webviewMutations(view: Evaluate): DeviceMutations {
  return {
    send: async (name, args) => {
      await waitUntil(() => view.evaluate(`Boolean(${HOOK})`), {
        now: wallClock.now,
        timers: wallTimers,
        timeoutMs: READY_MS,
        description: 'the device mutation client',
      });
      const ticket = await view.evaluate(
        `${HOOK}.send(${JSON.stringify(name)}, ${JSON.stringify(JSON.stringify(args))})`
      );
      if (typeof ticket !== 'string')
        throw new Error('The device took no mutation');
      return ticket;
    },
    verdict: async (ticket) => {
      const raw = await view.evaluate(
        `${HOOK} ? ${HOOK}.verdict(${JSON.stringify(ticket)}) : null`
      );
      return typeof raw === 'string'
        ? (JSON.parse(raw) as TestMutationVerdict)
        : null;
    },
  };
}
