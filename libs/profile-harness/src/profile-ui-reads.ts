import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { standInName, usernameText } from '@libs/moderation-shared/display';
import { Handles } from '@libs/test-ids-shared/handles';
import sql from '@pkgs/sql-root-shared/sql';
import {
  backToProfileTab,
  leaveUsernameEditor,
  NAV_WAIT_MS,
  openProfileEdit,
} from './profile-actions';

/** The saved username exposed in its owner's editable field, without saving. */
export async function readSavedProfileUsername(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  await Promise.resolve(openProfileEdit.act(s, actorId));
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.profileEditUsername).tap();
  const input = ui.get(Handles.profileUsernameInput);
  await input.expect.visible();
  const name = await input.text();
  await Promise.resolve(leaveUsernameEditor.act(s, actorId));
  return name;
}

export async function readUsername(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = await ui.get(Handles.profileDisplayUsername).text();
    if (raw === null) return null;
    return raw.startsWith('@') ? raw.slice(1) : raw;
  } catch {
    return null;
  }
}

export async function readAvatarSeed(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.profileAvatarSeed).text();
  } catch {
    return null;
  }
}

export async function readAvatarStyleLabel(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.profileAvatarStyle).text();
  } catch {
    return null;
  }
}

export async function avatarTraitVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.profileAvatarTrait).isVisible();
  } catch {
    return false;
  }
}

/** The username save button's face: `Saved`, or why the name was refused. */
export async function readUsernameSaveFace(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    await bringToFront(s, actorId);
    const ui = await actorUi(s, actorId);
    const save = ui.get(Handles.profileUsernameSave);
    const face = (await save.isVisible())
      ? (await save.text())?.trim()
      : undefined;
    if (face !== undefined && !['Save', 'Saving…', 'Saved'].includes(face))
      return face;
    return (await readUsernameSharedRefusalFace(s, actorId)) ?? face ?? null;
  } catch {
    return null;
  }
}

/** The durable refusal shown after this device's accepted choice is shared. */
export async function readUsernameSharedRefusalFace(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const refusal = (await actorUi(s, actorId)).get(
    Handles.profileUsernameRefusal
  );
  if (!(await refusal.isVisible())) return null;
  const text = await refusal.text();
  return (
    [
      'Username is taken',
      'That username is not allowed',
      'Username was changed recently',
    ].find((label) => text?.includes(label)) ?? null
  );
}

/** The profile explains that this device's accepted choice will be shared later. */
export async function usernameWaitingToShareShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  await bringToFront(s, actorId);
  const ui = await actorUi(s, actorId);
  if (!(await ui.get(Handles.profileDisplayUsername).isVisible()))
    await backToProfileTab(ui);
  return ui.get(Handles.profileUsernamePending).isVisible();
}

/** The Profile tab's username, read from the tab itself (opens it). */
export async function readProfileTabUsername(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabProfile).tap({ timeoutMs: 2_000 });
    return await readUsername(s, actorId);
  } catch {
    return null;
  }
}

/**
 * The username the actor's Profile tab shows, backing out to it first from
 * any profile or account screen. `null` while it cannot be read.
 */
export async function readProfileUsernameShown(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  try {
    await bringToFront(s, actorId);
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.profileDisplayUsername).isVisible()))
      await backToProfileTab(ui);
    return await readUsername(s, actorId);
  } catch {
    return null;
  }
}

export type SavedAvatar = {
  readonly seed: string | null;
  readonly styleLabel: string | null;
  /** The style's trait picker is offered (the style loaded its options). */
  readonly traitShown: boolean;
};

/**
 * The avatar the actor has saved, as the avatar editor shows it. Opens the
 * editor from wherever the actor is, reads it, then backs out to the Profile
 * tab untouched. `null` while the editor cannot be reached.
 */
export async function readSavedAvatar(
  s: ProductHarness,
  actorId: string
): Promise<SavedAvatar | null> {
  try {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.profileAvatarSeed).isVisible())) {
      await backToProfileTab(ui);
      await ui.get(Handles.profileEdit).tap({ timeoutMs: NAV_WAIT_MS });
      await ui.get(Handles.profileEditAvatar).tap({ timeoutMs: NAV_WAIT_MS });
    }
    const avatar = {
      seed: await ui.get(Handles.profileAvatarSeed).text(),
      styleLabel: await ui.get(Handles.profileAvatarStyle).text(),
      traitShown: await ui.get(Handles.profileAvatarTrait).isVisible(),
    };
    await ui.get(Handles.profileAvatarCancel).tap({ timeoutMs: NAV_WAIT_MS });
    await backToProfileTab(ui);
    return avatar;
  } catch {
    return null;
  }
}

/**
 * The actor's profile id, as their device knows its own person (a guest's
 * anonymous account included), or `null` before the app has one.
 */
export async function profileIdOf(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const id = (await s.harness.client(actorId)).secureStorage.getValue(
    LAST_LOCAL_ACCOUNT_ID_KEY
  );
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * The stand-in name everyone sees for the actor while their username is no
 * longer allowed (the same every time for that person).
 */
export async function standInNameOf(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const id = await profileIdOf(s, actorId);
  return id === null ? null : standInName(id);
}

/**
 * The actor's Profile tab tells them other people see a stand-in name until
 * they rename themselves (backs out to the tab first).
 */
export async function standInNoticeShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    await backToProfileTab(ui);
    return await ui.get(Handles.profileStandInNotice).isVisible();
  } catch {
    return false;
  }
}

/**
 * The actor's name as everyone else sees it: their saved username, or their
 * stand-in name while it is no longer allowed.
 */
export async function nameEveryoneSeesOf(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const id = await profileIdOf(s, actorId);
  if (id === null) return null;
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly username: string;
  }>`
    SELECT username FROM profile WHERE id = ${id} AND deleted_at IS NULL`);
  const username = rows[0]?.username;
  if (username === undefined) return null;
  return usernameText(s.harness.teamRules.moderation.current(), username, id);
}
