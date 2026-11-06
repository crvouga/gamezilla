import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../../pkgs/ui-root-harness-ts/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({executablePath:'/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:6007/iframe.html?id=screens-games-quoridor-hill--precise-coordinates&viewMode=story&globals=theme:light');
 await page.waitForFunction(()=>document.querySelector('#storybook-root')?.getAttribute('data-story-status')==='error');
 const result=await page.evaluate(()=>{
  const rect=e=>e.getBoundingClientRect().toJSON();
  const selectors=['[data-testid="custom-game-board"]','[data-testid="custom-game-board-tools"]','[data-testid="custom-game-board-precise-target"]','[data-testid="custom-game-board-wall-commit"]'];
  return {error:document.querySelector('#storybook-root').getAttribute('data-story-error'),elements:selectors.map(selector=>{const e=document.querySelector(selector);return {selector,rect:e?rect(e):null,ancestors:[...function*(p){while(p){yield p;p=p.parentElement;}}(e?.parentElement)].map(p=>({component:p.dataset.component,rect:rect(p),overflow:getComputedStyle(p).overflow,scrollTop:p.scrollTop}))}})};

 });
 writeFileSync(new URL('./interactions/hill-confirmation-diagnosis.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {await browser.close();}
