# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> games-battleship-placement-layout--enlarged dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/pkgs/ui-root-client-ts/src/battleship-placement-layout/baselines/chromium/games-battleship-placement-layout/enlarged-dark.png.
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - paragraph [ref=e8]: Ship
      - button "Ship" [ref=e9] [cursor=pointer]:
        - paragraph [ref=e10]: Carrier · 5
        - img [ref=e12]
    - button "Rotate down" [ref=e14] [cursor=pointer]:
      - paragraph [ref=e17]: Rotate down
    - generic [ref=e18]:
      - paragraph [ref=e19]: Region
      - button "Region" [ref=e20] [cursor=pointer]:
        - paragraph [ref=e21]: A–E / 1–5
        - img [ref=e23]
  - paragraph [ref=e26]: "Carrier: 5 cells across. Choose its first cell to place it."
  - group "Working region" [ref=e28]:
    - generic [ref=e30]: A
    - generic [ref=e31]: B
    - generic [ref=e32]: C
    - generic [ref=e33]: D
    - generic [ref=e34]: E
    - generic [ref=e35]: "1"
    - button "Water 1" [disabled] [ref=e36]:
      - generic: ■
    - button "Water 2" [disabled] [ref=e37]:
      - generic: ■
    - button "Water 3" [disabled] [ref=e38]:
      - generic: ■
    - button "Water 4" [disabled] [ref=e39]:
      - generic: ■
    - button "Water 5" [disabled] [ref=e40]:
      - generic: ■
    - generic [ref=e41]: "2"
    - button "Water 6" [disabled] [ref=e42]
    - button "Water 7" [disabled] [ref=e43]
    - button "Water 8" [disabled] [ref=e44]
    - button "Water 9" [disabled] [ref=e45]
    - button "Water 10" [disabled] [ref=e46]
    - generic [ref=e47]: "3"
    - button "Water 11" [disabled] [ref=e48]
    - button "Water 12" [disabled] [ref=e49]
    - button "Water 13" [disabled] [ref=e50]
    - button "Water 14" [disabled] [ref=e51]
    - button "Water 15" [disabled] [ref=e52]
    - generic [ref=e53]: "4"
    - button "Water 16" [disabled] [ref=e54]
    - button "Water 17" [disabled] [ref=e55]
    - button "Water 18" [disabled] [ref=e56]
    - button "Water 19" [disabled] [ref=e57]
    - button "Water 20" [disabled] [ref=e58]
    - generic [ref=e59]: "5"
    - button "Water 21" [disabled] [ref=e60]
    - button "Water 22" [disabled] [ref=e61]
    - button "Water 23" [disabled] [ref=e62]
    - button "Water 24" [disabled] [ref=e63]
    - button "Water 25" [disabled] [ref=e64]
  - generic [ref=e65]:
    - generic [ref=e66]: Fleet overview
    - group "Fleet" [ref=e68]:
      - generic [ref=e70]: A
      - generic [ref=e71]: B
      - generic [ref=e72]: C
      - generic [ref=e73]: D
      - generic [ref=e74]: E
      - generic [ref=e75]: F
      - generic [ref=e76]: G
      - generic [ref=e77]: H
      - generic [ref=e78]: I
      - generic [ref=e79]: J
      - generic [ref=e80]: "1"
      - button "Water 1" [disabled] [ref=e81]:
        - generic: ■
      - button "Water 2" [disabled] [ref=e82]:
        - generic: ■
      - button "Water 3" [disabled] [ref=e83]:
        - generic: ■
      - button "Water 4" [disabled] [ref=e84]:
        - generic: ■
      - button "Water 5" [disabled] [ref=e85]:
        - generic: ■
      - button "Water 6" [disabled] [ref=e86]
      - button "Water 7" [disabled] [ref=e87]
      - button "Water 8" [disabled] [ref=e88]
      - button "Water 9" [disabled] [ref=e89]
      - button "Water 10" [disabled] [ref=e90]
      - generic [ref=e91]: "2"
      - button "Water 11" [disabled] [ref=e92]
      - button "Water 12" [disabled] [ref=e93]
      - button "Water 13" [disabled] [ref=e94]
      - button "Water 14" [disabled] [ref=e95]
      - button "Water 15" [disabled] [ref=e96]
      - button "Water 16" [disabled] [ref=e97]
      - button "Water 17" [disabled] [ref=e98]
      - button "Water 18" [disabled] [ref=e99]
      - button "Water 19" [disabled] [ref=e100]
      - button "Water 20" [disabled] [ref=e101]
      - generic [ref=e102]: "3"
      - button "Water 21" [disabled] [ref=e103]
      - button "Water 22" [disabled] [ref=e104]
      - button "Water 23" [disabled] [ref=e105]
      - button "Water 24" [disabled] [ref=e106]
      - button "Water 25" [disabled] [ref=e107]
      - button "Water 26" [disabled] [ref=e108]
      - button "Water 27" [disabled] [ref=e109]
      - button "Water 28" [disabled] [ref=e110]
      - button "Water 29" [disabled] [ref=e111]
      - button "Water 30" [disabled] [ref=e112]
      - generic [ref=e113]: "4"
      - button "Water 31" [disabled] [ref=e114]
      - button "Water 32" [disabled] [ref=e115]
      - button "Water 33" [disabled] [ref=e116]
      - button "Water 34" [disabled] [ref=e117]
      - button "Water 35" [disabled] [ref=e118]
      - button "Water 36" [disabled] [ref=e119]
      - button "Water 37" [disabled] [ref=e120]
      - button "Water 38" [disabled] [ref=e121]
      - button "Water 39" [disabled] [ref=e122]
      - button "Water 40" [disabled] [ref=e123]
      - generic [ref=e124]: "5"
      - button "Water 41" [disabled] [ref=e125]
      - button "Water 42" [disabled] [ref=e126]
      - button "Water 43" [disabled] [ref=e127]
      - button "Water 44" [disabled] [ref=e128]
      - button "Water 45" [disabled] [ref=e129]
      - button "Water 46" [disabled] [ref=e130]
      - button "Water 47" [disabled] [ref=e131]
      - button "Water 48" [disabled] [ref=e132]
      - button "Water 49" [disabled] [ref=e133]
      - button "Water 50" [disabled] [ref=e134]
      - generic [ref=e135]: "6"
      - button "Water 51" [disabled] [ref=e136]
      - button "Water 52" [disabled] [ref=e137]
      - button "Water 53" [disabled] [ref=e138]
      - button "Water 54" [disabled] [ref=e139]
      - button "Water 55" [disabled] [ref=e140]
      - button "Water 56" [disabled] [ref=e141]
      - button "Water 57" [disabled] [ref=e142]
      - button "Water 58" [disabled] [ref=e143]
      - button "Water 59" [disabled] [ref=e144]
      - button "Water 60" [disabled] [ref=e145]
      - generic [ref=e146]: "7"
      - button "Water 61" [disabled] [ref=e147]
      - button "Water 62" [disabled] [ref=e148]
      - button "Water 63" [disabled] [ref=e149]
      - button "Water 64" [disabled] [ref=e150]
      - button "Water 65" [disabled] [ref=e151]
      - button "Water 66" [disabled] [ref=e152]
      - button "Water 67" [disabled] [ref=e153]
      - button "Water 68" [disabled] [ref=e154]
      - button "Water 69" [disabled] [ref=e155]
      - button "Water 70" [disabled] [ref=e156]
      - generic [ref=e157]: "8"
      - button "Water 71" [disabled] [ref=e158]
      - button "Water 72" [disabled] [ref=e159]
      - button "Water 73" [disabled] [ref=e160]
      - button "Water 74" [disabled] [ref=e161]
      - button "Water 75" [disabled] [ref=e162]
      - button "Water 76" [disabled] [ref=e163]
      - button "Water 77" [disabled] [ref=e164]
      - button "Water 78" [disabled] [ref=e165]
      - button "Water 79" [disabled] [ref=e166]
      - button "Water 80" [disabled] [ref=e167]
      - generic [ref=e168]: "9"
      - button "Water 81" [disabled] [ref=e169]
      - button "Water 82" [disabled] [ref=e170]
      - button "Water 83" [disabled] [ref=e171]
      - button "Water 84" [disabled] [ref=e172]
      - button "Water 85" [disabled] [ref=e173]
      - button "Water 86" [disabled] [ref=e174]
      - button "Water 87" [disabled] [ref=e175]
      - button "Water 88" [disabled] [ref=e176]
      - button "Water 89" [disabled] [ref=e177]
      - button "Water 90" [disabled] [ref=e178]
      - generic [ref=e179]: "10"
      - button "Water 91" [disabled] [ref=e180]
      - button "Water 92" [disabled] [ref=e181]
      - button "Water 93" [disabled] [ref=e182]
      - button "Water 94" [disabled] [ref=e183]
      - button "Water 95" [disabled] [ref=e184]
      - button "Water 96" [disabled] [ref=e185]
      - button "Water 97" [disabled] [ref=e186]
      - button "Water 98" [disabled] [ref=e187]
      - button "Water 99" [disabled] [ref=e188]
      - button "Water 100" [disabled] [ref=e189]
```

# Test source

```ts
  1  | // @io-wall-ok — browser verification adapter; all requests stay on the static server.
  2  | import { expect, type Page } from '@playwright/test';
  3  | import axe from 'axe-core';
  4  | import type { visualScenarios } from '../../storybook/scenarios';
  5  | 
  6  | /** The same readiness, accessibility and pixel contract for every canvas. */
  7  | export async function verifyStoryScenario(
  8  |   page: Page,
  9  |   storyId: string,
  10 |   scenario: ReturnType<typeof visualScenarios>[number]
  11 | ): Promise<void> {
  12 |   const { width, height, theme } = scenario;
  13 |   await page.setViewportSize({ width, height });
  14 |   const failures: string[] = [];
  15 |   page.on('pageerror', (error) => failures.push(error.message));
  16 |   await page.route('**/*', (route) =>
  17 |     new URL(route.request().url()).hostname === '127.0.0.1'
  18 |       ? route.continue()
  19 |       : route.abort()
  20 |   );
  21 |   await page.goto(
  22 |     `/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`
  23 |   );
  24 |   await expect
  25 |     .poll(async () =>
  26 |       page.locator('#storybook-root').evaluate((root) => {
  27 |         const status = root.getAttribute('data-story-status');
  28 |         if (status === 'error')
  29 |           return `error: ${root.getAttribute('data-story-error') ?? 'Storybook reported a failure'}`;
  30 |         return root.getAttribute('data-story-ready') === 'true'
  31 |           ? 'success'
  32 |           : 'pending';
  33 |       })
  34 |     )
  35 |     .toBe('success');
  36 |   await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  37 |   await page.evaluate(() => document.fonts.ready);
  38 |   await page.addScriptTag({ content: axe.source });
  39 |   const violations = await page.evaluate(async () => {
  40 |     const root = document.querySelector<HTMLElement>('#storybook-root');
  41 |     if (!root) throw new Error('Storybook canvas is missing');
  42 |     const result = await (window as unknown as { axe: typeof axe }).axe.run(
  43 |       root
  44 |     );
  45 |     return result.violations.filter(
  46 |       (v) => v.impact === 'serious' || v.impact === 'critical'
  47 |     );
  48 |   });
  49 |   expect(violations).toEqual([]);
  50 |   expect(failures).toEqual([]);
> 51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/pkgs/ui-root-client-ts/src/battleship-placement-layout/baselines/chromium/games-battleship-placement-layout/enlarged-dark.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```