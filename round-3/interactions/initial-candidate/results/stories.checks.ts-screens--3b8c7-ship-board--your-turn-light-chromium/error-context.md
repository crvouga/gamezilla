# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--your-turn light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  48308 pixels (ratio 0.15 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/your-turn-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/your-turn-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 48308 pixels (ratio 0.15 of all image pixels) are different.
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
  - 48308 pixels (ratio 0.15 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Battleship" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Red fleet fired at C4 and missed. Your turn to fire.
        - generic [ref=e25]:
          - list "Moves played" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e32]: Move 4
              - 'button "Move 7, Blue fleet: G2 hit" [ref=e35] [cursor=pointer]': G2 hit
              - 'button "Move 8, Red fleet: C4 miss" [ref=e38] [cursor=pointer]': C4 miss
          - button "All moves" [ref=e39] [cursor=pointer]:
            - img [ref=e43]
      - generic [ref=e45]:
        - generic [ref=e47]:
          - generic [ref=e53]:
            - generic [ref=e54]:
              - img "Red fleet" [ref=e55]
              - generic [ref=e56]: jordan_plays
            - generic [ref=e59]: Destroyer sunk
          - generic [ref=e61]:
            - generic [ref=e63]:
              - radiogroup "Boards" [ref=e65]:
                - radio "Your fleet" [ref=e66] [cursor=pointer]:
                  - generic [ref=e67]: Your fleet
                - radio "Targeting" [checked] [ref=e68] [cursor=pointer]:
                  - generic [ref=e69]: Targeting
              - region "Targeting" [ref=e70]:
                - generic [ref=e71]:
                  - group "Targeting" [ref=e72]:
                    - generic [ref=e74]: A
                    - generic [ref=e75]: B
                    - generic [ref=e76]: C
                    - generic [ref=e77]: D
                    - generic [ref=e78]: E
                    - generic [ref=e79]: F
                    - generic [ref=e80]: G
                    - generic [ref=e81]: H
                    - generic [ref=e82]: I
                    - generic [ref=e83]: J
                    - generic [ref=e84]: "1"
                    - button "Fire at A1" [ref=e85] [cursor=pointer]
                    - button "Fire at B1" [ref=e86] [cursor=pointer]
                    - button "Fire at C1" [ref=e87] [cursor=pointer]
                    - button "Fire at D1" [ref=e88] [cursor=pointer]
                    - button "Fire at E1" [ref=e89] [cursor=pointer]
                    - button "Fire at F1" [ref=e90] [cursor=pointer]
                    - button "Fire at G1" [ref=e91] [cursor=pointer]
                    - button "Fire at H1" [ref=e92] [cursor=pointer]
                    - button "Fire at I1" [ref=e93] [cursor=pointer]
                    - button "Fire at J1" [ref=e94] [cursor=pointer]
                    - generic [ref=e95]: "2"
                    - button "Fire at A2" [ref=e96] [cursor=pointer]
                    - button "Fire at B2" [ref=e97] [cursor=pointer]
                    - button "Fire at C2" [ref=e98] [cursor=pointer]
                    - button "Fire at D2" [ref=e99] [cursor=pointer]
                    - button "Fire at E2" [ref=e100] [cursor=pointer]
                    - 'button "F2: hit" [disabled] [ref=e101]':
                      - generic: ✕
                    - 'button "G2: hit, latest shot" [disabled] [ref=e102]':
                      - generic: ✕
                    - button "Fire at H2" [ref=e103] [cursor=pointer]
                    - button "Fire at I2" [ref=e104] [cursor=pointer]
                    - button "Fire at J2" [ref=e105] [cursor=pointer]
                    - generic [ref=e106]: "3"
                    - button "Fire at A3" [ref=e107] [cursor=pointer]
                    - button "Fire at B3" [ref=e108] [cursor=pointer]
                    - button "Fire at C3" [ref=e109] [cursor=pointer]
                    - button "Fire at D3" [ref=e110] [cursor=pointer]
                    - button "Fire at E3" [ref=e111] [cursor=pointer]
                    - button "Fire at F3" [ref=e112] [cursor=pointer]
                    - button "Fire at G3" [ref=e113] [cursor=pointer]
                    - button "Fire at H3" [ref=e114] [cursor=pointer]
                    - button "Fire at I3" [ref=e115] [cursor=pointer]
                    - button "Fire at J3" [ref=e116] [cursor=pointer]
                    - generic [ref=e117]: "4"
                    - button "Fire at A4" [ref=e118] [cursor=pointer]
                    - button "Fire at B4" [ref=e119] [cursor=pointer]
                    - button "Fire at C4" [ref=e120] [cursor=pointer]
                    - button "Fire at D4" [ref=e121] [cursor=pointer]
                    - button "Fire at E4" [ref=e122] [cursor=pointer]
                    - button "Fire at F4" [ref=e123] [cursor=pointer]
                    - button "Fire at G4" [ref=e124] [cursor=pointer]
                    - button "Fire at H4" [ref=e125] [cursor=pointer]
                    - button "Fire at I4" [ref=e126] [cursor=pointer]
                    - button "Fire at J4" [ref=e127] [cursor=pointer]
                    - generic [ref=e128]: "5"
                    - button "Fire at A5" [ref=e129] [cursor=pointer]
                    - button "Fire at B5" [ref=e130] [cursor=pointer]
                    - button "Fire at C5" [ref=e131] [cursor=pointer]
                    - button "Fire at D5" [ref=e132] [cursor=pointer]
                    - button "Fire at E5" [ref=e133] [cursor=pointer]
                    - button "Fire at F5" [ref=e134] [cursor=pointer]
                    - button "Fire at G5" [ref=e135] [cursor=pointer]
                    - button "Fire at H5" [ref=e136] [cursor=pointer]
                    - button "Fire at I5" [ref=e137] [cursor=pointer]
                    - button "Fire at J5" [ref=e138] [cursor=pointer]
                    - generic [ref=e139]: "6"
                    - button "Fire at A6" [ref=e140] [cursor=pointer]
                    - button "Fire at B6" [ref=e141] [cursor=pointer]
                    - button "Fire at C6" [ref=e142] [cursor=pointer]
                    - button "Fire at D6" [ref=e143] [cursor=pointer]
                    - button "Fire at E6" [ref=e144] [cursor=pointer]
                    - button "Fire at F6" [ref=e145] [cursor=pointer]
                    - button "Fire at G6" [ref=e146] [cursor=pointer]
                    - button "Fire at H6" [ref=e147] [cursor=pointer]
                    - button "Fire at I6" [ref=e148] [cursor=pointer]
                    - button "Fire at J6" [ref=e149] [cursor=pointer]
                    - generic [ref=e150]: "7"
                    - button "Fire at A7" [ref=e151] [cursor=pointer]
                    - button "Fire at B7" [ref=e152] [cursor=pointer]
                    - button "Fire at C7" [ref=e153] [cursor=pointer]
                    - button "Fire at D7" [ref=e154] [cursor=pointer]
                    - button "Fire at E7" [ref=e155] [cursor=pointer]
                    - button "Fire at F7" [ref=e156] [cursor=pointer]
                    - button "Fire at G7" [ref=e157] [cursor=pointer]
                    - button "Fire at H7" [ref=e158] [cursor=pointer]
                    - button "Fire at I7" [ref=e159] [cursor=pointer]
                    - button "Fire at J7" [ref=e160] [cursor=pointer]
                    - generic [ref=e161]: "8"
                    - button "Fire at A8" [ref=e162] [cursor=pointer]
                    - button "Fire at B8" [ref=e163] [cursor=pointer]
                    - button "Fire at C8" [ref=e164] [cursor=pointer]
                    - button "Fire at D8" [ref=e165] [cursor=pointer]
                    - button "Fire at E8" [ref=e166] [cursor=pointer]
                    - button "Fire at F8" [ref=e167] [cursor=pointer]
                    - button "Fire at G8" [ref=e168] [cursor=pointer]
                    - button "Fire at H8" [ref=e169] [cursor=pointer]
                    - button "Fire at I8" [ref=e170] [cursor=pointer]
                    - button "Fire at J8" [ref=e171] [cursor=pointer]
                    - generic [ref=e172]: "9"
                    - button "Fire at A9" [ref=e173] [cursor=pointer]
                    - button "Fire at B9" [ref=e174] [cursor=pointer]
                    - button "Fire at C9" [ref=e175] [cursor=pointer]
                    - button "Fire at D9" [ref=e176] [cursor=pointer]
                    - button "Fire at E9" [ref=e177] [cursor=pointer]
                    - button "Fire at F9" [ref=e178] [cursor=pointer]
                    - button "Fire at G9" [ref=e179] [cursor=pointer]
                    - button "Fire at H9" [ref=e180] [cursor=pointer]
                    - button "Fire at I9" [ref=e181] [cursor=pointer]
                    - button "Fire at J9" [ref=e182] [cursor=pointer]
                    - generic [ref=e183]: "10"
                    - button "Fire at A10" [ref=e184] [cursor=pointer]
                    - button "Fire at B10" [ref=e185] [cursor=pointer]
                    - button "Fire at C10" [ref=e186] [cursor=pointer]
                    - button "Fire at D10" [ref=e187] [cursor=pointer]
                    - button "Fire at E10" [ref=e188] [cursor=pointer]
                    - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e189]':
                      - generic: ✖
                    - 'button "G10: hit, sunk Destroyer" [disabled] [ref=e190]':
                      - generic: ✖
                    - button "Fire at H10" [ref=e191] [cursor=pointer]
                    - button "Fire at I10" [ref=e192] [cursor=pointer]
                    - button "Fire at J10" [ref=e193] [cursor=pointer]
                  - button "Larger targets" [ref=e194] [cursor=pointer]:
                    - paragraph [ref=e197]: Larger targets
            - button "Choose a target" [disabled] [ref=e198]:
              - paragraph [ref=e201]: Choose a target
            - list "Key" [ref=e202]:
              - listitem [ref=e203]:
                - generic [ref=e204]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e205]:
                - generic [ref=e206]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e207]:
                - generic [ref=e208]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e209]:
                - generic [ref=e210]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e212]:
            - generic [ref=e213]:
              - generic [ref=e214]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Red fleet fired at C4 and missed. Your turn to fire.
          - generic [ref=e222]:
            - img "Blue fleet" [ref=e223]
            - generic [ref=e224]: avery
            - generic [ref=e225]: Your move
        - generic [ref=e228]:
          - group "Game actions" [ref=e229]:
            - button "Resign game" [ref=e230] [cursor=pointer]:
              - paragraph [ref=e233]:
                - text: Resign
                - generic [ref=e234]: game
          - button "History and stats" [ref=e235] [cursor=pointer]:
            - generic [ref=e237]:
              - paragraph [ref=e238]: History and stats
              - img [ref=e241]
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