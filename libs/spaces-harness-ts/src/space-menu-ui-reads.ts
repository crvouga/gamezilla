import { actorUi, pollUntil } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { tapChromeOrOverflow } from './space-ui';

const MENU_WAIT_MS = 5_000;

type ActorUi = Awaited<ReturnType<typeof actorUi>>;

/** Wait until the space menu is open, or closed again. */
async function menuIs(
  s: ProductHarness,
  ui: ActorUi,
  open: boolean
): Promise<void> {
  const menu = ui.get(Handles.spaceChromeOverflow);
  await pollUntil(
    s,
    async () =>
      ((await menu.attribute('aria-expanded')) === 'true') === open
        ? true
        : null,
    {
      maxMs: MENU_WAIT_MS,
      description: `the space menu to be ${open ? 'open' : 'closed'}`,
    }
  );
}

/**
 * Look in the space menu the way a person does: open it, look, and close it
 * again. The list of people covers the top bar, so a person looking at it
 * closes it first and comes back to it afterwards. `null` outside a space.
 */
async function lookInSpaceMenu<T>(
  s: ProductHarness,
  actorId: string,
  look: (ui: ActorUi) => Promise<T>
): Promise<T | null> {
  const ui = await actorUi(s, actorId);
  const menu = ui.get(Handles.spaceChromeOverflow);
  if (!(await menu.isVisible())) return null;
  const people = ui.get(Handles.spaceMembersClose);
  const covered = await people.isVisible();
  if (covered) {
    await people.tap({ timeoutMs: MENU_WAIT_MS });
    await people.expect.hidden({ timeoutMs: MENU_WAIT_MS });
  }
  await menu.tap({ timeoutMs: MENU_WAIT_MS });
  await menuIs(s, ui, true);
  const seen = await look(ui);
  await ui.key('escape');
  await menuIs(s, ui, false);
  if (covered) {
    await tapChromeOrOverflow(s, actorId, Handles.spaceMembersButton);
    await people.expect.visible({ timeoutMs: MENU_WAIT_MS });
  }
  return seen;
}

/**
 * The space offers `handle` (Leave, End), in its top bar or in its menu,
 * where the ways out of a space sit apart from everyday controls.
 */
export async function offeredInSpaceMenu(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(handle).isVisible()) return true;
  const offered = await lookInSpaceMenu(s, actorId, (open) =>
    open.get(handle).isVisible()
  );
  return offered === true;
}

/**
 * The name the actor's open space goes by, which heads its menu (the top bar
 * says what the screen is), or `null` outside a space.
 */
export function spaceNameInMenu(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return lookInSpaceMenu(s, actorId, async (open) => {
    const name = open.get(Handles.spaceMenuName);
    return (await name.isVisible()) ? await name.text() : null;
  });
}
