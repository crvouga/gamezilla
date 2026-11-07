import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
const root=resolve('pkgs/ui-root-harness-ts/.cache/storybook');
const server=createServer((req,res)=>{try{const f=resolve(root,'.'+new URL(req.url,'http://local').pathname);res.setHeader('content-type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');res.end(readFileSync(f));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));

const require = createRequire(new URL('../../../pkgs/ui-root-harness-ts/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const results=[];
try {
 for(const id of ['screens-games-word-tiles-board--your-turn','screens-games-word-tiles-board--enlarged-coordinates','screens-games-word-tiles-puzzle--enlarged-blank']) {
 const page=await browser.newPage({viewport:{width:1440,height:844}});
 await page.goto('http://127.0.0.1:'+server.address().port+'/iframe.html?id='+id+'&viewMode=story&globals=theme:light');
 await page.waitForFunction(()=>['error','success'].includes(document.querySelector('#storybook-root')?.getAttribute('data-story-status'))||document.querySelector('#storybook-root')?.getAttribute('data-story-ready')==='true');
 const result=await page.evaluate(()=>({error:document.querySelector('#storybook-root').getAttribute('data-story-error'),elements:[...document.querySelectorAll('[data-testid], [data-component="BattleshipPlacementLayout"] p, [data-component="BattleshipPlacementLayout"] > div, [aria-label="Scrollable word board"], [aria-label="View a board region"], [aria-label="Board map: locate a square"]')].filter(e=>!e.hasAttribute('data-cell')&&!/-cell-|-rack-\d|-target-[a-j]\d|-aim-[a-j]\d/.test(e.getAttribute('data-testid')??'')).map(e=>({id:e.getAttribute('data-testid')??e.getAttribute('aria-label')??e.className,text:e.textContent.slice(0,100),rect:e.getBoundingClientRect().toJSON(),ancestors:[e.parentElement,e.parentElement?.parentElement,e.parentElement?.parentElement?.parentElement].filter(Boolean).map(p=>({class:p.className,component:p.getAttribute('data-component'),gap:getComputedStyle(p).gap,rect:p.getBoundingClientRect().toJSON()})),hits:[e.getBoundingClientRect().left+2,e.getBoundingClientRect().right-2].flatMap(x=>[e.getBoundingClientRect().top+2,e.getBoundingClientRect().bottom-2].map(y=>{const hit=document.elementFromPoint(x,y);return {x,y,contained:e.contains(hit),hit:hit?.outerHTML.slice(0,200)}}))}))}));
 results.push({id,...result});await page.screenshot({path:new URL('./interactions/repair-2-native/'+id+'-desktop.png',import.meta.url).pathname});await page.close();
 }
} finally {await browser.close();await new Promise(done=>server.close(done));}
writeFileSync(new URL('./interactions/repair-2-native/desktop-diagnosis.json',import.meta.url),JSON.stringify(results,null,2));
console.log(results.map(x=>({id:x.id,error:x.error})));
