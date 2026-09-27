import { actorUi } from '@libs/sim-harness/system/actor-ui';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';

export async function readUsername(
  s: ProductSim,
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
  s: ProductSim,
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
  s: ProductSim,
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
  s: ProductSim,
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
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    const face = await ui.get(Handles.profileUsernameSave).text();
    return face === null ? null : face.trim();
  } catch {
    return null;
  }
}

/** The Profile tab's username, read from the tab itself (opens it). */
export async function readProfileTabUsername(
  s: ProductSim,
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

export type SavedAvatar = {
  readonly seed: string | null;
  readonly styleLabel: string | null;
  /** The style's trait picker is offered (the style loaded its options). */
  readonly traitShown: boolean;
};

/**
 * The avatar the actor has saved, as the avatar editor shows it. Opens the
 * editor from wherever the actor is (the Profile tab, Edit profile, or the
 * editor itself), reads it, then backs out to the Profile tab untouched.
 * `null` when the editor cannot be reached.
 */
export async function readSavedAvatar(
  s: ProductSim,
  actorId: string
): Promise<SavedAvatar | null> {
  try {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.profileAvatarSeed).isVisible())) {
      if (!(await ui.get(Handles.profileEditAvatar).isVisible())) {
        await ui.get(Handles.tabProfile).tap({ timeoutMs: 2_000 });
        await ui.get(Handles.profileEdit).tap({ timeoutMs: 2_000 });
      }
      await ui.get(Handles.profileEditAvatar).tap({ timeoutMs: 2_000 });
    }
    const avatar = {
      seed: await ui.get(Handles.profileAvatarSeed).text(),
      styleLabel: await ui.get(Handles.profileAvatarStyle).text(),
      traitShown: await ui.get(Handles.profileAvatarTrait).isVisible(),
    };
    await ui.get(Handles.profileAvatarCancel).tap({ timeoutMs: 2_000 });
    await ui.get(Handles.navBack).tap({ timeoutMs: 2_000 });
    await ui.get(Handles.profileEdit).expect.visible();
    return avatar;
  } catch {
    return null;
  }
}
