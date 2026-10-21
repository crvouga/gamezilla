import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { check, JOURNEY_WAIT_MS } from './journey-gestures';

/** Keyboard activation avoids native pointer drift to a neighboring radio. */
export async function chooseMultiplayerTimeControl(
  ui: Driver,
  timeControl: string
): Promise<void> {
  const id = `multiplayer-time-control-${timeControl.replace('+', '-')}`;
  const option = ui.get(id);
  await option.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  await option.key('space');
  const html = await ui.snapshotHtml();
  const selected =
    html?.match(/<label\b[^>]*data-selected="true"[^>]*>[\s\S]*?<\/label>/g) ??
    [];
  check(
    selected.some((label) => label.includes(`data-testid="${id}"`)),
    `The requested multiplayer time control ${timeControl} was not selected`
  );
}
