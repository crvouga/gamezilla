# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--won light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  178389 pixels (ratio 0.15 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/won-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/won-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 178389 pixels (ratio 0.15 of all image pixels) are different.
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
  - 178389 pixels (ratio 0.15 of all image pixels) are different.

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
                    - 'button "A1: not fired at" [disabled] [ref=e85]'
                    - 'button "B1: not fired at" [disabled] [ref=e86]'
                    - 'button "C1: not fired at" [disabled] [ref=e87]'
                    - 'button "D1: not fired at" [disabled] [ref=e88]'
                    - 'button "E1: not fired at" [disabled] [ref=e89]'
                    - 'button "F1: not fired at" [disabled] [ref=e90]'
                    - 'button "G1: not fired at" [disabled] [ref=e91]'
                    - 'button "H1: not fired at" [disabled] [ref=e92]'
                    - 'button "I1: not fired at" [disabled] [ref=e93]'
                    - 'button "J1: not fired at" [disabled] [ref=e94]'
                    - generic [ref=e95]: "2"
                    - 'button "A2: not fired at" [disabled] [ref=e96]'
                    - 'button "B2: not fired at" [disabled] [ref=e97]'
                    - 'button "C2: not fired at" [disabled] [ref=e98]'
                    - 'button "D2: not fired at" [disabled] [ref=e99]'
                    - 'button "E2: not fired at" [disabled] [ref=e100]'
                    - 'button "F2: hit, sunk Carrier" [disabled] [ref=e101]':
                      - generic: ✖
                    - 'button "G2: hit, sunk Carrier" [disabled] [ref=e102]':
                      - generic: ✖
                    - 'button "H2: hit, sunk Carrier" [disabled] [ref=e103]':
                      - generic: ✖
                    - 'button "I2: hit, sunk Carrier" [disabled] [ref=e104]':
                      - generic: ✖
                    - 'button "J2: hit, sunk Carrier" [disabled] [ref=e105]':
                      - generic: ✖
                    - generic [ref=e106]: "3"
                    - 'button "A3: not fired at" [disabled] [ref=e107]'
                    - 'button "B3: not fired at" [disabled] [ref=e108]'
                    - 'button "C3: not fired at" [disabled] [ref=e109]'
                    - 'button "D3: not fired at" [disabled] [ref=e110]'
                    - 'button "E3: not fired at" [disabled] [ref=e111]'
                    - 'button "F3: not fired at" [disabled] [ref=e112]'
                    - 'button "G3: not fired at" [disabled] [ref=e113]'
                    - 'button "H3: not fired at" [disabled] [ref=e114]'
                    - 'button "I3: not fired at" [disabled] [ref=e115]'
                    - 'button "J3: not fired at" [disabled] [ref=e116]'
                    - generic [ref=e117]: "4"
                    - 'button "A4: not fired at" [disabled] [ref=e118]'
                    - 'button "B4: not fired at" [disabled] [ref=e119]'
                    - 'button "C4: not fired at" [disabled] [ref=e120]'
                    - 'button "D4: not fired at" [disabled] [ref=e121]'
                    - 'button "E4: not fired at" [disabled] [ref=e122]'
                    - 'button "F4: hit, sunk Battleship" [disabled] [ref=e123]':
                      - generic: ✖
                    - 'button "G4: hit, sunk Battleship" [disabled] [ref=e124]':
                      - generic: ✖
                    - 'button "H4: hit, sunk Battleship" [disabled] [ref=e125]':
                      - generic: ✖
                    - 'button "I4: hit, sunk Battleship" [disabled] [ref=e126]':
                      - generic: ✖
                    - 'button "J4: not fired at" [disabled] [ref=e127]'
                    - generic [ref=e128]: "5"
                    - 'button "A5: not fired at" [disabled] [ref=e129]'
                    - 'button "B5: not fired at" [disabled] [ref=e130]'
                    - 'button "C5: not fired at" [disabled] [ref=e131]'
                    - 'button "D5: not fired at" [disabled] [ref=e132]'
                    - 'button "E5: not fired at" [disabled] [ref=e133]'
                    - 'button "F5: not fired at" [disabled] [ref=e134]'
                    - 'button "G5: not fired at" [disabled] [ref=e135]'
                    - 'button "H5: not fired at" [disabled] [ref=e136]'
                    - 'button "I5: not fired at" [disabled] [ref=e137]'
                    - 'button "J5: not fired at" [disabled] [ref=e138]'
                    - generic [ref=e139]: "6"
                    - 'button "A6: not fired at" [disabled] [ref=e140]'
                    - 'button "B6: not fired at" [disabled] [ref=e141]'
                    - 'button "C6: not fired at" [disabled] [ref=e142]'
                    - 'button "D6: not fired at" [disabled] [ref=e143]'
                    - 'button "E6: not fired at" [disabled] [ref=e144]'
                    - 'button "F6: hit, sunk Cruiser" [disabled] [ref=e145]':
                      - generic: ✖
                    - 'button "G6: hit, sunk Cruiser" [disabled] [ref=e146]':
                      - generic: ✖
                    - 'button "H6: hit, sunk Cruiser" [disabled] [ref=e147]':
                      - generic: ✖
                    - 'button "I6: not fired at" [disabled] [ref=e148]'
                    - 'button "J6: not fired at" [disabled] [ref=e149]'
                    - generic [ref=e150]: "7"
                    - 'button "A7: not fired at" [disabled] [ref=e151]'
                    - 'button "B7: not fired at" [disabled] [ref=e152]'
                    - 'button "C7: not fired at" [disabled] [ref=e153]'
                    - 'button "D7: not fired at" [disabled] [ref=e154]'
                    - 'button "E7: not fired at" [disabled] [ref=e155]'
                    - 'button "F7: not fired at" [disabled] [ref=e156]'
                    - 'button "G7: not fired at" [disabled] [ref=e157]'
                    - 'button "H7: not fired at" [disabled] [ref=e158]'
                    - 'button "I7: not fired at" [disabled] [ref=e159]'
                    - 'button "J7: not fired at" [disabled] [ref=e160]'
                    - generic [ref=e161]: "8"
                    - 'button "A8: not fired at" [disabled] [ref=e162]'
                    - 'button "B8: not fired at" [disabled] [ref=e163]'
                    - 'button "C8: not fired at" [disabled] [ref=e164]'
                    - 'button "D8: not fired at" [disabled] [ref=e165]'
                    - 'button "E8: not fired at" [disabled] [ref=e166]'
                    - 'button "F8: hit, sunk Submarine" [disabled] [ref=e167]':
                      - generic: ✖
                    - 'button "G8: hit, sunk Submarine" [disabled] [ref=e168]':
                      - generic: ✖
                    - 'button "H8: hit, sunk Submarine" [disabled] [ref=e169]':
                      - generic: ✖
                    - 'button "I8: not fired at" [disabled] [ref=e170]'
                    - 'button "J8: not fired at" [disabled] [ref=e171]'
                    - generic [ref=e172]: "9"
                    - 'button "A9: not fired at" [disabled] [ref=e173]'
                    - 'button "B9: not fired at" [disabled] [ref=e174]'
                    - 'button "C9: not fired at" [disabled] [ref=e175]'
                    - 'button "D9: not fired at" [disabled] [ref=e176]'
                    - 'button "E9: not fired at" [disabled] [ref=e177]'
                    - 'button "F9: not fired at" [disabled] [ref=e178]'
                    - 'button "G9: not fired at" [disabled] [ref=e179]'
                    - 'button "H9: not fired at" [disabled] [ref=e180]'
                    - 'button "I9: not fired at" [disabled] [ref=e181]'
                    - 'button "J9: not fired at" [disabled] [ref=e182]'
                    - generic [ref=e183]: "10"
                    - 'button "A10: not fired at" [disabled] [ref=e184]'
                    - 'button "B10: not fired at" [disabled] [ref=e185]'
                    - 'button "C10: not fired at" [disabled] [ref=e186]'
                    - 'button "D10: not fired at" [disabled] [ref=e187]'
                    - 'button "E10: not fired at" [disabled] [ref=e188]'
                    - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e189]':
                      - generic: ✖
                    - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [ref=e190]':
                      - generic: ✖
                    - 'button "H10: not fired at" [disabled] [ref=e191]'
                    - 'button "I10: not fired at" [disabled] [ref=e192]'
                    - 'button "J10: not fired at" [disabled] [ref=e193]'
                  - button "Larger targets" [ref=e195] [cursor=pointer]:
                    - paragraph [ref=e198]: Larger targets
            - list "Key" [ref=e199]:
              - listitem [ref=e200]:
                - generic [ref=e201]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e202]:
                - generic [ref=e203]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e204]:
                - generic [ref=e205]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e206]:
                - generic [ref=e207]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e209]:
            - generic [ref=e210]:
              - generic [ref=e211]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Sank the whole fleet.
          - generic [ref=e219]:
            - img "Blue fleet" [ref=e220]
            - generic "avery" [ref=e223]
        - list "Standings" [ref=e226]:
          - listitem [ref=e227]:
            - generic [ref=e228]:
              - generic [ref=e229]: 1st
              - generic [ref=e232]: avery
          - listitem [ref=e233]:
            - generic [ref=e234]:
              - generic [ref=e235]: 2nd
              - generic [ref=e238]: jordan_plays
        - region "Game record" [ref=e240]:
          - heading "Game record" [level=2] [ref=e243]
          - generic [ref=e244]:
            - list "Moves played" [ref=e246]:
              - listitem [ref=e247]:
                - generic [ref=e248]: "1"
                - 'button "Move 1, Blue fleet: F2 hit" [ref=e251] [cursor=pointer]': F2 hit
                - 'button "Move 2, Red fleet: A2 miss" [ref=e254] [cursor=pointer]': A2 miss
              - listitem [ref=e255]:
                - generic [ref=e256]: "2"
                - 'button "Move 3, Blue fleet: G2 hit" [ref=e259] [cursor=pointer]': G2 hit
                - 'button "Move 4, Red fleet: B2 miss" [ref=e262] [cursor=pointer]': B2 miss
              - listitem [ref=e263]:
                - generic [ref=e264]: "3"
                - 'button "Move 5, Blue fleet: H2 hit" [ref=e267] [cursor=pointer]': H2 hit
                - 'button "Move 6, Red fleet: C2 miss" [ref=e270] [cursor=pointer]': C2 miss
              - listitem [ref=e271]:
                - generic [ref=e272]: "4"
                - 'button "Move 7, Blue fleet: I2 hit" [ref=e275] [cursor=pointer]': I2 hit
                - 'button "Move 8, Red fleet: D2 miss" [ref=e278] [cursor=pointer]': D2 miss
              - listitem [ref=e279]:
                - generic [ref=e280]: "5"
                - 'button "Move 9, Blue fleet: J2 sinks the carrier" [ref=e283] [cursor=pointer]': J2 sinks the carrier
                - 'button "Move 10, Red fleet: E2 miss" [ref=e286] [cursor=pointer]': E2 miss
              - listitem [ref=e287]:
                - generic [ref=e288]: "6"
                - 'button "Move 11, Blue fleet: F4 hit" [ref=e291] [cursor=pointer]': F4 hit
                - 'button "Move 12, Red fleet: F2 miss" [ref=e294] [cursor=pointer]': F2 miss
              - listitem [ref=e295]:
                - generic [ref=e296]: "7"
                - 'button "Move 13, Blue fleet: G4 hit" [ref=e299] [cursor=pointer]': G4 hit
                - 'button "Move 14, Red fleet: G2 miss" [ref=e302] [cursor=pointer]': G2 miss
              - listitem [ref=e303]:
                - generic [ref=e304]: "8"
                - 'button "Move 15, Blue fleet: H4 hit" [ref=e307] [cursor=pointer]': H4 hit
                - 'button "Move 16, Red fleet: H2 miss" [ref=e310] [cursor=pointer]': H2 miss
              - listitem [ref=e311]:
                - generic [ref=e312]: "9"
                - 'button "Move 17, Blue fleet: I4 sinks the battleship" [ref=e315] [cursor=pointer]': I4 sinks the battleship
                - 'button "Move 18, Red fleet: I2 miss" [ref=e318] [cursor=pointer]': I2 miss
              - listitem [ref=e319]:
                - generic [ref=e320]: "10"
                - 'button "Move 19, Blue fleet: F6 hit" [ref=e323] [cursor=pointer]': F6 hit
                - 'button "Move 20, Red fleet: J2 miss" [ref=e326] [cursor=pointer]': J2 miss
              - listitem [ref=e327]:
                - generic [ref=e328]: "11"
                - 'button "Move 21, Blue fleet: G6 hit" [ref=e331] [cursor=pointer]': G6 hit
                - 'button "Move 22, Red fleet: A4 miss" [ref=e334] [cursor=pointer]': A4 miss
              - listitem [ref=e335]:
                - generic [ref=e336]: "12"
                - 'button "Move 23, Blue fleet: H6 sinks the cruiser" [ref=e339] [cursor=pointer]': H6 sinks the cruiser
                - 'button "Move 24, Red fleet: B4 miss" [ref=e342] [cursor=pointer]': B4 miss
              - listitem [ref=e343]:
                - generic [ref=e344]: "13"
                - 'button "Move 25, Blue fleet: F8 hit" [ref=e347] [cursor=pointer]': F8 hit
                - 'button "Move 26, Red fleet: C4 miss" [ref=e350] [cursor=pointer]': C4 miss
              - listitem [ref=e351]:
                - generic [ref=e352]: "14"
                - 'button "Move 27, Blue fleet: G8 hit" [ref=e355] [cursor=pointer]': G8 hit
                - 'button "Move 28, Red fleet: D4 miss" [ref=e358] [cursor=pointer]': D4 miss
              - listitem [ref=e359]:
                - generic [ref=e360]: "15"
                - 'button "Move 29, Blue fleet: H8 sinks the submarine" [ref=e363] [cursor=pointer]': H8 sinks the submarine
                - 'button "Move 30, Red fleet: E4 miss" [ref=e366] [cursor=pointer]': E4 miss
              - listitem [ref=e367]:
                - generic [ref=e368]: "16"
                - 'button "Move 31, Blue fleet: F10 hit" [ref=e371] [cursor=pointer]': F10 hit
                - 'button "Move 32, Red fleet: F4 miss" [ref=e374] [cursor=pointer]': F4 miss
              - listitem [ref=e375]:
                - generic [ref=e376]: "17"
                - 'button "Move 33, Blue fleet: G10 sinks the destroyer" [ref=e379] [cursor=pointer]': G10 sinks the destroyer
            - generic [ref=e380]:
              - generic [ref=e381]:
                - button "Go to the start" [ref=e382] [cursor=pointer]:
                  - img [ref=e385]
                - button "Previous move" [ref=e388] [cursor=pointer]:
                  - img [ref=e391]
                - button "Next move" [disabled] [ref=e393]:
                  - img [ref=e396]
                - button "Return to current position" [ref=e398] [cursor=pointer]:
                  - img [ref=e401]
              - button "Go to move" [ref=e404] [cursor=pointer]:
                - generic [ref=e406]:
                  - paragraph [ref=e407]: Go to move
                  - img [ref=e410]
          - button "History and stats" [ref=e414] [cursor=pointer]:
            - paragraph [ref=e417]: History and stats
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