# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--opening dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  38360 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/opening-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/opening-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 38360 pixels (ratio 0.04 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 38360 pixels (ratio 0.04 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Battleship" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e34]:
          - img "Red fleet" [ref=e35]
          - generic [ref=e36]: jordan_plays
        - generic [ref=e38]:
          - generic [ref=e40]:
            - radiogroup "Boards" [ref=e42]:
              - radio "Your fleet" [ref=e43] [cursor=pointer]:
                - generic [ref=e44]: Your fleet
              - radio "Targeting" [checked] [ref=e45] [cursor=pointer]:
                - generic [ref=e46]: Targeting
            - region "Targeting" [ref=e47]:
              - generic [ref=e48]:
                - group "Targeting" [ref=e49]:
                  - generic [ref=e51]: A
                  - generic [ref=e52]: B
                  - generic [ref=e53]: C
                  - generic [ref=e54]: D
                  - generic [ref=e55]: E
                  - generic [ref=e56]: F
                  - generic [ref=e57]: G
                  - generic [ref=e58]: H
                  - generic [ref=e59]: I
                  - generic [ref=e60]: J
                  - generic [ref=e61]: "1"
                  - button "Fire at A1" [ref=e62] [cursor=pointer]
                  - button "Fire at B1" [ref=e63] [cursor=pointer]
                  - button "Fire at C1" [ref=e64] [cursor=pointer]
                  - button "Fire at D1" [ref=e65] [cursor=pointer]
                  - button "Fire at E1" [ref=e66] [cursor=pointer]
                  - button "Fire at F1" [ref=e67] [cursor=pointer]
                  - button "Fire at G1" [ref=e68] [cursor=pointer]
                  - button "Fire at H1" [ref=e69] [cursor=pointer]
                  - button "Fire at I1" [ref=e70] [cursor=pointer]
                  - button "Fire at J1" [ref=e71] [cursor=pointer]
                  - generic [ref=e72]: "2"
                  - button "Fire at A2" [ref=e73] [cursor=pointer]
                  - button "Fire at B2" [ref=e74] [cursor=pointer]
                  - button "Fire at C2" [ref=e75] [cursor=pointer]
                  - button "Fire at D2" [ref=e76] [cursor=pointer]
                  - button "Fire at E2" [ref=e77] [cursor=pointer]
                  - button "Fire at F2" [ref=e78] [cursor=pointer]
                  - button "Fire at G2" [ref=e79] [cursor=pointer]
                  - button "Fire at H2" [ref=e80] [cursor=pointer]
                  - button "Fire at I2" [ref=e81] [cursor=pointer]
                  - button "Fire at J2" [ref=e82] [cursor=pointer]
                  - generic [ref=e83]: "3"
                  - button "Fire at A3" [ref=e84] [cursor=pointer]
                  - button "Fire at B3" [ref=e85] [cursor=pointer]
                  - button "Fire at C3" [ref=e86] [cursor=pointer]
                  - button "Fire at D3" [ref=e87] [cursor=pointer]
                  - button "Fire at E3" [ref=e88] [cursor=pointer]
                  - button "Fire at F3" [ref=e89] [cursor=pointer]
                  - button "Fire at G3" [ref=e90] [cursor=pointer]
                  - button "Fire at H3" [ref=e91] [cursor=pointer]
                  - button "Fire at I3" [ref=e92] [cursor=pointer]
                  - button "Fire at J3" [ref=e93] [cursor=pointer]
                  - generic [ref=e94]: "4"
                  - button "Fire at A4" [ref=e95] [cursor=pointer]
                  - button "Fire at B4" [ref=e96] [cursor=pointer]
                  - button "Fire at C4" [ref=e97] [cursor=pointer]
                  - button "Fire at D4" [ref=e98] [cursor=pointer]
                  - button "Fire at E4" [ref=e99] [cursor=pointer]
                  - button "Fire at F4" [ref=e100] [cursor=pointer]
                  - button "Fire at G4" [ref=e101] [cursor=pointer]
                  - button "Fire at H4" [ref=e102] [cursor=pointer]
                  - button "Fire at I4" [ref=e103] [cursor=pointer]
                  - button "Fire at J4" [ref=e104] [cursor=pointer]
                  - generic [ref=e105]: "5"
                  - button "Fire at A5" [ref=e106] [cursor=pointer]
                  - button "Fire at B5" [ref=e107] [cursor=pointer]
                  - button "Fire at C5" [ref=e108] [cursor=pointer]
                  - button "Fire at D5" [ref=e109] [cursor=pointer]
                  - button "Fire at E5" [ref=e110] [cursor=pointer]
                  - button "Fire at F5" [ref=e111] [cursor=pointer]
                  - button "Fire at G5" [ref=e112] [cursor=pointer]
                  - button "Fire at H5" [ref=e113] [cursor=pointer]
                  - button "Fire at I5" [ref=e114] [cursor=pointer]
                  - button "Fire at J5" [ref=e115] [cursor=pointer]
                  - generic [ref=e116]: "6"
                  - button "Fire at A6" [ref=e117] [cursor=pointer]
                  - button "Fire at B6" [ref=e118] [cursor=pointer]
                  - button "Fire at C6" [ref=e119] [cursor=pointer]
                  - button "Fire at D6" [ref=e120] [cursor=pointer]
                  - button "Fire at E6" [ref=e121] [cursor=pointer]
                  - button "Fire at F6" [ref=e122] [cursor=pointer]
                  - button "Fire at G6" [ref=e123] [cursor=pointer]
                  - button "Fire at H6" [ref=e124] [cursor=pointer]
                  - button "Fire at I6" [ref=e125] [cursor=pointer]
                  - button "Fire at J6" [ref=e126] [cursor=pointer]
                  - generic [ref=e127]: "7"
                  - button "Fire at A7" [ref=e128] [cursor=pointer]
                  - button "Fire at B7" [ref=e129] [cursor=pointer]
                  - button "Fire at C7" [ref=e130] [cursor=pointer]
                  - button "Fire at D7" [ref=e131] [cursor=pointer]
                  - button "Fire at E7" [ref=e132] [cursor=pointer]
                  - button "Fire at F7" [ref=e133] [cursor=pointer]
                  - button "Fire at G7" [ref=e134] [cursor=pointer]
                  - button "Fire at H7" [ref=e135] [cursor=pointer]
                  - button "Fire at I7" [ref=e136] [cursor=pointer]
                  - button "Fire at J7" [ref=e137] [cursor=pointer]
                  - generic [ref=e138]: "8"
                  - button "Fire at A8" [ref=e139] [cursor=pointer]
                  - button "Fire at B8" [ref=e140] [cursor=pointer]
                  - button "Fire at C8" [ref=e141] [cursor=pointer]
                  - button "Fire at D8" [ref=e142] [cursor=pointer]
                  - button "Fire at E8" [ref=e143] [cursor=pointer]
                  - button "Fire at F8" [ref=e144] [cursor=pointer]
                  - button "Fire at G8" [ref=e145] [cursor=pointer]
                  - button "Fire at H8" [ref=e146] [cursor=pointer]
                  - button "Fire at I8" [ref=e147] [cursor=pointer]
                  - button "Fire at J8" [ref=e148] [cursor=pointer]
                  - generic [ref=e149]: "9"
                  - button "Fire at A9" [ref=e150] [cursor=pointer]
                  - button "Fire at B9" [ref=e151] [cursor=pointer]
                  - button "Fire at C9" [ref=e152] [cursor=pointer]
                  - button "Fire at D9" [ref=e153] [cursor=pointer]
                  - button "Fire at E9" [ref=e154] [cursor=pointer]
                  - button "Fire at F9" [ref=e155] [cursor=pointer]
                  - button "Fire at G9" [ref=e156] [cursor=pointer]
                  - button "Fire at H9" [ref=e157] [cursor=pointer]
                  - button "Fire at I9" [ref=e158] [cursor=pointer]
                  - button "Fire at J9" [ref=e159] [cursor=pointer]
                  - generic [ref=e160]: "10"
                  - button "Fire at A10" [ref=e161] [cursor=pointer]
                  - button "Fire at B10" [ref=e162] [cursor=pointer]
                  - button "Fire at C10" [ref=e163] [cursor=pointer]
                  - button "Fire at D10" [ref=e164] [cursor=pointer]
                  - button "Fire at E10" [ref=e165] [cursor=pointer]
                  - button "Fire at F10" [ref=e166] [cursor=pointer]
                  - button "Fire at G10" [ref=e167] [cursor=pointer]
                  - button "Fire at H10" [ref=e168] [cursor=pointer]
                  - button "Fire at I10" [ref=e169] [cursor=pointer]
                  - button "Fire at J10" [ref=e170] [cursor=pointer]
                - button "Larger targets" [ref=e171] [cursor=pointer]:
                  - paragraph [ref=e174]: Larger targets
          - button "Choose a target" [disabled] [ref=e175]:
            - paragraph [ref=e178]: Choose a target
          - list "Key" [ref=e179]:
            - listitem [ref=e180]:
              - generic [ref=e181]:
                - generic: ■
              - text: Ship
            - listitem [ref=e182]:
              - generic [ref=e183]:
                - generic: ○
              - text: Miss
            - listitem [ref=e184]:
              - generic [ref=e185]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e186]:
              - generic [ref=e187]:
                - generic: ✖
              - text: Sunk
        - status [ref=e189]:
          - generic [ref=e190]:
            - generic [ref=e191]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: Your turn to fire.
        - generic [ref=e199]:
          - img "Blue fleet" [ref=e200]
          - generic [ref=e201]: avery
          - generic [ref=e202]: Your move
      - region "Game record" [ref=e205]:
        - generic [ref=e206]:
          - heading "Game record" [level=2] [ref=e208]
          - paragraph [ref=e209]: Your turn to fire.
        - generic [ref=e211]:
          - group "Game actions" [ref=e212]:
            - button "Resign game" [ref=e213] [cursor=pointer]:
              - paragraph [ref=e216]:
                - text: Resign
                - generic [ref=e217]: game
          - button "History and stats" [ref=e218] [cursor=pointer]:
            - paragraph [ref=e221]: History and stats
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
     |                                                 ^ Error: expect(locator).toHaveScreenshot(expected) failed
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```