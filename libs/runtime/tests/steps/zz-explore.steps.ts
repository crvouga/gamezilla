import { writeFileSync, appendFileSync } from 'node:fs';
import { spawnActor, actorUi } from '@libs/harness';
import { openTab } from '@libs/harness/system/shell-actions';
import { Handles } from '@libs/test-ids';
import { type Actor, Given, Then, When } from '@libs/harness/spec/define';

const log = (m: string) => appendFileSync('/tmp/a11y-explore/log.txt', m + '\n');
const desc = () => { const a = globalThis.document.activeElement as HTMLElement | null; return a ? `${a.tagName} tid=${a.getAttribute('data-testid')} label=${a.getAttribute('aria-label')} role=${a.getAttribute('role')} text=${(a.textContent??'').slice(0,40)}` : 'null'; };

Given('{actor} is listening to the app', async (w, actor: Actor) => {
  await w.s.apply(spawnActor, actor);
});
Given('{actor} is using the keyboard alone', async (w, actor: Actor) => {
  await w.s.apply(spawnActor, actor);
});
When('{actor} opens the Profile tab', async (w, actor: Actor) => {
  await w.s.apply(openTab, actor, Handles.tabProfile);
});
Then('{actor} hears the picture on their profile described as their avatar', async (w, actor: Actor) => {
  await w.s.read(async (s) => { writeFileSync('/tmp/a11y-explore/profile.html', globalThis.document.body.outerHTML); return null; });
});
When('{actor} moves the keyboard through the tabs', async (w, actor: Actor) => {
  await w.s.read(async (s) => {
    const ui = await actorUi(s, actor);
    log('start: ' + desc());
    for (let i = 0; i < 12; i++) { await ui.key('tab'); log('tab ' + i + ': ' + desc()); }
    // go to account menu
    for (let i = 0; i < 12; i++) { if (globalThis.document.activeElement?.getAttribute('data-testid') === 'status-current-user') break; await ui.key('tab'); }
    log('at: ' + desc());
    await ui.key('enter'); await s.session.waitForIdle();
    log('after enter: ' + desc());
    writeFileSync('/tmp/a11y-explore/menu.html', globalThis.document.body.outerHTML);
    for (let i = 0; i < 8; i++) { await ui.key('arrowDown'); await s.session.waitForIdle(); log('down ' + i + ': ' + desc()); }
    return null;
  });
});
Then("{actor}'s keyboard reaches every control on the tabs once, in the order they are shown", async () => {});
