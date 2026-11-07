# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--sink-the-fleet light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  160044 pixels (ratio 0.14 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/sink-the-fleet-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/sink-the-fleet-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 160044 pixels (ratio 0.14 of all image pixels) are different.
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
  - 160044 pixels (ratio 0.14 of all image pixels) are different.

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
    - generic [ref=e24]:
      - generic [ref=e26]:
        - heading "You win" [level=2] [ref=e28]
        - group "What next" [ref=e29]:
          - button "Rematch" [ref=e30] [cursor=pointer]:
            - paragraph [ref=e33]: Rematch
          - button "Change game" [ref=e34] [cursor=pointer]:
            - paragraph [ref=e37]: Change game
          - button "Review" [ref=e38] [cursor=pointer]:
            - paragraph [ref=e41]: Review
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e50]:
            - generic [ref=e51]:
              - img "Red fleet" [ref=e52]
              - generic "jordan_plays" [ref=e55]
            - generic [ref=e58]: 5 ships sunk
          - generic [ref=e60]:
            - paragraph [ref=e61]: Red fleet destroyed — all five ships sunk.
            - generic [ref=e63]:
              - radiogroup "Boards" [ref=e65]:
                - radio "Your fleet" [ref=e66] [cursor=pointer]:
                  - generic [ref=e67]: Your fleet
                - radio "Targeting" [checked] [ref=e68] [cursor=pointer]:
                  - generic [ref=e69]: Targeting
              - region "Targeting" [ref=e70]:
                - generic [ref=e72]:
                  - generic [ref=e73]:
                    - group "Targeting" [ref=e75]:
                      - generic [ref=e77]: A
                      - generic [ref=e78]: B
                      - generic [ref=e79]: C
                      - generic [ref=e80]: D
                      - generic [ref=e81]: E
                      - generic [ref=e82]: F
                      - generic [ref=e83]: G
                      - generic [ref=e84]: H
                      - generic [ref=e85]: I
                      - generic [ref=e86]: J
                      - generic [ref=e87]: "1"
                      - 'button "A1: not fired at" [disabled] [ref=e88]'
                      - 'button "B1: not fired at" [disabled] [ref=e89]'
                      - 'button "C1: not fired at" [disabled] [ref=e90]'
                      - 'button "D1: not fired at" [disabled] [ref=e91]'
                      - 'button "E1: not fired at" [disabled] [ref=e92]'
                      - 'button "F1: not fired at" [disabled] [ref=e93]'
                      - 'button "G1: not fired at" [disabled] [ref=e94]'
                      - 'button "H1: not fired at" [disabled] [ref=e95]'
                      - 'button "I1: not fired at" [disabled] [ref=e96]'
                      - 'button "J1: not fired at" [disabled] [ref=e97]'
                      - generic [ref=e98]: "2"
                      - 'button "A2: not fired at" [disabled] [ref=e99]'
                      - 'button "B2: not fired at" [disabled] [ref=e100]'
                      - 'button "C2: not fired at" [disabled] [ref=e101]'
                      - 'button "D2: not fired at" [disabled] [ref=e102]'
                      - 'button "E2: not fired at" [disabled] [ref=e103]'
                      - 'button "F2: hit, sunk Carrier" [disabled] [ref=e104]':
                        - generic: ✖
                      - 'button "G2: hit, sunk Carrier" [disabled] [ref=e105]':
                        - generic: ✖
                      - 'button "H2: hit, sunk Carrier" [disabled] [ref=e106]':
                        - generic: ✖
                      - 'button "I2: hit, sunk Carrier" [disabled] [ref=e107]':
                        - generic: ✖
                      - 'button "J2: hit, sunk Carrier" [disabled] [ref=e108]':
                        - generic: ✖
                      - generic [ref=e109]: "3"
                      - 'button "A3: not fired at" [disabled] [ref=e110]'
                      - 'button "B3: not fired at" [disabled] [ref=e111]'
                      - 'button "C3: not fired at" [disabled] [ref=e112]'
                      - 'button "D3: not fired at" [disabled] [ref=e113]'
                      - 'button "E3: not fired at" [disabled] [ref=e114]'
                      - 'button "F3: not fired at" [disabled] [ref=e115]'
                      - 'button "G3: not fired at" [disabled] [ref=e116]'
                      - 'button "H3: not fired at" [disabled] [ref=e117]'
                      - 'button "I3: not fired at" [disabled] [ref=e118]'
                      - 'button "J3: not fired at" [disabled] [ref=e119]'
                      - generic [ref=e120]: "4"
                      - 'button "A4: not fired at" [disabled] [ref=e121]'
                      - 'button "B4: not fired at" [disabled] [ref=e122]'
                      - 'button "C4: not fired at" [disabled] [ref=e123]'
                      - 'button "D4: not fired at" [disabled] [ref=e124]'
                      - 'button "E4: not fired at" [disabled] [ref=e125]'
                      - 'button "F4: hit, sunk Battleship" [disabled] [ref=e126]':
                        - generic: ✖
                      - 'button "G4: hit, sunk Battleship" [disabled] [ref=e127]':
                        - generic: ✖
                      - 'button "H4: hit, sunk Battleship" [disabled] [ref=e128]':
                        - generic: ✖
                      - 'button "I4: hit, sunk Battleship" [disabled] [ref=e129]':
                        - generic: ✖
                      - 'button "J4: not fired at" [disabled] [ref=e130]'
                      - generic [ref=e131]: "5"
                      - 'button "A5: not fired at" [disabled] [ref=e132]'
                      - 'button "B5: not fired at" [disabled] [ref=e133]'
                      - 'button "C5: not fired at" [disabled] [ref=e134]'
                      - 'button "D5: not fired at" [disabled] [ref=e135]'
                      - 'button "E5: not fired at" [disabled] [ref=e136]'
                      - 'button "F5: not fired at" [disabled] [ref=e137]'
                      - 'button "G5: not fired at" [disabled] [ref=e138]'
                      - 'button "H5: not fired at" [disabled] [ref=e139]'
                      - 'button "I5: not fired at" [disabled] [ref=e140]'
                      - 'button "J5: not fired at" [disabled] [ref=e141]'
                      - generic [ref=e142]: "6"
                      - 'button "A6: not fired at" [disabled] [ref=e143]'
                      - 'button "B6: not fired at" [disabled] [ref=e144]'
                      - 'button "C6: not fired at" [disabled] [ref=e145]'
                      - 'button "D6: not fired at" [disabled] [ref=e146]'
                      - 'button "E6: not fired at" [disabled] [ref=e147]'
                      - 'button "F6: hit, sunk Cruiser" [disabled] [ref=e148]':
                        - generic: ✖
                      - 'button "G6: hit, sunk Cruiser" [disabled] [ref=e149]':
                        - generic: ✖
                      - 'button "H6: hit, sunk Cruiser" [disabled] [ref=e150]':
                        - generic: ✖
                      - 'button "I6: not fired at" [disabled] [ref=e151]'
                      - 'button "J6: not fired at" [disabled] [ref=e152]'
                      - generic [ref=e153]: "7"
                      - 'button "A7: not fired at" [disabled] [ref=e154]'
                      - 'button "B7: not fired at" [disabled] [ref=e155]'
                      - 'button "C7: not fired at" [disabled] [ref=e156]'
                      - 'button "D7: not fired at" [disabled] [ref=e157]'
                      - 'button "E7: not fired at" [disabled] [ref=e158]'
                      - 'button "F7: not fired at" [disabled] [ref=e159]'
                      - 'button "G7: not fired at" [disabled] [ref=e160]'
                      - 'button "H7: not fired at" [disabled] [ref=e161]'
                      - 'button "I7: not fired at" [disabled] [ref=e162]'
                      - 'button "J7: not fired at" [disabled] [ref=e163]'
                      - generic [ref=e164]: "8"
                      - 'button "A8: not fired at" [disabled] [ref=e165]'
                      - 'button "B8: not fired at" [disabled] [ref=e166]'
                      - 'button "C8: not fired at" [disabled] [ref=e167]'
                      - 'button "D8: not fired at" [disabled] [ref=e168]'
                      - 'button "E8: not fired at" [disabled] [ref=e169]'
                      - 'button "F8: hit, sunk Submarine" [disabled] [ref=e170]':
                        - generic: ✖
                      - 'button "G8: hit, sunk Submarine" [disabled] [ref=e171]':
                        - generic: ✖
                      - 'button "H8: hit, sunk Submarine" [disabled] [ref=e172]':
                        - generic: ✖
                      - 'button "I8: not fired at" [disabled] [ref=e173]'
                      - 'button "J8: not fired at" [disabled] [ref=e174]'
                      - generic [ref=e175]: "9"
                      - 'button "A9: not fired at" [disabled] [ref=e176]'
                      - 'button "B9: not fired at" [disabled] [ref=e177]'
                      - 'button "C9: not fired at" [disabled] [ref=e178]'
                      - 'button "D9: not fired at" [disabled] [ref=e179]'
                      - 'button "E9: not fired at" [disabled] [ref=e180]'
                      - 'button "F9: not fired at" [disabled] [ref=e181]'
                      - 'button "G9: not fired at" [disabled] [ref=e182]'
                      - 'button "H9: not fired at" [disabled] [ref=e183]'
                      - 'button "I9: not fired at" [disabled] [ref=e184]'
                      - 'button "J9: not fired at" [disabled] [ref=e185]'
                      - generic [ref=e186]: "10"
                      - 'button "A10: not fired at" [disabled] [ref=e187]'
                      - 'button "B10: not fired at" [disabled] [ref=e188]'
                      - 'button "C10: not fired at" [disabled] [ref=e189]'
                      - 'button "D10: not fired at" [disabled] [ref=e190]'
                      - 'button "E10: not fired at" [disabled] [ref=e191]'
                      - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e192]':
                        - generic: ✖
                      - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [active] [ref=e193]':
                        - generic: ✖
                      - 'button "H10: not fired at" [disabled] [ref=e194]'
                      - 'button "I10: not fired at" [disabled] [ref=e195]'
                      - 'button "J10: not fired at" [disabled] [ref=e196]'
                    - generic [ref=e197]:
                      - button "A1–E2" [ref=e198] [cursor=pointer]:
                        - generic [ref=e199]: A1
                        - generic [ref=e200]: E2
                      - button "F1–J2" [ref=e201] [cursor=pointer]:
                        - generic [ref=e202]: F1
                        - generic [ref=e203]: J2
                      - button "A3–E4" [ref=e204] [cursor=pointer]:
                        - generic [ref=e205]: A3
                        - generic [ref=e206]: E4
                      - button "F3–J4" [ref=e207] [cursor=pointer]:
                        - generic [ref=e208]: F3
                        - generic [ref=e209]: J4
                      - button "A5–E6" [ref=e210] [cursor=pointer]:
                        - generic [ref=e211]: A5
                        - generic [ref=e212]: E6
                      - button "F5–J6" [ref=e213] [cursor=pointer]:
                        - generic [ref=e214]: F5
                        - generic [ref=e215]: J6
                      - button "A7–E8" [ref=e216] [cursor=pointer]:
                        - generic [ref=e217]: A7
                        - generic [ref=e218]: E8
                      - button "F7–J8" [ref=e219] [cursor=pointer]:
                        - generic [ref=e220]: F7
                        - generic [ref=e221]: J8
                      - button "A9–E10" [ref=e222] [cursor=pointer]:
                        - generic [ref=e223]: A9
                        - generic [ref=e224]: E10
                      - button "F9–J10" [pressed] [ref=e225] [cursor=pointer]:
                        - generic [ref=e226]: F9
                        - generic [ref=e227]: J10
                  - generic [ref=e229]:
                    - paragraph [ref=e230]: "Aim: F9–J10"
                    - button "Map" [ref=e231] [cursor=pointer]:
                      - paragraph [ref=e234]: Map
                  - group "Precise aim" [ref=e237]:
                    - generic [ref=e239]: F
                    - generic [ref=e240]: G
                    - generic [ref=e241]: H
                    - generic [ref=e242]: I
                    - generic [ref=e243]: J
                    - generic [ref=e244]: "9"
                    - 'button "F9: not fired at" [disabled] [ref=e245]'
                    - 'button "G9: not fired at" [disabled] [ref=e246]'
                    - 'button "H9: not fired at" [disabled] [ref=e247]'
                    - 'button "I9: not fired at" [disabled] [ref=e248]'
                    - 'button "J9: not fired at" [disabled] [ref=e249]'
                    - generic [ref=e250]: "10"
                    - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e251]':
                      - generic: ✖
                    - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [ref=e252]':
                      - generic: ✖
                    - 'button "H10: not fired at" [disabled] [ref=e253]'
                    - 'button "I10: not fired at" [disabled] [ref=e254]'
                    - 'button "J10: not fired at" [disabled] [ref=e255]'
            - list "Key" [ref=e256]:
              - listitem [ref=e257]:
                - generic [ref=e258]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e259]:
                - generic [ref=e260]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e261]:
                - generic [ref=e262]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e263]:
                - generic [ref=e264]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e266]:
            - generic [ref=e267]:
              - generic [ref=e268]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Sank the whole fleet.
          - generic [ref=e276]:
            - img "Blue fleet" [ref=e277]
            - generic "avery" [ref=e280]
        - list "Standings" [ref=e283]:
          - listitem [ref=e284]:
            - generic [ref=e285]:
              - generic [ref=e286]: 1st
              - generic [ref=e289]: avery
          - listitem [ref=e290]:
            - generic [ref=e291]:
              - generic [ref=e292]: 2nd
              - generic [ref=e295]: jordan_plays
        - region "Game record" [ref=e297]:
          - heading "Game record" [level=2] [ref=e300]
          - generic [ref=e301]:
            - list "Moves played" [ref=e303]:
              - listitem [ref=e304]:
                - generic [ref=e305]: "1"
                - 'button "Move 1, Blue fleet: F2 hit" [ref=e308] [cursor=pointer]': F2 hit
                - 'button "Move 2, Red fleet: A2 miss" [ref=e311] [cursor=pointer]': A2 miss
              - listitem [ref=e312]:
                - generic [ref=e313]: "2"
                - 'button "Move 3, Blue fleet: G2 hit" [ref=e316] [cursor=pointer]': G2 hit
                - 'button "Move 4, Red fleet: B2 miss" [ref=e319] [cursor=pointer]': B2 miss
              - listitem [ref=e320]:
                - generic [ref=e321]: "3"
                - 'button "Move 5, Blue fleet: H2 hit" [ref=e324] [cursor=pointer]': H2 hit
                - 'button "Move 6, Red fleet: C2 miss" [ref=e327] [cursor=pointer]': C2 miss
              - listitem [ref=e328]:
                - generic [ref=e329]: "4"
                - 'button "Move 7, Blue fleet: I2 hit" [ref=e332] [cursor=pointer]': I2 hit
                - 'button "Move 8, Red fleet: D2 miss" [ref=e335] [cursor=pointer]': D2 miss
              - listitem [ref=e336]:
                - generic [ref=e337]: "5"
                - 'button "Move 9, Blue fleet: J2 sinks the carrier" [ref=e340] [cursor=pointer]': J2 sinks the carrier
                - 'button "Move 10, Red fleet: E2 miss" [ref=e343] [cursor=pointer]': E2 miss
              - listitem [ref=e344]:
                - generic [ref=e345]: "6"
                - 'button "Move 11, Blue fleet: F4 hit" [ref=e348] [cursor=pointer]': F4 hit
                - 'button "Move 12, Red fleet: F2 miss" [ref=e351] [cursor=pointer]': F2 miss
              - listitem [ref=e352]:
                - generic [ref=e353]: "7"
                - 'button "Move 13, Blue fleet: G4 hit" [ref=e356] [cursor=pointer]': G4 hit
                - 'button "Move 14, Red fleet: G2 miss" [ref=e359] [cursor=pointer]': G2 miss
              - listitem [ref=e360]:
                - generic [ref=e361]: "8"
                - 'button "Move 15, Blue fleet: H4 hit" [ref=e364] [cursor=pointer]': H4 hit
                - 'button "Move 16, Red fleet: H2 miss" [ref=e367] [cursor=pointer]': H2 miss
              - listitem [ref=e368]:
                - generic [ref=e369]: "9"
                - 'button "Move 17, Blue fleet: I4 sinks the battleship" [ref=e372] [cursor=pointer]': I4 sinks the battleship
                - 'button "Move 18, Red fleet: I2 miss" [ref=e375] [cursor=pointer]': I2 miss
              - listitem [ref=e376]:
                - generic [ref=e377]: "10"
                - 'button "Move 19, Blue fleet: F6 hit" [ref=e380] [cursor=pointer]': F6 hit
                - 'button "Move 20, Red fleet: J2 miss" [ref=e383] [cursor=pointer]': J2 miss
              - listitem [ref=e384]:
                - generic [ref=e385]: "11"
                - 'button "Move 21, Blue fleet: G6 hit" [ref=e388] [cursor=pointer]': G6 hit
                - 'button "Move 22, Red fleet: A4 miss" [ref=e391] [cursor=pointer]': A4 miss
              - listitem [ref=e392]:
                - generic [ref=e393]: "12"
                - 'button "Move 23, Blue fleet: H6 sinks the cruiser" [ref=e396] [cursor=pointer]': H6 sinks the cruiser
                - 'button "Move 24, Red fleet: B4 miss" [ref=e399] [cursor=pointer]': B4 miss
              - listitem [ref=e400]:
                - generic [ref=e401]: "13"
                - 'button "Move 25, Blue fleet: F8 hit" [ref=e404] [cursor=pointer]': F8 hit
                - 'button "Move 26, Red fleet: C4 miss" [ref=e407] [cursor=pointer]': C4 miss
              - listitem [ref=e408]:
                - generic [ref=e409]: "14"
                - 'button "Move 27, Blue fleet: G8 hit" [ref=e412] [cursor=pointer]': G8 hit
                - 'button "Move 28, Red fleet: D4 miss" [ref=e415] [cursor=pointer]': D4 miss
              - listitem [ref=e416]:
                - generic [ref=e417]: "15"
                - 'button "Move 29, Blue fleet: H8 sinks the submarine" [ref=e420] [cursor=pointer]': H8 sinks the submarine
                - 'button "Move 30, Red fleet: E4 miss" [ref=e423] [cursor=pointer]': E4 miss
              - listitem [ref=e424]:
                - generic [ref=e425]: "16"
                - 'button "Move 31, Blue fleet: F10 hit" [ref=e428] [cursor=pointer]': F10 hit
                - 'button "Move 32, Red fleet: F4 miss" [ref=e431] [cursor=pointer]': F4 miss
              - listitem [ref=e432]:
                - generic [ref=e433]: "17"
                - 'button "Move 33, Blue fleet: G10 sinks the destroyer" [ref=e436] [cursor=pointer]': G10 sinks the destroyer
            - generic [ref=e437]:
              - generic [ref=e438]:
                - button "Go to the start" [ref=e439] [cursor=pointer]:
                  - img [ref=e442]
                - button "Previous move" [ref=e445] [cursor=pointer]:
                  - img [ref=e448]
                - button "Next move" [disabled] [ref=e450]:
                  - img [ref=e453]
                - button "Return to current position" [ref=e455] [cursor=pointer]:
                  - img [ref=e458]
              - button "Go to move" [ref=e461] [cursor=pointer]:
                - generic [ref=e463]:
                  - paragraph [ref=e464]: Go to move
                  - img [ref=e467]
          - button "History and stats" [ref=e471] [cursor=pointer]:
            - paragraph [ref=e474]: History and stats
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