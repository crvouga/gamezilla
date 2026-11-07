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
  97823 pixels (ratio 0.09 of all image pixels) are different.

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
  - 97823 pixels (ratio 0.09 of all image pixels) are different.
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
  - 97823 pixels (ratio 0.09 of all image pixels) are different.

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
            - generic "jordan_plays" [ref=e38]
          - generic [ref=e41]: Destroyer sunk
        - generic [ref=e43]:
          - generic [ref=e45]:
            - radiogroup "Boards" [ref=e47]:
              - radio "Your fleet" [ref=e48] [cursor=pointer]:
                - generic [ref=e49]: Your fleet
              - radio "Targeting" [checked] [ref=e50] [cursor=pointer]:
                - generic [ref=e51]: Targeting
            - region "Targeting" [ref=e52]:
              - generic [ref=e53]:
                - generic [ref=e54]:
                  - generic [ref=e55]:
                    - group "Targeting" [ref=e57]:
                      - generic [ref=e59]: A
                      - generic [ref=e60]: B
                      - generic [ref=e61]: C
                      - generic [ref=e62]: D
                      - generic [ref=e63]: E
                      - generic [ref=e64]: F
                      - generic [ref=e65]: G
                      - generic [ref=e66]: H
                      - generic [ref=e67]: I
                      - generic [ref=e68]: J
                      - generic [ref=e69]: "1"
                      - button "Fire at A1" [ref=e70] [cursor=pointer]
                      - button "Fire at B1" [ref=e71] [cursor=pointer]
                      - button "Fire at C1" [ref=e72] [cursor=pointer]
                      - button "Fire at D1" [ref=e73] [cursor=pointer]
                      - button "Fire at E1" [ref=e74] [cursor=pointer]
                      - button "Fire at F1" [ref=e75] [cursor=pointer]
                      - button "Fire at G1" [ref=e76] [cursor=pointer]
                      - button "Fire at H1" [ref=e77] [cursor=pointer]
                      - button "Fire at I1" [ref=e78] [cursor=pointer]
                      - button "Fire at J1" [ref=e79] [cursor=pointer]
                      - generic [ref=e80]: "2"
                      - button "Fire at A2" [ref=e81] [cursor=pointer]
                      - button "Fire at B2" [ref=e82] [cursor=pointer]
                      - button "Fire at C2" [ref=e83] [cursor=pointer]
                      - button "Fire at D2" [ref=e84] [cursor=pointer]
                      - button "Fire at E2" [ref=e85] [cursor=pointer]
                      - 'button "F2: hit" [disabled] [ref=e86]':
                        - generic: ✕
                      - 'button "G2: hit, latest shot" [disabled] [ref=e87]':
                        - generic: ✕
                      - button "Fire at H2" [ref=e88] [cursor=pointer]
                      - button "Fire at I2" [ref=e89] [cursor=pointer]
                      - button "Fire at J2" [ref=e90] [cursor=pointer]
                      - generic [ref=e91]: "3"
                      - button "Fire at A3" [ref=e92] [cursor=pointer]
                      - button "Fire at B3" [ref=e93] [cursor=pointer]
                      - button "Fire at C3" [ref=e94] [cursor=pointer]
                      - button "Fire at D3" [ref=e95] [cursor=pointer]
                      - button "Fire at E3" [ref=e96] [cursor=pointer]
                      - button "Fire at F3" [ref=e97] [cursor=pointer]
                      - button "Fire at G3" [ref=e98] [cursor=pointer]
                      - button "Fire at H3" [ref=e99] [cursor=pointer]
                      - button "Fire at I3" [ref=e100] [cursor=pointer]
                      - button "Fire at J3" [ref=e101] [cursor=pointer]
                      - generic [ref=e102]: "4"
                      - button "Fire at A4" [ref=e103] [cursor=pointer]
                      - button "Fire at B4" [ref=e104] [cursor=pointer]
                      - button "Fire at C4" [ref=e105] [cursor=pointer]
                      - button "Fire at D4" [ref=e106] [cursor=pointer]
                      - button "Fire at E4" [ref=e107] [cursor=pointer]
                      - button "Fire at F4" [ref=e108] [cursor=pointer]
                      - button "Fire at G4" [ref=e109] [cursor=pointer]
                      - button "Fire at H4" [ref=e110] [cursor=pointer]
                      - button "Fire at I4" [ref=e111] [cursor=pointer]
                      - button "Fire at J4" [ref=e112] [cursor=pointer]
                      - generic [ref=e113]: "5"
                      - button "Fire at A5" [ref=e114] [cursor=pointer]
                      - button "Fire at B5" [ref=e115] [cursor=pointer]
                      - button "Fire at C5" [ref=e116] [cursor=pointer]
                      - button "Fire at D5" [ref=e117] [cursor=pointer]
                      - button "Fire at E5" [ref=e118] [cursor=pointer]
                      - button "Fire at F5" [ref=e119] [cursor=pointer]
                      - button "Fire at G5" [ref=e120] [cursor=pointer]
                      - button "Fire at H5" [ref=e121] [cursor=pointer]
                      - button "Fire at I5" [ref=e122] [cursor=pointer]
                      - button "Fire at J5" [ref=e123] [cursor=pointer]
                      - generic [ref=e124]: "6"
                      - button "Fire at A6" [ref=e125] [cursor=pointer]
                      - button "Fire at B6" [ref=e126] [cursor=pointer]
                      - button "Fire at C6" [ref=e127] [cursor=pointer]
                      - button "Fire at D6" [ref=e128] [cursor=pointer]
                      - button "Fire at E6" [ref=e129] [cursor=pointer]
                      - button "Fire at F6" [ref=e130] [cursor=pointer]
                      - button "Fire at G6" [ref=e131] [cursor=pointer]
                      - button "Fire at H6" [ref=e132] [cursor=pointer]
                      - button "Fire at I6" [ref=e133] [cursor=pointer]
                      - button "Fire at J6" [ref=e134] [cursor=pointer]
                      - generic [ref=e135]: "7"
                      - button "Fire at A7" [ref=e136] [cursor=pointer]
                      - button "Fire at B7" [ref=e137] [cursor=pointer]
                      - button "Fire at C7" [ref=e138] [cursor=pointer]
                      - button "Fire at D7" [ref=e139] [cursor=pointer]
                      - button "Fire at E7" [ref=e140] [cursor=pointer]
                      - button "Fire at F7" [ref=e141] [cursor=pointer]
                      - button "Fire at G7" [ref=e142] [cursor=pointer]
                      - button "Fire at H7" [ref=e143] [cursor=pointer]
                      - button "Fire at I7" [ref=e144] [cursor=pointer]
                      - button "Fire at J7" [ref=e145] [cursor=pointer]
                      - generic [ref=e146]: "8"
                      - button "Fire at A8" [ref=e147] [cursor=pointer]
                      - button "Fire at B8" [ref=e148] [cursor=pointer]
                      - button "Fire at C8" [ref=e149] [cursor=pointer]
                      - button "Fire at D8" [ref=e150] [cursor=pointer]
                      - button "Fire at E8" [ref=e151] [cursor=pointer]
                      - button "Fire at F8" [ref=e152] [cursor=pointer]
                      - button "Fire at G8" [ref=e153] [cursor=pointer]
                      - button "Fire at H8" [ref=e154] [cursor=pointer]
                      - button "Fire at I8" [ref=e155] [cursor=pointer]
                      - button "Fire at J8" [ref=e156] [cursor=pointer]
                      - generic [ref=e157]: "9"
                      - button "Fire at A9" [ref=e158] [cursor=pointer]
                      - button "Fire at B9" [ref=e159] [cursor=pointer]
                      - button "Fire at C9" [ref=e160] [cursor=pointer]
                      - button "Fire at D9" [ref=e161] [cursor=pointer]
                      - button "Fire at E9" [ref=e162] [cursor=pointer]
                      - button "Fire at F9" [ref=e163] [cursor=pointer]
                      - button "Fire at G9" [ref=e164] [cursor=pointer]
                      - button "Fire at H9" [ref=e165] [cursor=pointer]
                      - button "Fire at I9" [ref=e166] [cursor=pointer]
                      - button "Fire at J9" [ref=e167] [cursor=pointer]
                      - generic [ref=e168]: "10"
                      - button "Fire at A10" [ref=e169] [cursor=pointer]
                      - button "Fire at B10" [ref=e170] [cursor=pointer]
                      - button "Fire at C10" [ref=e171] [cursor=pointer]
                      - button "Fire at D10" [ref=e172] [cursor=pointer]
                      - button "Fire at E10" [ref=e173] [cursor=pointer]
                      - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e174]':
                        - generic: ✖
                      - 'button "G10: hit, sunk Destroyer" [disabled] [ref=e175]':
                        - generic: ✖
                      - button "Fire at H10" [ref=e176] [cursor=pointer]
                      - button "Fire at I10" [ref=e177] [cursor=pointer]
                      - button "Fire at J10" [ref=e178] [cursor=pointer]
                    - generic [ref=e179]:
                      - button "A1–E2" [pressed] [ref=e180] [cursor=pointer]:
                        - generic [ref=e181]: A1
                        - generic [ref=e182]: E2
                      - button "F1–J2" [ref=e183] [cursor=pointer]:
                        - generic [ref=e184]: F1
                        - generic [ref=e185]: J2
                      - button "A3–E4" [ref=e186] [cursor=pointer]:
                        - generic [ref=e187]: A3
                        - generic [ref=e188]: E4
                      - button "F3–J4" [ref=e189] [cursor=pointer]:
                        - generic [ref=e190]: F3
                        - generic [ref=e191]: J4
                      - button "A5–E6" [ref=e192] [cursor=pointer]:
                        - generic [ref=e193]: A5
                        - generic [ref=e194]: E6
                      - button "F5–J6" [ref=e195] [cursor=pointer]:
                        - generic [ref=e196]: F5
                        - generic [ref=e197]: J6
                      - button "A7–E8" [ref=e198] [cursor=pointer]:
                        - generic [ref=e199]: A7
                        - generic [ref=e200]: E8
                      - button "F7–J8" [ref=e201] [cursor=pointer]:
                        - generic [ref=e202]: F7
                        - generic [ref=e203]: J8
                      - button "A9–E10" [ref=e204] [cursor=pointer]:
                        - generic [ref=e205]: A9
                        - generic [ref=e206]: E10
                      - button "F9–J10" [ref=e207] [cursor=pointer]:
                        - generic [ref=e208]: F9
                        - generic [ref=e209]: J10
                  - generic [ref=e211]:
                    - paragraph [ref=e212]: "Aim: A1–E2"
                    - button "Map" [ref=e213] [cursor=pointer]:
                      - paragraph [ref=e216]: Map
                  - group "Precise aim" [ref=e219]:
                    - generic [ref=e221]: A
                    - generic [ref=e222]: B
                    - generic [ref=e223]: C
                    - generic [ref=e224]: D
                    - generic [ref=e225]: E
                    - generic [ref=e226]: "1"
                    - button "Fire at A1" [ref=e227] [cursor=pointer]
                    - button "Fire at B1" [ref=e228] [cursor=pointer]
                    - button "Fire at C1" [ref=e229] [cursor=pointer]
                    - button "Fire at D1" [ref=e230] [cursor=pointer]
                    - button "Fire at E1" [ref=e231] [cursor=pointer]
                    - generic [ref=e232]: "2"
                    - button "Fire at A2" [ref=e233] [cursor=pointer]
                    - button "Fire at B2" [ref=e234] [cursor=pointer]
                    - button "Fire at C2" [ref=e235] [cursor=pointer]
                    - button "Fire at D2" [ref=e236] [cursor=pointer]
                    - button "Fire at E2" [ref=e237] [cursor=pointer]
                - button "Choose a target" [disabled] [ref=e239]:
                  - paragraph [ref=e242]: Choose a target
          - list "Key" [ref=e243]:
            - listitem [ref=e244]:
              - generic [ref=e245]:
                - generic: ■
              - text: Ship
            - listitem [ref=e246]:
              - generic [ref=e247]:
                - generic: ○
              - text: Miss
            - listitem [ref=e248]:
              - generic [ref=e249]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e250]:
              - generic [ref=e251]:
                - generic: ✖
              - text: Sunk
        - status [ref=e253]:
          - generic [ref=e254]:
            - generic [ref=e255]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: Red fleet fired at C4 and missed. Your turn to fire.
        - generic [ref=e263]:
          - img "Blue fleet" [ref=e264]
          - generic "avery" [ref=e267]
          - generic [ref=e268]: Your move
      - region "Game record" [ref=e270]:
        - generic [ref=e271]:
          - heading "Game record" [level=2] [ref=e273]
          - paragraph [ref=e274]: Red fleet fired at C4 and missed. Your turn to fire.
        - generic [ref=e275]:
          - list "Moves played" [ref=e277]:
            - listitem [ref=e278]:
              - generic [ref=e279]: "1"
              - 'button "Move 1, Blue fleet: F10 hit" [ref=e282] [cursor=pointer]': F10 hit
              - 'button "Move 2, Red fleet: A2 miss" [ref=e285] [cursor=pointer]': A2 miss
            - listitem [ref=e286]:
              - generic [ref=e287]: "2"
              - 'button "Move 3, Blue fleet: G10 sinks the destroyer" [ref=e290] [cursor=pointer]': G10 sinks the destroyer
              - 'button "Move 4, Red fleet: B9 hit" [ref=e293] [cursor=pointer]': B9 hit
            - listitem [ref=e294]:
              - generic [ref=e295]: "3"
              - 'button "Move 5, Blue fleet: F2 hit" [ref=e298] [cursor=pointer]': F2 hit
              - 'button "Move 6, Red fleet: A1 hit" [ref=e301] [cursor=pointer]': A1 hit
            - listitem [ref=e302]:
              - generic [ref=e303]: "4"
              - 'button "Move 7, Blue fleet: G2 hit" [ref=e306] [cursor=pointer]': G2 hit
              - 'button "Move 8, Red fleet: C4 miss" [ref=e309] [cursor=pointer]': C4 miss
          - generic [ref=e310]:
            - generic [ref=e311]:
              - button "Go to the start" [ref=e312] [cursor=pointer]:
                - img [ref=e315]
              - button "Previous move" [ref=e318] [cursor=pointer]:
                - img [ref=e321]
              - button "Next move" [disabled] [ref=e323]:
                - img [ref=e326]
              - button "Return to current position" [ref=e328] [cursor=pointer]:
                - img [ref=e331]
            - button "Go to move" [ref=e334] [cursor=pointer]:
              - generic [ref=e336]:
                - paragraph [ref=e337]: Go to move
                - img [ref=e340]
        - generic [ref=e343]:
          - group "Game actions" [ref=e344]:
            - button "Resign game" [ref=e345] [cursor=pointer]:
              - paragraph [ref=e348]:
                - text: Resign
                - generic [ref=e349]: game
          - button "History and stats" [ref=e350] [cursor=pointer]:
            - paragraph [ref=e353]: History and stats
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