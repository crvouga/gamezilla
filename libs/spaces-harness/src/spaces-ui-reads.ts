import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql, deviceMemberIdOf } from '@libs/harness/identity';
import { actorHtml, bringToFront } from '@libs/harness/observations';
import { otherDevice } from '@libs/harness/platform';
import { Handles } from '@libs/test-ids-shared/handles';
import sql from '@pkgs/sql-root-shared/sql';

/** Each person's own retained space, including changes made offline. */
export async function openSpaceHosts(
  s: ProductHarness,
  people: readonly string[]
): Promise<Set<string>> {
  const hosts = new Set<string>();
  for (const person of people) {
    if (!s.actors.has(person)) continue;
    const db = actorLocalSql(s, person);
    const member = await deviceMemberIdOf(s, person);
    if (db === null || member === null) continue;
    const rows = await db.query(sql<{ readonly id: string }>`
      SELECT id FROM spaces
      WHERE COALESCE(host_account_id, host_member_id) = ${member}
        AND ended_at IS NULL AND deleted_at IS NULL
    `);
    if (rows.length > 0) hosts.add(person);
  }
  return hosts;
}

/** A parked phone's screen reads as empty until its tree is in front. */
async function frontUi(s: ProductHarness, actorId: string) {
  await bringToFront(s, actorId);
  return actorUi(s, actorId);
}

export async function lobbyCardVisible(
  s: ProductHarness,
  actorId: string,
  hostUsername: string
): Promise<boolean> {
  try {
    const ui = await frontUi(s, actorId);
    return await ui.get(Handles.spaceCard(hostUsername)).isVisible();
  } catch {
    return false;
  }
}

/** The actual lobby card for the shared link, independent of cached names. */
export async function lobbySpaceCardVisible(
  s: ProductHarness,
  actorId: string,
  spaceLink: string
): Promise<boolean> {
  const ui = await frontUi(s, actorId);
  return ui.get(lobbySpaceCardHandle(spaceLink)).isVisible();
}

export async function lobbySpaceCardText(
  s: ProductHarness,
  actorId: string,
  spaceLink: string
): Promise<string | null> {
  const ui = await frontUi(s, actorId);
  return ui.get(lobbySpaceCardHandle(spaceLink)).text();
}

function lobbySpaceCardHandle(spaceLink: string): string {
  const spaceId = /^\/space\/([^/?#]+)/.exec(spaceLink)?.[1];
  if (spaceId === undefined) throw new Error(`Not a space link: ${spaceLink}`);
  return Handles.spaceLobbyCard(spaceId);
}

export async function activeSpaceVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await frontUi(s, actorId);
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
    const ui = await frontUi(s, actorId);
    return await ui.get(Handles.spaceMemberRow(memberId)).isVisible();
  } catch {
    return false;
  }
}

/** The name a connected person's row shows in the space's presence. */
export function spaceMemberName(
  s: ProductHarness,
  actorId: string,
  memberId: string
): Promise<string | null> {
  return textOf(s, actorId, Handles.spaceMemberName(memberId));
}

export async function spacePresenceCount(
  s: ProductHarness,
  actorId: string
): Promise<number> {
  try {
    const ui = await frontUi(s, actorId);
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
    const ui = await frontUi(s, actorId);
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
    const ui = await frontUi(s, actorId);
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
    const ui = await frontUi(s, actorId);
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
    const ui = await frontUi(s, actorId);
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
    const ui = await frontUi(s, actorId);
    if (!(await ui.get(handle).isVisible())) return null;
    return await ui.get(handle).text();
  } catch {
    return null;
  }
}

/** A lobby card or a saved space offers the way back into a space. */
export async function returnToSpaceOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  await bringToFront(s, actorId);
  const html = await actorHtml(s, actorId);
  if (html === null) return false;
  return (
    html.includes('data-testid="space-card-') ||
    html.includes('data-testid="space-miniplayer-open-')
  );
}

/** The other device is on the same open space as this one. */
export async function otherDeviceInSameSpace(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const here = await readSpaceLink(s, actorId);
  const there = await readSpaceLink(s, otherDevice(actorId));
  return here !== null && here === there;
}

/**
 * The person is invited to Plus after reaching the hosting limit.
 * The device that tried to host another space is the one that says so.
 */
export async function hostingLimitShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  if (await shows(s, actorId, Handles.spacesHostingLimit)) return true;
  const phone = otherDevice(actorId);
  if (!s.actors.has(phone)) return false;
  return shows(s, phone, Handles.spacesHostingLimit);
}

/** The actor's app explains why joining needs a connection. */
export function spacesNeedConnectionShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spacesNeedConnection);
}

/** The space explicitly says its host is offline. */
export function spaceHostOfflineShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spaceHostOffline);
}

/** A joined person can remove their own account's membership. */
export function leaveOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spaceLeave);
}

/** A refused join stays available as an explicit retry. */
export async function joinRetryOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return (
    (await textOf(s, actorId, Handles.spaceJoin))?.includes("Couldn't join") ??
    false
  );
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

/** The actor's app offers the way back to Spaces from a dead link or a space it can't reach. */
export async function backToSpacesOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return (
    (await shows(s, actorId, Handles.spaceNotFoundBack)) ||
    (await shows(s, actorId, Handles.spaceUnreachableBack)) ||
    ((await shows(s, actorId, Handles.spaceJoinPrompt)) &&
      (await shows(s, actorId, Handles.navBack)))
  );
}

/** The actor's app says the space can't be reached right now. */
export function spaceUnreachableShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spaceUnreachable);
}

/** The actor's app offers to try reaching the space again. */
export function spaceRetryOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return shows(s, actorId, Handles.spaceUnreachableRetry);
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
