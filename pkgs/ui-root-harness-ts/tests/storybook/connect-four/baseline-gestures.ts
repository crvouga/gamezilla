// @io-wall-ok — hosted Chromium writes the measured board bounds and evidence.
import { writeFile } from 'node:fs/promises';
import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { openBoard } from './capture';


type Point = { x: number; y: number };
const board = (page: Page) => page.getByTestId('custom-game-board');
const column = (page: Page, n: number) =>
  page.getByTestId(`custom-game-board-column-${n}`);
async function center(page: Page, n: number) {
  const box = await column(page, n).boundingBox();
  if (!box) throw Error('Missing column');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function capture(page: Page, info: TestInfo, name: string) {
  const rack = board(page);
  await rack.screenshot({ path: info.outputPath(name + '.png') });
  await writeFile(
    info.outputPath(name + '-box.json'),
    JSON.stringify(await rack.boundingBox())
  );
}
async function input(page: Page, touch: boolean) {
  const cdp = await page.context().newCDPSession(page);
  function fingers(
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    points: Point[]
  ) {
    return cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, i) => ({ ...p, id: i + 1 })),
    });
  }
  return {
    async start(p: Point) {
      if (touch) await fingers('touchStart', [p]);
      else {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
      }
    },
    async move(p: Point) {
      if (touch) await fingers('touchMove', [p]);
      else await page.mouse.move(p.x, p.y, { steps: 5 });
    },
    async release() {
      if (touch) await fingers('touchEnd', []);
      else await page.mouse.up();
    },
    fingers,
  };
}

export function defineBaseline(width:number){
 test.describe('Round two baseline '+width,()=>{

  test('connect-four round two matched gesture capture',async({page},info)=>{
   const touch=width===390;
   await openBoard(page,'drop-a-disc',touch?'light':'dark','system');
   const driver=await input(page,touch);
   await driver.start(await center(page,2));
   await driver.move(await center(page,4));
   await capture(page,info,'aim');
   await driver.release();
   await capture(page,info,'placed');
   const point=await center(page,4);
   const side=(offset:number)=>({x:point.x+offset,y:point.y});
   if(touch){
    await driver.start(side(-25));
    await driver.fingers('touchStart',[side(-25),side(25)]);
    await driver.fingers('touchMove',[side(-50),side(50)]);
    await driver.fingers('touchEnd',[]);
   }else{
    await page.mouse.move(point.x,point.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0,-200);
    await page.keyboard.up('Control');
   }
   await capture(page,info,'inspect');
  });
 });
}
