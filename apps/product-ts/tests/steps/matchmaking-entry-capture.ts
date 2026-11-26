// @io-wall-ok — temporary hosted diagnostic on the isolated, synthetic release journey.
import { join } from 'node:path';
import { EVIDENCE_DIR, type Device } from '@apps/product-ts/live-browser';
import { hostSpace, pickGameInSpace, endActiveSpace } from '@libs/runtime-harness-ts/journey-gestures';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';

const pause = (ms: number) => new Promise<void>((resolve) => wallTimers.setTimeout(resolve, ms));

// Executed in the page before the first tap. Keep only the route marks and
// counts, so the evidence contains no storage, identity or network payloads.
const observe = `(() => {
  const find = (id) => document.querySelector('[data-testid="'+id+'"]');
  const marks = [], denials = [];
  let frames = 0, raf;
  function sample() {
    const root = find('multiplayer-screen');
    const state = root?.getAttribute('data-stage') ?? (find('game-choice-multiplayer') ? 'menu' : 'between');
    if (marks.at(-1)?.state !== state) marks.push({state, ms:performance.now()});
    if (find('multiplayer-access-denial')) denials.push('multiplayer-access-denial');
  }
  function paint() { frames++; sample(); raf = requestAnimationFrame(paint); }
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.textContent?.includes('Not available')) denials.push('Not available');
    }
    sample();
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true});
  paint();
  window.finishMatchmakingCapture = () => {
    cancelAnimationFrame(raf); observer.disconnect(); sample();
    return {frames, marks, denials};
  };
})()`;

export async function captureMatchmakingEntry(device: Device) {
  const { driver: ui, view } = device;
  await view.cdp('Page.bringToFront', {});
  await hostSpace(ui);
  try {
    await pickGameInSpace(ui, 'connect-four');
    await ui.get(Handles.gameChoice('multiplayer')).expect.visible();
    const store = createNodeFsObjectStore({ rootDir: join(EVIDENCE_DIR, 'matchmaking-entry', 'steps'), fs: wallNodeFs(), layout: 'tree' });
    await view.evaluate(observe);
    const shots: number[] = [];
    const start = wallClock.now();
    let active = true;
    const record = async () => {
      while (active && shots.length < 240) {
        const time = wallClock.now() - start;
        const png = await view.screenshot({encoding:'buffer'});
        await store.put('frame-'+String(shots.length).padStart(4,'0')+'.png',png,'image/png');
        shots.push(time);
        await pause(24);
      }
    };
    const capture = record();
    try {
      for (let entry = 0; entry < 3; entry++) {
        await pause(450);
        await ui.get(Handles.gameChoice('multiplayer')).tap();
        await ui.get('multiplayer-find').expect.visible({timeoutMs:15000});
        await pause(600);
        if (entry < 2) {
          await ui.get(Handles.navBack).tap();
          await ui.get(Handles.gameChoice('multiplayer')).expect.visible();
        }
      }
    } finally {
      active = false;
      await capture;
      const result = await view.evaluate('window.finishMatchmakingCapture()') as {
        frames: number; marks: {state:string}[]; denials: string[]
      };
      await writeUtf8(store,'entry.json',JSON.stringify({ ...result,shots }));
      if (result.denials.length || result.marks.filter(m=>m.state==='idle').length !== 3)
        throw new Error('Unexpected matchmaking transition: '+JSON.stringify(result));
    }
  } finally {
    await endActiveSpace(ui);
  }
}
