import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql } from '@libs/harness/identity';
import { Handles } from '@libs/test-ids-shared/handles';
import sql from '@pkgs/sql-root-shared/sql';

export async function lobbyCardVisible(
  s: ProductHarness,
  actorId: string,
  hostUsername: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceCard(hostUsername)).isVisible();
  } catch {
    return false;
  }
}

export async function activeSpaceVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceClose).isVisible();
  } catch {
    return false;
  }
}

export async function spaceMemberVisible(
  s: ProductHarness,
  actorId: string,
  memberId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceMemberRow(memberId)).isVisible();
  } catch {
    return false;
  }
}

export async function spacePresenceCount(
  s: ProductHarness,
  actorId: string
): Promise<number> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = (await ui.get(Handles.spacePresenceCount).text()) ?? '';
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * The link the actor's open space is at (`/space/<id>`) — what its Copy link
 * button hands out — or `null` outside a space.
 */
export async function readSpaceLink(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const actor = s.actors.get(actorId);
  if (actor === undefined) return null;
  const path = await actor.currentPath();
  return /^\/space\/[^/?#]+/.exec(path)?.[0] ?? null;
}

/**
 * People connected to the space, as the members sheet counts them (its
 * hidden count probe), or `null` while the sheet is closed.
 */
export async function readSpacePresenceCount(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = await ui.get(Handles.spacePresenceCount).text();
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** The actor's app says the space they were in has ended. */
export async function spaceEndedShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceEnded).isVisible();
  } catch {
    return false;
  }
}

/** The actor's app offers to join a space. */
export async function joinOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceJoin).isVisible();
  } catch {
    return false;
  }
}

async function shows(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(handle).isVisible();
  } catch {
    return false;
  }
}

async function textOf(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(handle).isVisible())) return null;
    return await ui.get(handle).text();
  } catch {
    return null;
  }
}

/** The actor is invited to Plus after reaching the hosting limit. */
export function hostingLimitShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spacesHostingLimit);
}

/** The actor's app says spaces need a connection. */
export function spacesNeedConnectionShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spacesNeedConnection);
}

/** How many live spaces the actor's Spaces screen says they host. */
export async function hostedSpaceCount(
  s: ProductHarness,
  actorId: string
): Promise<number> {
  const raw = await textOf(s, actorId, Handles.spacesHostingCount);
  const n = Number.parseInt(/\d+/.exec(raw ?? '')?.[0] ?? '0', 10);
  return Number.isFinite(n) ? n : 0;
}

/** The actor's app says the space behind a link cannot be found. */
export function spaceNotFoundShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spaceNotFound);
}

/** The actor's app offers the way back to Spaces from a dead link. */
export function backToSpacesOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spaceNotFoundBack);
}

/** The name the actor's open space shows, or `null` outside a space. */
export function spaceTitleShown(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return textOf(s, actorId, Handles.spaceTitle);
}

/** What the actor's lobby card for `hostUsername`'s space reads. */
export function lobbyCardText(
  s: ProductHarness,
  actorId: string,
  hostUsername: string
): Promise<string | null> {
  return textOf(s, actorId, Handles.spaceCard(hostUsername));
}

/** The actor's rename dialog says the name they typed is not allowed. */
export function spaceNameRefusalShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spaceRenameNotAllowed);
}

/** The actor's open space menu offers to rename the space. */
export function renameOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spaceRename);
}

/**
 * The username a space's lobby card is labelled with (its host's), from the
 * actor's synced copy of the space at `link` (`/space/<id>`): what resolves
 * the card's handle when the host is a guest with a generated name.
 */
export async function localSpaceHostUsername(
  s: ProductHarness,
  actorId: string,
  link: string
): Promise<string | null> {
  const local = actorLocalSql(s, actorId);
  const spaceId = /^\/space\/([^/?#]+)/.exec(link)?.[1];
  if (local === null || spaceId === undefined) return null;
  const rows = await local.query(sql<{ readonly username: string | null }>`
    SELECT p.username
    FROM spaces AS s
    INNER JOIN profile AS p
      ON p.id = COALESCE(s.host_account_id, s.host_member_id)
    WHERE s.id = ${spaceId}
    LIMIT 1`);
  return rows[0]?.username ?? null;
}

/**
 * The name the space at `link` was given, as the actor's device has it
 * (`''` for none): kept even while it is no longer allowed.
 */
export async function localSpaceGivenName(
  s: ProductHarness,
  actorId: string,
  link: string
): Promise<string | null> {
  const local = actorLocalSql(s, actorId);
  const spaceId = /^\/space\/([^/?#]+)/.exec(link)?.[1];
  if (local === null || spaceId === undefined) return null;
  const rows = await local.query(sql<{ readonly title: string | null }>`
    SELECT title FROM spaces WHERE id = ${spaceId} LIMIT 1`);
  const row = rows[0];
  return row === undefined ? null : (row.title ?? '');
}
