import {
  MULTIPLAYER_NOTICE_NAMESPACE,
  MULTIPLAYER_RESULT_NOTICE,
  MULTIPLAYER_TURN_NOTICE,
  multiplayerTurnNoticeSource,
} from '@libs/chess-matchmaking-shared/multiplayer-notices';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql, signedInAccountOf } from '@libs/harness/identity';
import { openInbox } from '@libs/notifications-harness/notifications-actions';
import type { Notification } from '@libs/notifications-shared/notification';
import {
  buildNotificationId,
  notificationCardOpenTestId,
  notificationCardTestId,
} from '@libs/notifications-shared/notification-id';
import { inboxListSql } from '@libs/notifications-shared/notifications-queries';
import { clientRowToInteraction } from '@libs/notifications-shared/row-mapper';
import sql from '@pkgs/sql-root-shared/sql';
import { multiplayerFixture } from './multiplayer-fixtures';

export type MultiplayerNoticeKind = 'turn' | 'result';

/** One turn notice or result notice as a person's inbox shows it. */
export type ShownMultiplayerNotice = {
  readonly kind: MultiplayerNoticeKind;
  readonly gameId: string;
  /** The multiplayer opponent it names. */
  readonly opponentUserId: string;
  readonly unread: boolean;
  /** The turn notice is a turn reminder: the person is low on time. */
  readonly reminder: boolean;
  /** A result notice's `won`, `lost`, `drawn` or `aborted`. */
  readonly result: string | null;
  readonly reason: string | null;
  /** The side that ran out of time, when that is the reason. */
  readonly flaggedSide: string | null;
  /** Everything the card reads. */
  readonly text: string;
};

/** What multiplayer chess puts on screen: the game, or how to find one. */
const MULTIPLAYER_SURFACES = [
  'multiplayer-game',
  'multiplayer-waiting',
  'multiplayer-find',
] as const;

const KINDS: Readonly<Record<string, MultiplayerNoticeKind>> = {
  [MULTIPLAYER_TURN_NOTICE]: 'turn',
  [MULTIPLAYER_RESULT_NOTICE]: 'result',
};

function field(notice: Notification, key: string): string | null {
  const value = notice.payload[key];
  return typeof value === 'string' ? value : null;
}

function sourceOf(notice: Notification) {
  return {
    namespace: notice.sourceNamespace,
    type: notice.sourceType,
    id: notice.sourceId,
  };
}

/** The inbox's own list on this device, narrowed to multiplayer notices. */
async function inboxNotices(
  s: ProductHarness,
  actor: string
): Promise<readonly Notification[]> {
  const db = actorLocalSql(s, actor);
  const owner = await signedInAccountOf(s, actor);
  if (db === null || owner === null) return [];
  const rows = await db.query(inboxListSql(owner, 'all'));
  return rows
    .map((row) => clientRowToInteraction({ ...row }))
    .filter(
      (notice) =>
        notice.sourceNamespace === MULTIPLAYER_NOTICE_NAMESPACE &&
        KINDS[notice.sourceType] !== undefined
    );
}

function shownAs(notice: Notification, text: string): ShownMultiplayerNotice {
  return {
    kind: KINDS[notice.sourceType]!,
    gameId: notice.sourceId,
    opponentUserId: field(notice, 'opponentUserId') ?? '',
    unread: notice.isUnread,
    reminder: notice.payload['reminder'] === true,
    result: field(notice, 'result'),
    reason: field(notice, 'reason'),
    flaggedSide: field(notice, 'flaggedSide'),
    text,
  };
}

/**
 * The turn notices and result notices a device's inbox lists, read without
 * touching its screen: what a model compares after every step.
 */
export async function heldMultiplayerNotices(
  s: ProductHarness,
  actor: string
): Promise<readonly ShownMultiplayerNotice[]> {
  return (await inboxNotices(s, actor)).map((notice) =>
    shownAs(notice, notice.title)
  );
}

/**
 * The turn notices and result notices on a person's inbox screen (opens the
 * inbox): each card that is on screen, with what it says.
 */
export async function shownMultiplayerNotices(
  s: ProductHarness,
  actor: string
): Promise<readonly ShownMultiplayerNotice[]> {
  await Promise.resolve(openInbox.act(s, actor));
  const ui = await actorUi(s, actor);
  const shown: ShownMultiplayerNotice[] = [];
  for (const notice of await inboxNotices(s, actor)) {
    const card = ui.get(notificationCardTestId(sourceOf(notice)));
    if (!(await card.isVisible())) continue;
    shown.push(shownAs(notice, (await card.text()) ?? ''));
  }
  return shown;
}

/**
 * The person opens their turn notice or result notice from the inbox and
 * lands on multiplayer chess.
 */
export const openMultiplayerNotice = scenarioAction({
  name: 'openMultiplayerNotice',
  act: async (s, actor: string, kind: MultiplayerNoticeKind) => {
    await Promise.resolve(openInbox.act(s, actor));
    const notice = (await inboxNotices(s, actor)).find(
      (candidate) => KINDS[candidate.sourceType] === kind
    );
    if (notice === undefined)
      throw new Error(`${actor}'s inbox shows no ${kind} notice`);
    const ui = await actorUi(s, actor);
    // A card with its own control opens from its text; any other, anywhere.
    const target =
      notice.actions.length > 0
        ? notificationCardOpenTestId(sourceOf(notice))
        : notificationCardTestId(sourceOf(notice));
    await ui.get(target).tap();
    await s.session.waitForIdle();
    await pollUntil(
      s,
      async () => {
        for (const surface of MULTIPLAYER_SURFACES)
          if (await ui.get(surface).isVisible()) return true;
        return null;
      },
      { maxMs: 5000, description: 'multiplayer chess from the notice' }
    );
  },
});

/**
 * Setup: the person opened their turn notice on the turn it was for, so it
 * is no longer unread — even once their own move has taken it away.
 */
export const givenOpenedTurnNotice = scenarioAction({
  name: 'givenOpenedTurnNotice',
  act: (s, actor: string, gameId: string) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      const nowIso = env.now().toISOString();
      const id = buildNotificationId(
        multiplayerTurnNoticeSource(gameId),
        env.actorId
      );
      await tx.run(
        sql`UPDATE notifications SET read_at = ${nowIso}, updated_at = ${nowIso} WHERE id = ${id}`
      );
      return [env.actorId];
    }),
});
