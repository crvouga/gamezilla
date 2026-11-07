# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--won light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  67393 pixels (ratio 0.21 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/won-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/won-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 67393 pixels (ratio 0.21 of all image pixels) are different.
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
  - 67393 pixels (ratio 0.21 of all image pixels) are different.

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
        - heading "You win" [level=2] [ref=e25]
        - group "What next" [ref=e26]:
          - button "Rematch" [ref=e27] [cursor=pointer]:
            - paragraph [ref=e30]: Rematch
          - button "Change game" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Change game
          - button "Review" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Review
      - generic [ref=e41]:
        - paragraph [ref=e44]: Final
        - list "Moves played" [ref=e49]:
          - listitem [ref=e50]:
            - generic [ref=e51]: Move 17
            - 'button "Move 33, Blue fleet: G10 sinks the destroyer" [ref=e54] [cursor=pointer]': G10 sinks the destroyer
        - button "All moves" [ref=e55] [cursor=pointer]:
          - img [ref=e59]
      - generic [ref=e61]:
        - generic [ref=e63]:
          - generic [ref=e69]:
            - generic [ref=e70]:
              - img "Red fleet" [ref=e71]
              - generic "jordan_plays" [ref=e74]
            - generic [ref=e77]: 5 ships sunk
          - generic [ref=e79]:
            - paragraph [ref=e80]: Red fleet destroyed — all five ships sunk.
            - generic [ref=e82]:
              - radiogroup "Boards" [ref=e84]:
                - radio "Your fleet" [ref=e85] [cursor=pointer]:
                  - generic [ref=e86]: Your fleet
                - radio "Targeting" [checked] [ref=e87] [cursor=pointer]:
                  - generic [ref=e88]: Targeting
              - region "Targeting" [ref=e89]:
                - generic [ref=e91]:
                  - generic [ref=e92]:
                    - group "Targeting" [ref=e94]:
                      - generic [ref=e96]: A
                      - generic [ref=e97]: B
                      - generic [ref=e98]: C
                      - generic [ref=e99]: D
                      - generic [ref=e100]: E
                      - generic [ref=e101]: F
                      - generic [ref=e102]: G
                      - generic [ref=e103]: H
                      - generic [ref=e104]: I
                      - generic [ref=e105]: J
                      - generic [ref=e106]: "1"
                      - 'button "A1: not fired at" [disabled] [ref=e107]'
                      - 'button "B1: not fired at" [disabled] [ref=e108]'
                      - 'button "C1: not fired at" [disabled] [ref=e109]'
                      - 'button "D1: not fired at" [disabled] [ref=e110]'
                      - 'button "E1: not fired at" [disabled] [ref=e111]'
                      - 'button "F1: not fired at" [disabled] [ref=e112]'
                      - 'button "G1: not fired at" [disabled] [ref=e113]'
                      - 'button "H1: not fired at" [disabled] [ref=e114]'
                      - 'button "I1: not fired at" [disabled] [ref=e115]'
                      - 'button "J1: not fired at" [disabled] [ref=e116]'
                      - generic [ref=e117]: "2"
                      - 'button "A2: not fired at" [disabled] [ref=e118]'
                      - 'button "B2: not fired at" [disabled] [ref=e119]'
                      - 'button "C2: not fired at" [disabled] [ref=e120]'
                      - 'button "D2: not fired at" [disabled] [ref=e121]'
                      - 'button "E2: not fired at" [disabled] [ref=e122]'
                      - 'button "F2: hit, sunk Carrier" [disabled] [ref=e123]':
                        - generic: ✖
                      - 'button "G2: hit, sunk Carrier" [disabled] [ref=e124]':
                        - generic: ✖
                      - 'button "H2: hit, sunk Carrier" [disabled] [ref=e125]':
                        - generic: ✖
                      - 'button "I2: hit, sunk Carrier" [disabled] [ref=e126]':
                        - generic: ✖
                      - 'button "J2: hit, sunk Carrier" [disabled] [ref=e127]':
                        - generic: ✖
                      - generic [ref=e128]: "3"
                      - 'button "A3: not fired at" [disabled] [ref=e129]'
                      - 'button "B3: not fired at" [disabled] [ref=e130]'
                      - 'button "C3: not fired at" [disabled] [ref=e131]'
                      - 'button "D3: not fired at" [disabled] [ref=e132]'
                      - 'button "E3: not fired at" [disabled] [ref=e133]'
                      - 'button "F3: not fired at" [disabled] [ref=e134]'
                      - 'button "G3: not fired at" [disabled] [ref=e135]'
                      - 'button "H3: not fired at" [disabled] [ref=e136]'
                      - 'button "I3: not fired at" [disabled] [ref=e137]'
                      - 'button "J3: not fired at" [disabled] [ref=e138]'
                      - generic [ref=e139]: "4"
                      - 'button "A4: not fired at" [disabled] [ref=e140]'
                      - 'button "B4: not fired at" [disabled] [ref=e141]'
                      - 'button "C4: not fired at" [disabled] [ref=e142]'
                      - 'button "D4: not fired at" [disabled] [ref=e143]'
                      - 'button "E4: not fired at" [disabled] [ref=e144]'
                      - 'button "F4: hit, sunk Battleship" [disabled] [ref=e145]':
                        - generic: ✖
                      - 'button "G4: hit, sunk Battleship" [disabled] [ref=e146]':
                        - generic: ✖
                      - 'button "H4: hit, sunk Battleship" [disabled] [ref=e147]':
                        - generic: ✖
                      - 'button "I4: hit, sunk Battleship" [disabled] [ref=e148]':
                        - generic: ✖
                      - 'button "J4: not fired at" [disabled] [ref=e149]'
                      - generic [ref=e150]: "5"
                      - 'button "A5: not fired at" [disabled] [ref=e151]'
                      - 'button "B5: not fired at" [disabled] [ref=e152]'
                      - 'button "C5: not fired at" [disabled] [ref=e153]'
                      - 'button "D5: not fired at" [disabled] [ref=e154]'
                      - 'button "E5: not fired at" [disabled] [ref=e155]'
                      - 'button "F5: not fired at" [disabled] [ref=e156]'
                      - 'button "G5: not fired at" [disabled] [ref=e157]'
                      - 'button "H5: not fired at" [disabled] [ref=e158]'
                      - 'button "I5: not fired at" [disabled] [ref=e159]'
                      - 'button "J5: not fired at" [disabled] [ref=e160]'
                      - generic [ref=e161]: "6"
                      - 'button "A6: not fired at" [disabled] [ref=e162]'
                      - 'button "B6: not fired at" [disabled] [ref=e163]'
                      - 'button "C6: not fired at" [disabled] [ref=e164]'
                      - 'button "D6: not fired at" [disabled] [ref=e165]'
                      - 'button "E6: not fired at" [disabled] [ref=e166]'
                      - 'button "F6: hit, sunk Cruiser" [disabled] [ref=e167]':
                        - generic: ✖
                      - 'button "G6: hit, sunk Cruiser" [disabled] [ref=e168]':
                        - generic: ✖
                      - 'button "H6: hit, sunk Cruiser" [disabled] [ref=e169]':
                        - generic: ✖
                      - 'button "I6: not fired at" [disabled] [ref=e170]'
                      - 'button "J6: not fired at" [disabled] [ref=e171]'
                      - generic [ref=e172]: "7"
                      - 'button "A7: not fired at" [disabled] [ref=e173]'
                      - 'button "B7: not fired at" [disabled] [ref=e174]'
                      - 'button "C7: not fired at" [disabled] [ref=e175]'
                      - 'button "D7: not fired at" [disabled] [ref=e176]'
                      - 'button "E7: not fired at" [disabled] [ref=e177]'
                      - 'button "F7: not fired at" [disabled] [ref=e178]'
                      - 'button "G7: not fired at" [disabled] [ref=e179]'
                      - 'button "H7: not fired at" [disabled] [ref=e180]'
                      - 'button "I7: not fired at" [disabled] [ref=e181]'
                      - 'button "J7: not fired at" [disabled] [ref=e182]'
                      - generic [ref=e183]: "8"
                      - 'button "A8: not fired at" [disabled] [ref=e184]'
                      - 'button "B8: not fired at" [disabled] [ref=e185]'
                      - 'button "C8: not fired at" [disabled] [ref=e186]'
                      - 'button "D8: not fired at" [disabled] [ref=e187]'
                      - 'button "E8: not fired at" [disabled] [ref=e188]'
                      - 'button "F8: hit, sunk Submarine" [disabled] [ref=e189]':
                        - generic: ✖
                      - 'button "G8: hit, sunk Submarine" [disabled] [ref=e190]':
                        - generic: ✖
                      - 'button "H8: hit, sunk Submarine" [disabled] [ref=e191]':
                        - generic: ✖
                      - 'button "I8: not fired at" [disabled] [ref=e192]'
                      - 'button "J8: not fired at" [disabled] [ref=e193]'
                      - generic [ref=e194]: "9"
                      - 'button "A9: not fired at" [disabled] [ref=e195]'
                      - 'button "B9: not fired at" [disabled] [ref=e196]'
                      - 'button "C9: not fired at" [disabled] [ref=e197]'
                      - 'button "D9: not fired at" [disabled] [ref=e198]'
                      - 'button "E9: not fired at" [disabled] [ref=e199]'
                      - 'button "F9: not fired at" [disabled] [ref=e200]'
                      - 'button "G9: not fired at" [disabled] [ref=e201]'
                      - 'button "H9: not fired at" [disabled] [ref=e202]'
                      - 'button "I9: not fired at" [disabled] [ref=e203]'
                      - 'button "J9: not fired at" [disabled] [ref=e204]'
                      - generic [ref=e205]: "10"
                      - 'button "A10: not fired at" [disabled] [ref=e206]'
                      - 'button "B10: not fired at" [disabled] [ref=e207]'
                      - 'button "C10: not fired at" [disabled] [ref=e208]'
                      - 'button "D10: not fired at" [disabled] [ref=e209]'
                      - 'button "E10: not fired at" [disabled] [ref=e210]'
                      - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e211]':
                        - generic: ✖
                      - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [ref=e212]':
                        - generic: ✖
                      - 'button "H10: not fired at" [disabled] [ref=e213]'
                      - 'button "I10: not fired at" [disabled] [ref=e214]'
                      - 'button "J10: not fired at" [disabled] [ref=e215]'
                    - generic [ref=e216]:
                      - button "A1–E2" [pressed] [ref=e217] [cursor=pointer]:
                        - generic [ref=e218]: A1
                        - generic [ref=e219]: E2
                      - button "F1–J2" [ref=e220] [cursor=pointer]:
                        - generic [ref=e221]: F1
                        - generic [ref=e222]: J2
                      - button "A3–E4" [ref=e223] [cursor=pointer]:
                        - generic [ref=e224]: A3
                        - generic [ref=e225]: E4
                      - button "F3–J4" [ref=e226] [cursor=pointer]:
                        - generic [ref=e227]: F3
                        - generic [ref=e228]: J4
                      - button "A5–E6" [ref=e229] [cursor=pointer]:
                        - generic [ref=e230]: A5
                        - generic [ref=e231]: E6
                      - button "F5–J6" [ref=e232] [cursor=pointer]:
                        - generic [ref=e233]: F5
                        - generic [ref=e234]: J6
                      - button "A7–E8" [ref=e235] [cursor=pointer]:
                        - generic [ref=e236]: A7
                        - generic [ref=e237]: E8
                      - button "F7–J8" [ref=e238] [cursor=pointer]:
                        - generic [ref=e239]: F7
                        - generic [ref=e240]: J8
                      - button "A9–E10" [ref=e241] [cursor=pointer]:
                        - generic [ref=e242]: A9
                        - generic [ref=e243]: E10
                      - button "F9–J10" [ref=e244] [cursor=pointer]:
                        - generic [ref=e245]: F9
                        - generic [ref=e246]: J10
                  - generic [ref=e248]:
                    - paragraph [ref=e249]: "Aim: A1–E2"
                    - button "Map" [ref=e250] [cursor=pointer]:
                      - paragraph [ref=e253]: Map
                  - group "Precise aim" [ref=e256]:
                    - generic [ref=e258]: A
                    - generic [ref=e259]: B
                    - generic [ref=e260]: C
                    - generic [ref=e261]: D
                    - generic [ref=e262]: E
                    - generic [ref=e263]: "1"
                    - 'button "A1: not fired at" [disabled] [ref=e264]'
                    - 'button "B1: not fired at" [disabled] [ref=e265]'
                    - 'button "C1: not fired at" [disabled] [ref=e266]'
                    - 'button "D1: not fired at" [disabled] [ref=e267]'
                    - 'button "E1: not fired at" [disabled] [ref=e268]'
                    - generic [ref=e269]: "2"
                    - 'button "A2: not fired at" [disabled] [ref=e270]'
                    - 'button "B2: not fired at" [disabled] [ref=e271]'
                    - 'button "C2: not fired at" [disabled] [ref=e272]'
                    - 'button "D2: not fired at" [disabled] [ref=e273]'
                    - 'button "E2: not fired at" [disabled] [ref=e274]'
            - list "Key" [ref=e275]:
              - listitem [ref=e276]:
                - generic [ref=e277]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e278]:
                - generic [ref=e279]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e280]:
                - generic [ref=e281]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e282]:
                - generic [ref=e283]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e285]:
            - generic [ref=e286]:
              - generic [ref=e287]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Sank the whole fleet.
          - generic [ref=e295]:
            - img "Blue fleet" [ref=e296]
            - generic "avery" [ref=e299]
        - generic [ref=e300]:
          - list "Standings" [ref=e302]:
            - listitem [ref=e303]:
              - generic [ref=e304]:
                - generic [ref=e305]: 1st
                - generic [ref=e308]: avery
            - listitem [ref=e309]:
              - generic [ref=e310]:
                - generic [ref=e311]: 2nd
                - generic [ref=e314]: jordan_plays
          - button "History and stats" [ref=e317] [cursor=pointer]:
            - generic [ref=e319]:
              - paragraph [ref=e320]: History and stats
              - img [ref=e323]
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