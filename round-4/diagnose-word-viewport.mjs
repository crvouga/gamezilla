import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../../pkgs/ui-root-harness-ts/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({executablePath:'/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:6007/iframe.html?id=screens-games-word-tiles-board--enlarged-coordinates&viewMode=story&globals=theme:light');
 await page.waitForFunction(()=>document.querySelector('#storybook-root')?.getAttribute('data-story-status')==='error');
 const result=await page.evaluate(()=>{
  const board=document.querySelector('[data-component="WordTileBoard"]');const viewport=board.parentElement;
  const cell=document.activeElement;const overview=document.querySelector('[data-component="WordTileOverview"]');
  const rect=e=>e.getBoundingClientRect().toJSON();
  return {error:document.querySelector('#storybook-root').getAttribute('data-story-error'),cellId:cell.getAttribute('data-testid'),cell:rect(cell),board:rect(board),viewport:rect(viewport),overview:rect(overview),scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop,scrollWidth:viewport.scrollWidth,clientWidth:viewport.clientWidth};
 });
 writeFileSync(new URL('./interactions/word-viewport-diagnosis.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {await browser.close();}
