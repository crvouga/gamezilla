import { createRequire } from 'node:module';
import { readFileSync,writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve,extname } from 'node:path';
const require=createRequire(new URL('../../../pkgs/ui-root-harness-ts/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const root=resolve('pkgs/ui-root-harness-ts/.cache/storybook');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',types[extname(p)]??'application/octet-stream');res.end(readFileSync(p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try{
 const results=[];
 for(const [id,width] of [['four-players',390],['two-players',1440]]){
  const page=await browser.newPage({viewport:{width,height:844}});
  await page.goto(`http://127.0.0.1:${server.address().port}/iframe.html?id=screens-games-frame-geometry--${id}&globals=theme:light&viewMode=story`);
  await page.waitForFunction(()=>['error','success'].includes(document.querySelector('#storybook-root')?.getAttribute('data-story-status')));
  results.push(await page.evaluate(()=>{
   const props=e=>{const s=getComputedStyle(e);return {tag:e.tagName,classes:e.className,data:{...e.dataset},rect:e.getBoundingClientRect().toJSON(),maxWidth:s.maxWidth,padding:s.padding,grid:s.gridTemplateColumns,container:s.container,display:s.display,text:e.textContent.slice(0,120)}};
   const board=document.querySelector('[data-component="DiscDropBoard"]');let e=board;const parents=[];while(e&&parents.length<14){parents.push(props(e));e=e.parentElement;}
   return {error:document.querySelector('#storybook-root').dataset.storyError,parents,seats:[...document.querySelectorAll('[data-active]')].slice(0,8).map(e=>({self:props(e),children:[...e.children].map(c=>({self:props(c),children:[...c.children].map(props)}))}))};
  }));await page.close();
 }
 writeFileSync(new URL('./interactions/frame-diagnosis.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
