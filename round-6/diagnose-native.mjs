import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../../pkgs/ui-root-harness-ts/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:6007/iframe.html?id=screens-games-word-tiles-board--enlarged-coordinates&viewMode=story&globals=theme:light');
 await page.waitForFunction(()=>document.querySelector('#storybook-root')?.getAttribute('data-story-status')==='error');
 const result=await page.evaluate(()=>{
 const selectors=['[aria-label="Board map: locate a square"]','[data-testid="custom-game-board-map"]','[data-testid="custom-game-board-cell-h8"]','[role="dialog"]'];
 return {error:document.querySelector('#storybook-root').getAttribute('data-story-error'),elements:selectors.map(selector=>{
 const e=document.querySelector(selector);if(!e)return {selector,missing:true};const r=e.getBoundingClientRect();
 return {selector,rect:r.toJSON(),radius:getComputedStyle(e).borderRadius,hits:[r.left+2,r.right-2].flatMap(x=>[r.top+2,r.bottom-2].map(y=>{const hit=document.elementFromPoint(x,y);return {x,y,contained:e.contains(hit),hit:hit?.outerHTML.slice(0,500)}}))};})};});
 writeFileSync(new URL('./interactions/word-hit-diagnosis.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {await browser.close();}
