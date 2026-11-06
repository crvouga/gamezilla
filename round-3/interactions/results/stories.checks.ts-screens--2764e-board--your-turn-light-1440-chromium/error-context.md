# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--your-turn light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  24523 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/your-turn-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/your-turn-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 24523 pixels (ratio 0.03 of all image pixels) are different.
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
  - 24523 pixels (ratio 0.03 of all image pixels) are different.

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
        - generic [ref=e33]:
          - generic [ref=e34]:
            - img "Red fleet" [ref=e35]
            - generic [ref=e36]: jordan_plays
          - generic [ref=e39]: Destroyer sunk
        - generic [ref=e41]:
          - generic [ref=e43]:
            - radiogroup "Boards" [ref=e45]:
              - radio "Your fleet" [ref=e46] [cursor=pointer]:
                - generic [ref=e47]: Your fleet
              - radio "Targeting" [checked] [ref=e48] [cursor=pointer]:
                - generic [ref=e49]: Targeting
            - region "Targeting" [ref=e50]:
              - generic [ref=e51]:
                - group "Targeting" [ref=e52]:
                  - generic [ref=e54]: A
                  - generic [ref=e55]: B
                  - generic [ref=e56]: C
                  - generic [ref=e57]: D
                  - generic [ref=e58]: E
                  - generic [ref=e59]: F
                  - generic [ref=e60]: G
                  - generic [ref=e61]: H
                  - generic [ref=e62]: I
                  - generic [ref=e63]: J
                  - generic [ref=e64]: "1"
                  - button "Fire at A1" [ref=e65] [cursor=pointer]
                  - button "Fire at B1" [ref=e66] [cursor=pointer]
                  - button "Fire at C1" [ref=e67] [cursor=pointer]
                  - button "Fire at D1" [ref=e68] [cursor=pointer]
                  - button "Fire at E1" [ref=e69] [cursor=pointer]
                  - button "Fire at F1" [ref=e70] [cursor=pointer]
                  - button "Fire at G1" [ref=e71] [cursor=pointer]
                  - button "Fire at H1" [ref=e72] [cursor=pointer]
                  - button "Fire at I1" [ref=e73] [cursor=pointer]
                  - button "Fire at J1" [ref=e74] [cursor=pointer]
                  - generic [ref=e75]: "2"
                  - button "Fire at A2" [ref=e76] [cursor=pointer]
                  - button "Fire at B2" [ref=e77] [cursor=pointer]
                  - button "Fire at C2" [ref=e78] [cursor=pointer]
                  - button "Fire at D2" [ref=e79] [cursor=pointer]
                  - button "Fire at E2" [ref=e80] [cursor=pointer]
                  - 'button "F2: hit" [disabled] [ref=e81]':
                    - generic: ✕
                  - 'button "G2: hit, latest shot" [disabled] [ref=e82]':
                    - generic: ✕
                  - button "Fire at H2" [ref=e83] [cursor=pointer]
                  - button "Fire at I2" [ref=e84] [cursor=pointer]
                  - button "Fire at J2" [ref=e85] [cursor=pointer]
                  - generic [ref=e86]: "3"
                  - button "Fire at A3" [ref=e87] [cursor=pointer]
                  - button "Fire at B3" [ref=e88] [cursor=pointer]
                  - button "Fire at C3" [ref=e89] [cursor=pointer]
                  - button "Fire at D3" [ref=e90] [cursor=pointer]
                  - button "Fire at E3" [ref=e91] [cursor=pointer]
                  - button "Fire at F3" [ref=e92] [cursor=pointer]
                  - button "Fire at G3" [ref=e93] [cursor=pointer]
                  - button "Fire at H3" [ref=e94] [cursor=pointer]
                  - button "Fire at I3" [ref=e95] [cursor=pointer]
                  - button "Fire at J3" [ref=e96] [cursor=pointer]
                  - generic [ref=e97]: "4"
                  - button "Fire at A4" [ref=e98] [cursor=pointer]
                  - button "Fire at B4" [ref=e99] [cursor=pointer]
                  - button "Fire at C4" [ref=e100] [cursor=pointer]
                  - button "Fire at D4" [ref=e101] [cursor=pointer]
                  - button "Fire at E4" [ref=e102] [cursor=pointer]
                  - button "Fire at F4" [ref=e103] [cursor=pointer]
                  - button "Fire at G4" [ref=e104] [cursor=pointer]
                  - button "Fire at H4" [ref=e105] [cursor=pointer]
                  - button "Fire at I4" [ref=e106] [cursor=pointer]
                  - button "Fire at J4" [ref=e107] [cursor=pointer]
                  - generic [ref=e108]: "5"
                  - button "Fire at A5" [ref=e109] [cursor=pointer]
                  - button "Fire at B5" [ref=e110] [cursor=pointer]
                  - button "Fire at C5" [ref=e111] [cursor=pointer]
                  - button "Fire at D5" [ref=e112] [cursor=pointer]
                  - button "Fire at E5" [ref=e113] [cursor=pointer]
                  - button "Fire at F5" [ref=e114] [cursor=pointer]
                  - button "Fire at G5" [ref=e115] [cursor=pointer]
                  - button "Fire at H5" [ref=e116] [cursor=pointer]
                  - button "Fire at I5" [ref=e117] [cursor=pointer]
                  - button "Fire at J5" [ref=e118] [cursor=pointer]
                  - generic [ref=e119]: "6"
                  - button "Fire at A6" [ref=e120] [cursor=pointer]
                  - button "Fire at B6" [ref=e121] [cursor=pointer]
                  - button "Fire at C6" [ref=e122] [cursor=pointer]
                  - button "Fire at D6" [ref=e123] [cursor=pointer]
                  - button "Fire at E6" [ref=e124] [cursor=pointer]
                  - button "Fire at F6" [ref=e125] [cursor=pointer]
                  - button "Fire at G6" [ref=e126] [cursor=pointer]
                  - button "Fire at H6" [ref=e127] [cursor=pointer]
                  - button "Fire at I6" [ref=e128] [cursor=pointer]
                  - button "Fire at J6" [ref=e129] [cursor=pointer]
                  - generic [ref=e130]: "7"
                  - button "Fire at A7" [ref=e131] [cursor=pointer]
                  - button "Fire at B7" [ref=e132] [cursor=pointer]
                  - button "Fire at C7" [ref=e133] [cursor=pointer]
                  - button "Fire at D7" [ref=e134] [cursor=pointer]
                  - button "Fire at E7" [ref=e135] [cursor=pointer]
                  - button "Fire at F7" [ref=e136] [cursor=pointer]
                  - button "Fire at G7" [ref=e137] [cursor=pointer]
                  - button "Fire at H7" [ref=e138] [cursor=pointer]
                  - button "Fire at I7" [ref=e139] [cursor=pointer]
                  - button "Fire at J7" [ref=e140] [cursor=pointer]
                  - generic [ref=e141]: "8"
                  - button "Fire at A8" [ref=e142] [cursor=pointer]
                  - button "Fire at B8" [ref=e143] [cursor=pointer]
                  - button "Fire at C8" [ref=e144] [cursor=pointer]
                  - button "Fire at D8" [ref=e145] [cursor=pointer]
                  - button "Fire at E8" [ref=e146] [cursor=pointer]
                  - button "Fire at F8" [ref=e147] [cursor=pointer]
                  - button "Fire at G8" [ref=e148] [cursor=pointer]
                  - button "Fire at H8" [ref=e149] [cursor=pointer]
                  - button "Fire at I8" [ref=e150] [cursor=pointer]
                  - button "Fire at J8" [ref=e151] [cursor=pointer]
                  - generic [ref=e152]: "9"
                  - button "Fire at A9" [ref=e153] [cursor=pointer]
                  - button "Fire at B9" [ref=e154] [cursor=pointer]
                  - button "Fire at C9" [ref=e155] [cursor=pointer]
                  - button "Fire at D9" [ref=e156] [cursor=pointer]
                  - button "Fire at E9" [ref=e157] [cursor=pointer]
                  - button "Fire at F9" [ref=e158] [cursor=pointer]
                  - button "Fire at G9" [ref=e159] [cursor=pointer]
                  - button "Fire at H9" [ref=e160] [cursor=pointer]
                  - button "Fire at I9" [ref=e161] [cursor=pointer]
                  - button "Fire at J9" [ref=e162] [cursor=pointer]
                  - generic [ref=e163]: "10"
                  - button "Fire at A10" [ref=e164] [cursor=pointer]
                  - button "Fire at B10" [ref=e165] [cursor=pointer]
                  - button "Fire at C10" [ref=e166] [cursor=pointer]
                  - button "Fire at D10" [ref=e167] [cursor=pointer]
                  - button "Fire at E10" [ref=e168] [cursor=pointer]
                  - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e169]':
                    - generic: ✖
                  - 'button "G10: hit, sunk Destroyer" [disabled] [ref=e170]':
                    - generic: ✖
                  - button "Fire at H10" [ref=e171] [cursor=pointer]
                  - button "Fire at I10" [ref=e172] [cursor=pointer]
                  - button "Fire at J10" [ref=e173] [cursor=pointer]
                - button "Larger targets" [ref=e174] [cursor=pointer]:
                  - paragraph [ref=e177]: Larger targets
          - button "Choose a target" [disabled] [ref=e178]:
            - paragraph [ref=e181]: Choose a target
          - list "Key" [ref=e182]:
            - listitem [ref=e183]:
              - generic [ref=e184]:
                - generic: ■
              - text: Ship
            - listitem [ref=e185]:
              - generic [ref=e186]:
                - generic: ○
              - text: Miss
            - listitem [ref=e187]:
              - generic [ref=e188]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e189]:
              - generic [ref=e190]:
                - generic: ✖
              - text: Sunk
        - status [ref=e192]:
          - generic [ref=e193]:
            - generic [ref=e194]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: Red fleet fired at C4 and missed. Your turn to fire.
        - generic [ref=e202]:
          - img "Blue fleet" [ref=e203]
          - generic [ref=e204]: avery
          - generic [ref=e205]: Your move
      - region "Game record" [ref=e207]:
        - generic [ref=e208]:
          - heading "Game record" [level=2] [ref=e210]
          - paragraph [ref=e211]: Red fleet fired at C4 and missed. Your turn to fire.
        - generic [ref=e212]:
          - list "Moves played" [ref=e214]:
            - listitem [ref=e215]:
              - generic [ref=e216]: "1"
              - 'button "Move 1, Blue fleet: F10 hit" [ref=e219] [cursor=pointer]': F10 hit
              - 'button "Move 2, Red fleet: A2 miss" [ref=e222] [cursor=pointer]': A2 miss
            - listitem [ref=e223]:
              - generic [ref=e224]: "2"
              - 'button "Move 3, Blue fleet: G10 sinks the destroyer" [ref=e227] [cursor=pointer]': G10 sinks the destroyer
              - 'button "Move 4, Red fleet: B9 hit" [ref=e230] [cursor=pointer]': B9 hit
            - listitem [ref=e231]:
              - generic [ref=e232]: "3"
              - 'button "Move 5, Blue fleet: F2 hit" [ref=e235] [cursor=pointer]': F2 hit
              - 'button "Move 6, Red fleet: A1 hit" [ref=e238] [cursor=pointer]': A1 hit
            - listitem [ref=e239]:
              - generic [ref=e240]: "4"
              - 'button "Move 7, Blue fleet: G2 hit" [ref=e243] [cursor=pointer]': G2 hit
              - 'button "Move 8, Red fleet: C4 miss" [ref=e246] [cursor=pointer]': C4 miss
          - generic [ref=e247]:
            - generic [ref=e248]:
              - button "Go to the start" [ref=e249] [cursor=pointer]:
                - img [ref=e252]
              - button "Previous move" [ref=e255] [cursor=pointer]:
                - img [ref=e258]
              - button "Next move" [disabled] [ref=e260]:
                - img [ref=e263]
              - button "Return to current position" [ref=e265] [cursor=pointer]:
                - img [ref=e268]
            - button "Go to move" [ref=e271] [cursor=pointer]:
              - generic [ref=e273]:
                - paragraph [ref=e274]: Go to move
                - img [ref=e277]
        - generic [ref=e280]:
          - group "Game actions" [ref=e281]:
            - button "Resign game" [ref=e282] [cursor=pointer]:
              - paragraph [ref=e285]:
                - text: Resign
                - generic [ref=e286]: game
          - button "History and stats" [ref=e287] [cursor=pointer]:
            - paragraph [ref=e290]: History and stats
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