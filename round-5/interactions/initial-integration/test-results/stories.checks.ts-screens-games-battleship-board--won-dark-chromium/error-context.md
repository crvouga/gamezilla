# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--won dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  56657 pixels (ratio 0.18 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/won-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/won-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 56657 pixels (ratio 0.18 of all image pixels) are different.
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
  - 56657 pixels (ratio 0.18 of all image pixels) are different.

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
                - generic [ref=e90]:
                  - group "Targeting" [ref=e91]:
                    - generic [ref=e93]: A
                    - generic [ref=e94]: B
                    - generic [ref=e95]: C
                    - generic [ref=e96]: D
                    - generic [ref=e97]: E
                    - generic [ref=e98]: F
                    - generic [ref=e99]: G
                    - generic [ref=e100]: H
                    - generic [ref=e101]: I
                    - generic [ref=e102]: J
                    - generic [ref=e103]: "1"
                    - 'button "A1: not fired at" [disabled] [ref=e104]'
                    - 'button "B1: not fired at" [disabled] [ref=e105]'
                    - 'button "C1: not fired at" [disabled] [ref=e106]'
                    - 'button "D1: not fired at" [disabled] [ref=e107]'
                    - 'button "E1: not fired at" [disabled] [ref=e108]'
                    - 'button "F1: not fired at" [disabled] [ref=e109]'
                    - 'button "G1: not fired at" [disabled] [ref=e110]'
                    - 'button "H1: not fired at" [disabled] [ref=e111]'
                    - 'button "I1: not fired at" [disabled] [ref=e112]'
                    - 'button "J1: not fired at" [disabled] [ref=e113]'
                    - generic [ref=e114]: "2"
                    - 'button "A2: not fired at" [disabled] [ref=e115]'
                    - 'button "B2: not fired at" [disabled] [ref=e116]'
                    - 'button "C2: not fired at" [disabled] [ref=e117]'
                    - 'button "D2: not fired at" [disabled] [ref=e118]'
                    - 'button "E2: not fired at" [disabled] [ref=e119]'
                    - 'button "F2: hit, sunk Carrier" [disabled] [ref=e120]':
                      - generic: ✖
                    - 'button "G2: hit, sunk Carrier" [disabled] [ref=e121]':
                      - generic: ✖
                    - 'button "H2: hit, sunk Carrier" [disabled] [ref=e122]':
                      - generic: ✖
                    - 'button "I2: hit, sunk Carrier" [disabled] [ref=e123]':
                      - generic: ✖
                    - 'button "J2: hit, sunk Carrier" [disabled] [ref=e124]':
                      - generic: ✖
                    - generic [ref=e125]: "3"
                    - 'button "A3: not fired at" [disabled] [ref=e126]'
                    - 'button "B3: not fired at" [disabled] [ref=e127]'
                    - 'button "C3: not fired at" [disabled] [ref=e128]'
                    - 'button "D3: not fired at" [disabled] [ref=e129]'
                    - 'button "E3: not fired at" [disabled] [ref=e130]'
                    - 'button "F3: not fired at" [disabled] [ref=e131]'
                    - 'button "G3: not fired at" [disabled] [ref=e132]'
                    - 'button "H3: not fired at" [disabled] [ref=e133]'
                    - 'button "I3: not fired at" [disabled] [ref=e134]'
                    - 'button "J3: not fired at" [disabled] [ref=e135]'
                    - generic [ref=e136]: "4"
                    - 'button "A4: not fired at" [disabled] [ref=e137]'
                    - 'button "B4: not fired at" [disabled] [ref=e138]'
                    - 'button "C4: not fired at" [disabled] [ref=e139]'
                    - 'button "D4: not fired at" [disabled] [ref=e140]'
                    - 'button "E4: not fired at" [disabled] [ref=e141]'
                    - 'button "F4: hit, sunk Battleship" [disabled] [ref=e142]':
                      - generic: ✖
                    - 'button "G4: hit, sunk Battleship" [disabled] [ref=e143]':
                      - generic: ✖
                    - 'button "H4: hit, sunk Battleship" [disabled] [ref=e144]':
                      - generic: ✖
                    - 'button "I4: hit, sunk Battleship" [disabled] [ref=e145]':
                      - generic: ✖
                    - 'button "J4: not fired at" [disabled] [ref=e146]'
                    - generic [ref=e147]: "5"
                    - 'button "A5: not fired at" [disabled] [ref=e148]'
                    - 'button "B5: not fired at" [disabled] [ref=e149]'
                    - 'button "C5: not fired at" [disabled] [ref=e150]'
                    - 'button "D5: not fired at" [disabled] [ref=e151]'
                    - 'button "E5: not fired at" [disabled] [ref=e152]'
                    - 'button "F5: not fired at" [disabled] [ref=e153]'
                    - 'button "G5: not fired at" [disabled] [ref=e154]'
                    - 'button "H5: not fired at" [disabled] [ref=e155]'
                    - 'button "I5: not fired at" [disabled] [ref=e156]'
                    - 'button "J5: not fired at" [disabled] [ref=e157]'
                    - generic [ref=e158]: "6"
                    - 'button "A6: not fired at" [disabled] [ref=e159]'
                    - 'button "B6: not fired at" [disabled] [ref=e160]'
                    - 'button "C6: not fired at" [disabled] [ref=e161]'
                    - 'button "D6: not fired at" [disabled] [ref=e162]'
                    - 'button "E6: not fired at" [disabled] [ref=e163]'
                    - 'button "F6: hit, sunk Cruiser" [disabled] [ref=e164]':
                      - generic: ✖
                    - 'button "G6: hit, sunk Cruiser" [disabled] [ref=e165]':
                      - generic: ✖
                    - 'button "H6: hit, sunk Cruiser" [disabled] [ref=e166]':
                      - generic: ✖
                    - 'button "I6: not fired at" [disabled] [ref=e167]'
                    - 'button "J6: not fired at" [disabled] [ref=e168]'
                    - generic [ref=e169]: "7"
                    - 'button "A7: not fired at" [disabled] [ref=e170]'
                    - 'button "B7: not fired at" [disabled] [ref=e171]'
                    - 'button "C7: not fired at" [disabled] [ref=e172]'
                    - 'button "D7: not fired at" [disabled] [ref=e173]'
                    - 'button "E7: not fired at" [disabled] [ref=e174]'
                    - 'button "F7: not fired at" [disabled] [ref=e175]'
                    - 'button "G7: not fired at" [disabled] [ref=e176]'
                    - 'button "H7: not fired at" [disabled] [ref=e177]'
                    - 'button "I7: not fired at" [disabled] [ref=e178]'
                    - 'button "J7: not fired at" [disabled] [ref=e179]'
                    - generic [ref=e180]: "8"
                    - 'button "A8: not fired at" [disabled] [ref=e181]'
                    - 'button "B8: not fired at" [disabled] [ref=e182]'
                    - 'button "C8: not fired at" [disabled] [ref=e183]'
                    - 'button "D8: not fired at" [disabled] [ref=e184]'
                    - 'button "E8: not fired at" [disabled] [ref=e185]'
                    - 'button "F8: hit, sunk Submarine" [disabled] [ref=e186]':
                      - generic: ✖
                    - 'button "G8: hit, sunk Submarine" [disabled] [ref=e187]':
                      - generic: ✖
                    - 'button "H8: hit, sunk Submarine" [disabled] [ref=e188]':
                      - generic: ✖
                    - 'button "I8: not fired at" [disabled] [ref=e189]'
                    - 'button "J8: not fired at" [disabled] [ref=e190]'
                    - generic [ref=e191]: "9"
                    - 'button "A9: not fired at" [disabled] [ref=e192]'
                    - 'button "B9: not fired at" [disabled] [ref=e193]'
                    - 'button "C9: not fired at" [disabled] [ref=e194]'
                    - 'button "D9: not fired at" [disabled] [ref=e195]'
                    - 'button "E9: not fired at" [disabled] [ref=e196]'
                    - 'button "F9: not fired at" [disabled] [ref=e197]'
                    - 'button "G9: not fired at" [disabled] [ref=e198]'
                    - 'button "H9: not fired at" [disabled] [ref=e199]'
                    - 'button "I9: not fired at" [disabled] [ref=e200]'
                    - 'button "J9: not fired at" [disabled] [ref=e201]'
                    - generic [ref=e202]: "10"
                    - 'button "A10: not fired at" [disabled] [ref=e203]'
                    - 'button "B10: not fired at" [disabled] [ref=e204]'
                    - 'button "C10: not fired at" [disabled] [ref=e205]'
                    - 'button "D10: not fired at" [disabled] [ref=e206]'
                    - 'button "E10: not fired at" [disabled] [ref=e207]'
                    - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e208]':
                      - generic: ✖
                    - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [ref=e209]':
                      - generic: ✖
                    - 'button "H10: not fired at" [disabled] [ref=e210]'
                    - 'button "I10: not fired at" [disabled] [ref=e211]'
                    - 'button "J10: not fired at" [disabled] [ref=e212]'
                  - button "Larger targets" [ref=e214] [cursor=pointer]:
                    - paragraph [ref=e217]: Larger targets
            - list "Key" [ref=e218]:
              - listitem [ref=e219]:
                - generic [ref=e220]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e221]:
                - generic [ref=e222]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e223]:
                - generic [ref=e224]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e225]:
                - generic [ref=e226]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e228]:
            - generic [ref=e229]:
              - generic [ref=e230]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Sank the whole fleet.
          - generic [ref=e238]:
            - img "Blue fleet" [ref=e239]
            - generic "avery" [ref=e242]
        - generic [ref=e243]:
          - list "Standings" [ref=e245]:
            - listitem [ref=e246]:
              - generic [ref=e247]:
                - generic [ref=e248]: 1st
                - generic [ref=e251]: avery
            - listitem [ref=e252]:
              - generic [ref=e253]:
                - generic [ref=e254]: 2nd
                - generic [ref=e257]: jordan_plays
          - button "History and stats" [ref=e260] [cursor=pointer]:
            - generic [ref=e262]:
              - paragraph [ref=e263]: History and stats
              - img [ref=e266]
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