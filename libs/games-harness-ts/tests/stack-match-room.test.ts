import { expect, test } from 'bun:test';
import {
  MultiplayerGameChanged,
  matchRoomGame,
  matchRoomTopic,
} from '@libs/game-matchmaking-shared-ts/match-room';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import { createHarnessRooms } from '@libs/harness-ts/room-services';
import { openConformanceHarness } from './conformance-world';

const publishMatchedFixture = scenarioAction({
  name: 'publishMatchedFixture',
  act: async ({ harness, session }, id: string) => {
    const fixture = createHarnessRooms({
      composition: harness.composition,
      session,
      seed: 1n,
      timers: session.ports.timers,
      serverSql: harness.serverSql,
      serverRooms: harness.roomNode.services,
    });
    try {
      const timeControl = id + '/play';
      const receipt = await fixture.rooms.send(
        matchRoomTopic(id),
        'formation',
        MultiplayerGameChanged({
          id,
          white_id: 'alice',
          black_id: 'bob',
          time_control: timeControl,
          fen: harness.composition.app.turnGames
            .forControl(timeControl)
            .initial(),
          pgn: '',
          revision: 0,
          turn: '',
          outcome: 'ongoing',
          reason: null,
          paused_at_ms: null,
        })
      );
      expect(receipt.ok).toBe(true);
    } finally {
      fixture.roomNode.dispose();
    }
  },
});

// regression: matched-setup-publishes-to-spec-room
test.each(['pong', 'light-cycles'])(
  'the room serving Alice and Bob receives their matched %s game',
  async (id) => {
    await using run = await openConformanceHarness();
    await run.apply(publishMatchedFixture, id);
    const published = await run.read(async ({ harness }) =>
      matchRoomGame(await harness.roomNode.services.read(matchRoomTopic(id)))
    );
    expect(published).toMatchObject({
      id,
      white_id: 'alice',
      black_id: 'bob',
      time_control: id + '/play',
      execution: { started: false, missing: ['black', 'white'] },
    });
  }
);
