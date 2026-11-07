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
try {
 const page=await browser.newPage({viewport:{width:1440,height:844}});
 await page.goto('http://127.0.0.1:'+server.address().port+'/iframe.html?id=screens-games-word-tiles-puzzle--enlarged-blank&viewMode=story&globals=theme:light');
 await page.waitForFunction(()=>document.querySelector('#storybook-root')?.getAttribute('data-story-status')==='error',null,{timeout:15000});
 const result=await page.evaluate(()=>({error:document.querySelector('#storybook-root').getAttribute('data-story-error'),elements:Array.from(document.querySelectorAll('[data-testid], [data-component="WordTileLetterChoices"], [role="region"]')).filter(e=>e.getAttribute('data-testid')?.match(/target|rack$|bonus|submit|blank-[AZ]$/)||e.getAttribute('data-component')==='WordTileLetterChoices'||e.getAttribute('role')==='region').map(e=>({id:e.getAttribute('data-testid')??e.getAttribute('data-component')??e.getAttribute('aria-label'),text:e.textContent,rect:e.getBoundingClientRect().toJSON()}))}));
 writeFileSync(new URL('./interactions/blank-context-diagnosis.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {await browser.close();await new Promise(done=>server.close(done));}
