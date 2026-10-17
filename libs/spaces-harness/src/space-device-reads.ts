import type { ProductHarness } from '@libs/harness/harness';
import { actorHtml, bringToFront, visible } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

/** Lines of a hidden probe. An empty probe is no lines. */
export function probeLines(text: string): readonly string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Text of a probe that is in the tree but not shown as a control. */
export async function hiddenProbeText(
  s: ProductHarness,
  actorId: string,
  testId: string
): Promise<string> {
  try {
    await bringToFront(s, actorId);
    const html = (await actorHtml(s, actorId)) ?? '';
    const pattern = new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</`);
    return (pattern.exec(html)?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
  } catch {
    return '';
  }
}

export async function presencePeople(
  s: ProductHarness,
  actorId: string
): Promise<readonly string[]> {
  return probeLines(
    await hiddenProbeText(s, actorId, Handles.spacePresencePeople)
  );
}

export async function presenceIdle(
  s: ProductHarness,
  actorId: string
): Promise<readonly string[]> {
  return probeLines(
    await hiddenProbeText(s, actorId, Handles.spacePresenceIdle)
  );
}

/** Space ids this device shows it hosts, one per line. */
export async function hostedSpaceIds(
  s: ProductHarness,
  actorId: string
): Promise<readonly string[]> {
  return probeLines(
    await hiddenProbeText(s, actorId, Handles.spacesHostedProbe)
  );
}

export async function connectionMissingShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  if (await visible(s, actorId, [Handles.connectionMissing])) return true;
  return visible(s, actorId, [Handles.statusConnectionMissing]);
}

export function gameChoiceRefusedShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.gameChoiceRefused]);
}

export function chessChoiceOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.gameMenu('chess')]);
}

export function spaceBackOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.navBack]);
}

/** How many presence rows name this person. The sheet is already open. */
export async function memberRowCount(
  s: ProductHarness,
  actorId: string,
  memberId: string
): Promise<number> {
  await bringToFront(s, actorId);
  const html = (await actorHtml(s, actorId)) ?? '';
  const needle = `data-testid="${Handles.spaceMemberRow(memberId)}"`;
  return html.split(needle).length - 1;
}
