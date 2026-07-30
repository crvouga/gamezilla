import { asLocalized } from '@pkgs/i18n';
import {
  createComposedMessageRouter,
  createMessageRouter,
  type MessageRouter,
} from '@pkgs/message';
import type {
  EventLogRouter,
  LogLineContext,
  LogLineDraft,
} from '@pkgs/collab';

import {
  CounterDecremented,
  CounterIncremented,
  counterEvtNs,
} from '../counter';
import type { GameDefinition } from '../game';
import { GameSelected, gamesEvtNs } from '../games';
import {
  MemberJoined,
  MemberLeft,
  SpaceEnded,
  SpaceRenamed,
  SpaceVisibilityChanged,
  spaceLogEvtNs,
} from './space-log-messages';

export const SPACE_LOG_TARGET = {
  title: 'space/title',
  visibility: 'space/visibility',
  members: 'space/members',
  ended: 'space/ended',
  gameSelected: 'games/selected',
  counter: 'counter/count',
} as const;

type DescribeRouter = MessageRouter<void, LogLineContext, LogLineDraft | null>;

function createSpaceLogDescribeRouter(): DescribeRouter {
  return createMessageRouter<void, LogLineContext, LogLineDraft | null>(
    spaceLogEvtNs
  )
    .on(MemberJoined, () => ({
      text: asLocalized('joined'),
      icon: 'log-in',
      targetKeys: [SPACE_LOG_TARGET.members],
    }))
    .on(MemberLeft, () => ({
      text: asLocalized('left'),
      icon: 'log-out',
      targetKeys: [SPACE_LOG_TARGET.members],
    }))
    .on(SpaceRenamed, (_s, _ctx, msg) => ({
      text: asLocalized(`renamed the space to “${msg.payload.title}”`),
      icon: 'square-pen',
      targetKeys: [SPACE_LOG_TARGET.title],
    }))
    .on(SpaceVisibilityChanged, (_s, _ctx, msg) => ({
      text: asLocalized(`set visibility to ${msg.payload.visibility}`),
      targetKeys: [SPACE_LOG_TARGET.visibility],
    }))
    .on(SpaceEnded, () => ({
      text: asLocalized('ended the space'),
      icon: 'door-open',
      targetKeys: [SPACE_LOG_TARGET.ended],
    }));
}

function createGamesDescribeRouter(): DescribeRouter {
  return createMessageRouter<void, LogLineContext, LogLineDraft | null>(
    gamesEvtNs
  ).on(GameSelected, (_s, _ctx, msg) => {
    if (msg.payload.game === null) {
      return {
        text: asLocalized('cleared the selected game'),
        icon: 'gamepad',
        targetKeys: [SPACE_LOG_TARGET.gameSelected],
      };
    }
    return {
      text: asLocalized(`selected ${msg.payload.game}`),
      icon: 'gamepad',
      targetKeys: [SPACE_LOG_TARGET.gameSelected],
    };
  });
}

function createCounterDescribeRouter(): DescribeRouter {
  return createMessageRouter<void, LogLineContext, LogLineDraft | null>(
    counterEvtNs
  )
    .on(CounterIncremented, () => ({
      text: asLocalized('incremented the counter'),
      targetKeys: [SPACE_LOG_TARGET.counter],
    }))
    .on(CounterDecremented, () => ({
      text: asLocalized('decremented the counter'),
      targetKeys: [SPACE_LOG_TARGET.counter],
    }));
}

/**
 * Composed describe-router for space room events → log lines.
 * Game packages may contribute additional routers via {@link GameDefinition.describeEvents}.
 */
export function createSpaceEventLogRouter(
  games: readonly GameDefinition[] = []
): EventLogRouter {
  return createComposedMessageRouter<void, LogLineContext, LogLineDraft | null>(
    [
      { namespace: spaceLogEvtNs, router: createSpaceLogDescribeRouter() },
      { namespace: gamesEvtNs, router: createGamesDescribeRouter() },
      { namespace: counterEvtNs, router: createCounterDescribeRouter() },
      ...games.flatMap((game) =>
        game.describeEvents !== undefined ? [...game.describeEvents] : []
      ),
    ]
  );
}
