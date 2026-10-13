/**
 * `specs/friends/inbox-items.qnt` against the inbox a person uses.
 * Opening, marking read, archiving, choosing a list, a day passing, and a
 * device losing or regaining its connection are the same actions the
 * scenarios run. The friend request's place, the list on screen, and whether
 * the connection is said to be missing are read back from the app.
 */

import {
  archiveInboxItem,
  chooseInboxList,
  connectionMissingShown,
  type InboxList,
  markInboxRead,
  openInboxItem,
} from '@libs/friends-harness/inbox-items';
import { setupFriendRequest } from '@libs/friends-harness/setup-friend-request';
import {
  letTimePass,
  partition,
  restoreActorConnection,
  spawnActor,
} from '@libs/harness/actions';
import { actorUi } from '@libs/harness/actor-ui';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql } from '@libs/harness/identity';
import { bringToFront } from '@libs/harness/observations';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { openInbox } from '@libs/notifications-harness/notifications-actions';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import sql from '@pkgs/sql-root-shared/sql';

const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST = 'request';
const FROM = 'alice';
const DEVICES = ['bob', 'bob_phone'] as const;

const MODEL_ACTOR: Record<string, string> = {
  bob: 'bob',
  'bob-phone': 'bob_phone',
};

const LIST_HANDLE = {
  ordinary: Handles.notificationsFilterAll,
  waiting: Handles.notificationsFilterWaiting,
  archived: Handles.notificationsFilterArchived,
} as const;

type NoteRow = {
  readonly read_at: string | number | null;
  readonly archived_at: string | number | null;
  readonly dismissed_at: string | number | null;
};

function actorOf(picks: Picks): string {
  const device = String(picks['device']);
  const actor = MODEL_ACTOR[device];
  if (actor === undefined) throw new Error(`inbox: unknown device ${device}`);
  return actor;
}

function listOf(picks: Picks): InboxList {
  const which = String(picks['which']);
  if (which !== 'ordinary' && which !== 'waiting' && which !== 'archived') {
    throw new Error(`inbox: unknown list ${which}`);
  }
  return which;
}

function offlineActors(s: ProductHarness): Set<string> {
  const ids = new Set<string>();
  for (const [left, right] of s.session.network.partitions()) {
    ids.add(left);
    ids.add(right);
  }
  return ids;
}

function readerOf(s: ProductHarness): string {
  const offline = offlineActors(s);
  return DEVICES.find((id) => !offline.has(id)) ?? 'bob';
}

function marked(value: string | number | null): boolean {
  return value !== null && value !== '';
}

async function requestRow(
  s: ProductHarness,
  actorId: string
): Promise<NoteRow | null> {
  const db = actorLocalSql(s, actorId);
  if (db === null) return null;
  const rows = await db.query(sql<NoteRow>`
    SELECT read_at, archived_at, dismissed_at
    FROM notifications
    WHERE source_namespace = 'friends'
      AND source_type = 'friend-request'
      AND deleted_at IS NULL
      AND dismissed_at IS NULL
    LIMIT 1`);
  return rows[0] ?? null;
}

async function listShown(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  await bringToFront(s, actorId);
  const ui = await actorUi(s, actorId);
  for (const name of ['archived', 'waiting', 'ordinary'] as const) {
    const chip = ui.get(LIST_HANDLE[name]);
    if (!(await chip.isVisible())) continue;
    if ((await chip.attribute('aria-checked')) === 'true') return name;
  }
  return null;
}

async function toldShown(s: ProductHarness): Promise<string> {
  for (const actor of DEVICES) {
    await bringToFront(s, actor);
    if (await connectionMissingShown(s, actor)) return 'missing';
  }
  return '';
}

async function itemSets(s: ProductHarness): Promise<{
  readonly unopened: Set<string>;
  readonly opened: Set<string>;
  readonly archived: Set<string>;
}> {
  const row = await requestRow(s, readerOf(s));
  const unopened = new Set<string>();
  const opened = new Set<string>();
  const archived = new Set<string>();
  if (row === null) return { unopened, opened, archived };
  if (marked(row.archived_at)) archived.add(REQUEST);
  else if (marked(row.read_at)) opened.add(REQUEST);
  else unopened.add(REQUEST);
  return { unopened, opened, archived };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'inbox-items',
  traces: 16,
  maxSteps: 6,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await setupFriendRequest(w.s, FROM, 'bob');
      await w.s.apply(spawnActor, 'bob_phone');
      await w.s.apply(signInWithGoogleAsAccount, 'bob_phone', 'bob');
      await w.s.apply(returnToTabs, 'bob_phone');
      await w.s.apply(openInbox, 'bob');
      await w.s.apply(openInbox, 'bob_phone');
      await w.s.until((s) => requestRow(s, 'bob'), {
        pred: (row) => row !== null,
        maxMs: 15_000,
      });
    },
    openItem: async (w, picks) => {
      await w.s.apply(openInboxItem, actorOf(picks), FROM);
    },
    markAllRead: async (w, picks) => {
      await w.s.apply(markInboxRead, actorOf(picks));
    },
    archiveItem: async (w, picks) => {
      await w.s.apply(archiveInboxItem, actorOf(picks), FROM);
    },
    chooseList: async (w, picks) => {
      const which = listOf(picks);
      await w.s.apply(chooseInboxList, 'bob', which);
      await w.s.apply(chooseInboxList, 'bob_phone', which);
    },
    dayPasses: async (w) => {
      await w.s.apply(letTimePass, DAY_MS);
    },
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, actorOf(picks));
    },
    connectionReturns: async (w, picks) => {
      await w.s.apply(restoreActorConnection, actorOf(picks));
    },
  },
  observe: async (w) => {
    const items = await w.quiet.read(itemSets);
    const list = (await w.quiet.read(listShown, 'bob')) ?? 'unshown';
    const told = await w.quiet.read(toldShown);
    return { ...items, list, told };
  },
});
