import type { HarnessActor } from './harness';
import type { ProductUi } from './ports';

/** Native PNG frames enter the same Atlas report as their owning scenario steps. */
export async function captureActorScreenshots(
  actors: ReadonlyMap<string, Pick<HarnessActor, 'screenshot'>>,
  ui: ProductUi
): Promise<Record<string, Uint8Array> | null> {
  if (ui.kind !== 'bun-webview' || !ui.captureScreenshots) return null;
  const frames: Record<string, Uint8Array> = {};
  for (const [id, actor] of actors) {
    if (actor.screenshot === undefined) continue;
    const png = await actor.screenshot();
    if (png.byteLength === 0)
      throw new Error(`The browser returned an empty screenshot for ${id}`);
    frames[id] = png;
  }
  return Object.keys(frames).length > 0 ? frames : null;
}
