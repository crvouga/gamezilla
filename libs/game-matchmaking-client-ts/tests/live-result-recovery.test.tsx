/** @jsxImportSource @solidjs/web */

import { afterEach, expect, test } from 'bun:test';
import { useDeadlineSettle } from '@libs/game-matchmaking-client-ts/use-deadline-settle';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { cleanup, render } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';
import { MATCH } from './multiplayer-presentation-fixture';

afterEach(cleanup);

// regression: matched-resignation-stale-device-results
test.each([
  ['98523e2c-445a-4f00-86fb-e21862a503cd', 7],
  ['ee023e85-0db6-4d63-9a59-f1182cb85067', 11],
] as const)(
  'both devices recover the committed resignation of %s at revision %i',
  async (id, revision) => {
    const time = createHarnessClock();
    const initial = { ...MATCH, id, revision: 0, turn: '' };
    const winner = {
      ...initial,
      revision,
      outcome: 'black',
      reason: 'resignation',
    } as const;
    const accepted = Promise.withResolvers<void>();
    const copies: Array<() => MultiplayerGame> = [];
    const localGames = () => copies.map((read) => read());
    const requests: string[] = [];
    function Device(props: { person: string }) {
      const [stored, setStored] = createSignal<MultiplayerGame>(initial);
      copies.push(stored);
      useDeadlineSettle({
        stored,
        game: () => winner,
        online: () => true,
        // The server has already committed the result. Settling it writes nothing.
        settle: async () => {
          requests.push(props.person);
          await accepted.promise;
        },
        refresh: async () => {
          setStored(winner);
        },
      });
      return null;
    }
    render(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <Device person="alice" />
        <Device person="bob" />
      </ClockProvider>
    ));
    flush();
    expect(requests).toEqual(['alice', 'bob']);
    time.clock.advance(5_000);
    flush();
    expect(requests).toEqual(['alice', 'bob']);
    expect(localGames()).toEqual([initial, initial]);
    accepted.resolve();
    await accepted.promise;
    await Promise.resolve();
    flush();
    expect(localGames()).toEqual([winner, winner]);
    time.clock.advance(5_000);
    flush();
    expect(requests).toEqual(['alice', 'bob']);
  }
);
