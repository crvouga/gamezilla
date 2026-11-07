import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../../pkgs/ui-root-harness-ts/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:6007/iframe.html?id=screens-games-light-cycles-arena--quad-steering&viewMode=story&globals=theme:light');
 await page.waitForFunction(()=>document.querySelector('#storybook-root')?.getAttribute('data-story-status')==='error');
 const result=await page.evaluate(()=>Array.from(document.querySelectorAll('[data-component="GamePlayerChip"]')).map(card=>({card:card.getBoundingClientRect().toJSON(),html:card.outerHTML,texts:Array.from(card.querySelectorAll('span')).map(e=>{const range=document.createRange();range.selectNodeContents(e);return {text:e.textContent,box:e.getBoundingClientRect().toJSON(),range:Array.from(range.getClientRects()).map(r=>r.toJSON()),style:{display:getComputedStyle(e).display,whiteSpace:getComputedStyle(e).whiteSpace,overflowWrap:getComputedStyle(e).overflowWrap}}})})));
 writeFileSync(new URL('./interactions/quad-hit-diagnosis.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {await browser.close();}
