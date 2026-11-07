import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../../pkgs/ui-root-harness-ts/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const results=[];
try {
 for(const id of ['screens-games-battleship-setup--empty','screens-games-battleship-board--your-turn','screens-games-word-tiles-board--enlarged-coordinates','screens-games-word-tiles-puzzle--enlarged-blank']) {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:6007/iframe.html?id='+id+'&viewMode=story&globals=theme:light');
 await page.waitForFunction(()=>['error','success'].includes(document.querySelector('#storybook-root')?.getAttribute('data-story-status'))||document.querySelector('#storybook-root')?.getAttribute('data-story-ready')==='true');
 const result=await page.evaluate(()=>({error:document.querySelector('#storybook-root').getAttribute('data-story-error'),elements:[...document.querySelectorAll('[data-testid], [data-component="BattleshipPlacementLayout"] p, [data-component="BattleshipPlacementLayout"] > div, [aria-label="Scrollable word board"], [aria-label="View a board region"], [aria-label="Board map: locate a square"]')].filter(e=>!e.hasAttribute('data-cell')&&!/-cell-|-rack-\d|-target-[a-j]\d|-aim-[a-j]\d/.test(e.getAttribute('data-testid')??'')).map(e=>({id:e.getAttribute('data-testid')??e.getAttribute('aria-label')??e.className,text:e.textContent.slice(0,100),rect:e.getBoundingClientRect().toJSON()}))}));
 results.push({id,...result});await page.screenshot({path:new URL('./interactions/initial-native/'+id+'.png',import.meta.url).pathname});await page.close();
 }
} finally {await browser.close();}
writeFileSync(new URL('./interactions/initial-native/geometry-diagnosis.json',import.meta.url),JSON.stringify(results,null,2));
console.log(results.map(x=>({id:x.id,error:x.error})));
