/**
 * `specs/spaces/space-names.qnt` against the friends composition: Alice
 * hosts a space Bob is in; each rename goes through the space's rename
 * dialog, the team's rules through the deployment's rules, the connection
 * through the network. Read back: what each person's space screen calls the
 * space, the name Alice's device keeps, which model names the rules refuse,
 * and what Alice's last rename showed.
 */

import { setupFriendsPair } from '@libs/friends-harness/setup-friends-pair';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import type { ProductHarness } from '@libs/harness/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { focusActor } from '@libs/harness/shell-actions';
import {
  createSpace,
  joinFromLobby,
  openSpacesTab,
  renameSpace,
} from '@libs/spaces-harness/space-actions';
import {
  cancelRenameSpace,
  startAllowingSpaceName,
  stopAllowingSpaceName,
} from '@libs/spaces-harness/space-name-rule-actions';
import {
  localSpaceGivenName,
  localSpaceHostUsername,
  readSpaceLink,
  spaceNameRefusalShown,
  spaceTitleShown,
} from '@libs/spaces-harness/spaces-ui-reads';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const HOST = 'alice';
const GUEST = 'bob';
const PEOPLE = [HOST, GUEST] as const;

/** Space names the model types or rules on (other than no name). */
const MODEL_NAMES = [
  'Friday puzzles',
  'Cheater corner',
  'free coins at spam.gg',
] as const;

/** What a space with no allowed name of its own is called, in the model. */
const NAMED_AFTER_HOST = 'named after Alice';

/** Long enough for a device to notice its connection went or came back. */
const NOTICE_MS = 2_000;

const LINK = 'space-link';
const HOST_NAME = 'host-username';
const LAST_RENAME = 'last-rename';

function memoString(w: QuintHarnessWorld, key: string): string {
  const value = w.memo.get(key);
  if (typeof value !== 'string') throw new Error(`no ${key} recorded`);
  return value;
}

/** The deployment's rules refuse `name` as a space name right now. */
function refusedNow(s: ProductHarness, name: string): boolean {
  return !s.harness.teamRules.moderation
    .current()
    .checkWrite('spaceTitle', name).allowed;
}

/** A space screen's title, in the model's terms. */
function asModelName(w: QuintHarnessWorld, shown: string | null): string {
  if (shown === null) return '(no space)';
  const host = memoString(w, HOST_NAME);
  return shown.includes(host) && shown.endsWith("'s space")
    ? NAMED_AFTER_HOST
    : shown;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-names',
  traces: 8,
  maxSteps: 10,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await setupFriendsPair(w.s, HOST, GUEST);
      await w.s.apply(focusActor, HOST);
      await w.s.apply(createSpace, HOST);
      const link = await w.s.read(readSpaceLink, HOST);
      if (link === null) throw new Error('alice opened no space');
      w.memo.set(LINK, link);
      const host = await w.s.until(
        (s: ProductHarness) => localSpaceHostUsername(s, HOST, link),
        { pred: (name) => name !== null && name.length > 0 }
      );
      w.memo.set(HOST_NAME, host);
      await w.s.apply(focusActor, GUEST);
      await w.s.apply(openSpacesTab, GUEST);
      await w.s.apply(joinFromLobby, GUEST, HOST);
    },
    rename: async (w, picks) => {
      await w.s.apply(focusActor, HOST);
      await w.s.apply(renameSpace, HOST, String(picks['typed']));
      const refused = await w.s.read(spaceNameRefusalShown, HOST);
      w.memo.set(LAST_RENAME, refused ? 'NameNotAllowed' : 'NameSaved');
      if (refused) await w.s.apply(cancelRenameSpace, HOST);
    },
    stopAllowing: async (w, picks) => {
      await w.s.apply(stopAllowingSpaceName, String(picks['name']));
    },
    startAllowing: async (w, picks) => {
      await w.s.apply(startAllowingSpaceName, String(picks['name']));
    },
    _loseConnection: async (w, picks) => {
      await w.s.apply(partition, String(picks['person']));
      await w.s.advanceTime(NOTICE_MS);
    },
    _connectionReturns: async (w, picks) => {
      await w.s.apply(restoreActorConnection, String(picks['person']));
      await w.s.advanceTime(NOTICE_MS);
    },
  },
  observe: async (w) => {
    const link = memoString(w, LINK);
    const spaceName = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      await w.s.apply(focusActor, actor);
      spaceName.set(
        actor,
        asModelName(w, await w.quiet.read(spaceTitleShown, actor))
      );
    }
    const lastRename = w.memo.get(LAST_RENAME);
    return {
      givenName:
        (await w.quiet.read(localSpaceGivenName, HOST, link)) ?? '(no space)',
      spaceName,
      notAllowed: new Set(
        await w.quiet.read((s: ProductHarness) =>
          MODEL_NAMES.filter((name) => refusedNow(s, name))
        )
      ),
      lastRename: variant(
        typeof lastRename === 'string' ? lastRename : 'NoRename'
      ),
    };
  },
});
