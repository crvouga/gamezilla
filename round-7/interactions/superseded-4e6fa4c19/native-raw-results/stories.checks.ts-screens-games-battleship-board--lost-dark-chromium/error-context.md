# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--lost dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  56391 pixels (ratio 0.18 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/lost-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/lost-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 56391 pixels (ratio 0.18 of all image pixels) are different.
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
  - 56391 pixels (ratio 0.18 of all image pixels) are different.

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
        - heading "avery wins" [level=2] [ref=e25]
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
          - generic [ref=e70]:
            - img "Blue fleet" [ref=e71]
            - generic "avery" [ref=e74]
          - generic [ref=e76]:
            - paragraph [ref=e77]: Red fleet destroyed — all five ships sunk.
            - generic [ref=e79]:
              - radiogroup "Boards" [ref=e81]:
                - radio "Your fleet" [checked] [ref=e82] [cursor=pointer]:
                  - generic [ref=e83]: Your fleet
                - radio "Targeting" [ref=e84] [cursor=pointer]:
                  - generic [ref=e85]: Targeting
              - region "Your fleet" [ref=e86]:
                - group "Your fleet" [ref=e87]:
                  - generic [ref=e89]: A
                  - generic [ref=e90]: B
                  - generic [ref=e91]: C
                  - generic [ref=e92]: D
                  - generic [ref=e93]: E
                  - generic [ref=e94]: F
                  - generic [ref=e95]: G
                  - generic [ref=e96]: H
                  - generic [ref=e97]: I
                  - generic [ref=e98]: J
                  - generic [ref=e99]: "1"
                  - 'button "A1: open water" [disabled] [ref=e100]'
                  - 'button "B1: open water" [disabled] [ref=e101]'
                  - 'button "C1: open water" [disabled] [ref=e102]'
                  - 'button "D1: open water" [disabled] [ref=e103]'
                  - 'button "E1: open water" [disabled] [ref=e104]'
                  - 'button "F1: open water" [disabled] [ref=e105]'
                  - 'button "G1: open water" [disabled] [ref=e106]'
                  - 'button "H1: open water" [disabled] [ref=e107]'
                  - 'button "I1: open water" [disabled] [ref=e108]'
                  - 'button "J1: open water" [disabled] [ref=e109]'
                  - generic [ref=e110]: "2"
                  - 'button "A2: open water" [disabled] [ref=e111]'
                  - 'button "B2: open water" [disabled] [ref=e112]'
                  - 'button "C2: open water" [disabled] [ref=e113]'
                  - 'button "D2: open water" [disabled] [ref=e114]'
                  - 'button "E2: open water" [disabled] [ref=e115]'
                  - 'button "F2: your Carrier, sunk" [disabled] [ref=e116]':
                    - generic: ✖
                  - 'button "G2: your Carrier, sunk" [disabled] [ref=e117]':
                    - generic: ✖
                  - 'button "H2: your Carrier, sunk" [disabled] [ref=e118]':
                    - generic: ✖
                  - 'button "I2: your Carrier, sunk" [disabled] [ref=e119]':
                    - generic: ✖
                  - 'button "J2: your Carrier, sunk" [disabled] [ref=e120]':
                    - generic: ✖
                  - generic [ref=e121]: "3"
                  - 'button "A3: open water" [disabled] [ref=e122]'
                  - 'button "B3: open water" [disabled] [ref=e123]'
                  - 'button "C3: open water" [disabled] [ref=e124]'
                  - 'button "D3: open water" [disabled] [ref=e125]'
                  - 'button "E3: open water" [disabled] [ref=e126]'
                  - 'button "F3: open water" [disabled] [ref=e127]'
                  - 'button "G3: open water" [disabled] [ref=e128]'
                  - 'button "H3: open water" [disabled] [ref=e129]'
                  - 'button "I3: open water" [disabled] [ref=e130]'
                  - 'button "J3: open water" [disabled] [ref=e131]'
                  - generic [ref=e132]: "4"
                  - 'button "A4: open water" [disabled] [ref=e133]'
                  - 'button "B4: open water" [disabled] [ref=e134]'
                  - 'button "C4: open water" [disabled] [ref=e135]'
                  - 'button "D4: open water" [disabled] [ref=e136]'
                  - 'button "E4: open water" [disabled] [ref=e137]'
                  - 'button "F4: your Battleship, sunk" [disabled] [ref=e138]':
                    - generic: ✖
                  - 'button "G4: your Battleship, sunk" [disabled] [ref=e139]':
                    - generic: ✖
                  - 'button "H4: your Battleship, sunk" [disabled] [ref=e140]':
                    - generic: ✖
                  - 'button "I4: your Battleship, sunk" [disabled] [ref=e141]':
                    - generic: ✖
                  - 'button "J4: open water" [disabled] [ref=e142]'
                  - generic [ref=e143]: "5"
                  - 'button "A5: open water" [disabled] [ref=e144]'
                  - 'button "B5: open water" [disabled] [ref=e145]'
                  - 'button "C5: open water" [disabled] [ref=e146]'
                  - 'button "D5: open water" [disabled] [ref=e147]'
                  - 'button "E5: open water" [disabled] [ref=e148]'
                  - 'button "F5: open water" [disabled] [ref=e149]'
                  - 'button "G5: open water" [disabled] [ref=e150]'
                  - 'button "H5: open water" [disabled] [ref=e151]'
                  - 'button "I5: open water" [disabled] [ref=e152]'
                  - 'button "J5: open water" [disabled] [ref=e153]'
                  - generic [ref=e154]: "6"
                  - 'button "A6: open water" [disabled] [ref=e155]'
                  - 'button "B6: open water" [disabled] [ref=e156]'
                  - 'button "C6: open water" [disabled] [ref=e157]'
                  - 'button "D6: open water" [disabled] [ref=e158]'
                  - 'button "E6: open water" [disabled] [ref=e159]'
                  - 'button "F6: your Cruiser, sunk" [disabled] [ref=e160]':
                    - generic: ✖
                  - 'button "G6: your Cruiser, sunk" [disabled] [ref=e161]':
                    - generic: ✖
                  - 'button "H6: your Cruiser, sunk" [disabled] [ref=e162]':
                    - generic: ✖
                  - 'button "I6: open water" [disabled] [ref=e163]'
                  - 'button "J6: open water" [disabled] [ref=e164]'
                  - generic [ref=e165]: "7"
                  - 'button "A7: open water" [disabled] [ref=e166]'
                  - 'button "B7: open water" [disabled] [ref=e167]'
                  - 'button "C7: open water" [disabled] [ref=e168]'
                  - 'button "D7: open water" [disabled] [ref=e169]'
                  - 'button "E7: open water" [disabled] [ref=e170]'
                  - 'button "F7: open water" [disabled] [ref=e171]'
                  - 'button "G7: open water" [disabled] [ref=e172]'
                  - 'button "H7: open water" [disabled] [ref=e173]'
                  - 'button "I7: open water" [disabled] [ref=e174]'
                  - 'button "J7: open water" [disabled] [ref=e175]'
                  - generic [ref=e176]: "8"
                  - 'button "A8: open water" [disabled] [ref=e177]'
                  - 'button "B8: open water" [disabled] [ref=e178]'
                  - 'button "C8: open water" [disabled] [ref=e179]'
                  - 'button "D8: open water" [disabled] [ref=e180]'
                  - 'button "E8: open water" [disabled] [ref=e181]'
                  - 'button "F8: your Submarine, sunk" [disabled] [ref=e182]':
                    - generic: ✖
                  - 'button "G8: your Submarine, sunk" [disabled] [ref=e183]':
                    - generic: ✖
                  - 'button "H8: your Submarine, sunk" [disabled] [ref=e184]':
                    - generic: ✖
                  - 'button "I8: open water" [disabled] [ref=e185]'
                  - 'button "J8: open water" [disabled] [ref=e186]'
                  - generic [ref=e187]: "9"
                  - 'button "A9: open water" [disabled] [ref=e188]'
                  - 'button "B9: open water" [disabled] [ref=e189]'
                  - 'button "C9: open water" [disabled] [ref=e190]'
                  - 'button "D9: open water" [disabled] [ref=e191]'
                  - 'button "E9: open water" [disabled] [ref=e192]'
                  - 'button "F9: open water" [disabled] [ref=e193]'
                  - 'button "G9: open water" [disabled] [ref=e194]'
                  - 'button "H9: open water" [disabled] [ref=e195]'
                  - 'button "I9: open water" [disabled] [ref=e196]'
                  - 'button "J9: open water" [disabled] [ref=e197]'
                  - generic [ref=e198]: "10"
                  - 'button "A10: open water" [disabled] [ref=e199]'
                  - 'button "B10: open water" [disabled] [ref=e200]'
                  - 'button "C10: open water" [disabled] [ref=e201]'
                  - 'button "D10: open water" [disabled] [ref=e202]'
                  - 'button "E10: open water" [disabled] [ref=e203]'
                  - 'button "F10: your Destroyer, sunk" [disabled] [ref=e204]':
                    - generic: ✖
                  - 'button "G10: your Destroyer, sunk, latest shot" [disabled] [ref=e205]':
                    - generic: ✖
                  - 'button "H10: open water" [disabled] [ref=e206]'
                  - 'button "I10: open water" [disabled] [ref=e207]'
                  - 'button "J10: open water" [disabled] [ref=e208]'
            - list "Key" [ref=e209]:
              - listitem [ref=e210]:
                - generic [ref=e211]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e212]:
                - generic [ref=e213]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e214]:
                - generic [ref=e215]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e216]:
                - generic [ref=e217]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e219]:
            - generic [ref=e220]:
              - generic [ref=e221]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Sank the whole fleet.
          - generic [ref=e228]:
            - generic [ref=e229]:
              - img "Red fleet" [ref=e230]
              - generic "jordan_plays" [ref=e233]
            - generic [ref=e236]: 5 ships sunk
        - generic [ref=e237]:
          - list "Standings" [ref=e239]:
            - listitem [ref=e240]:
              - generic [ref=e241]:
                - generic [ref=e242]: 1st
                - generic [ref=e245]: avery
            - listitem [ref=e246]:
              - generic [ref=e247]:
                - generic [ref=e248]: 2nd
                - generic [ref=e251]: jordan_plays
          - button "History and stats" [ref=e254] [cursor=pointer]:
            - generic [ref=e256]:
              - paragraph [ref=e257]: History and stats
              - img [ref=e260]
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