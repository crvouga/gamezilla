import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorHtml, bringToFront } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** What these devices are showing about who is here, who is idle, and which spaces are hosted. */
export type ShownSpaceDevices = {
  readonly counted: ReadonlySet<string>;
  readonly idle: ReadonlySet<string>;
  readonly hostedIds: ReadonlySet<string>;
  readonly invitedToPlus: boolean;
};

function matchedIds(html: string, pattern: RegExp): readonly string[] {
  return [...html.matchAll(pattern)]
    .map((match) => match[1] ?? '')
    .filter((id) => id.length > 0);
}

function hostedIdsIn(html: string): readonly string[] {
  const match = new RegExp(
    `data-testid="${Handles.spacesHostingLive}"[^>]*>([^<]*)<`
  ).exec(html);
  const text = match?.[1]?.trim() ?? '';
  if (text.length === 0) return [];
  return text.split(/\s+/);
}

/**
 * Union of what `actorIds` show. Hosted spaces and the Plus invitation are
 * read only from `hostIds`, the devices of the person who hosts.
 */
export async function shownSpaceDevices(
  s: ProductHarness,
  actorIds: readonly string[],
  hostIds: readonly string[]
): Promise<ShownSpaceDevices> {
  const hosts = new Set(hostIds);
  const counted = new Set<string>();
  const idle = new Set<string>();
  const hostedIds = new Set<string>();
  let invitedToPlus = false;
  for (const actorId of actorIds) {
    if (!s.actors.has(actorId)) continue;
    await bringToFront(s, actorId);
    const html = (await actorHtml(s, actorId)) ?? '';
    for (const id of matchedIds(html, /data-testid="space-person-([^"]+)"/g)) {
      counted.add(id);
    }
    for (const id of matchedIds(
      html,
      /data-testid="space-member-idle-([^"]+)"/g
    )) {
      idle.add(id);
    }
    if (!hosts.has(actorId)) continue;
    for (const id of hostedIdsIn(html)) hostedIds.add(id);
    if (html.includes(`data-testid="${Handles.spacesHostingLimit}"`)) {
      invitedToPlus = true;
    }
  }
  return { counted, idle, hostedIds, invitedToPlus };
}
