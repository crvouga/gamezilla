# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--sink-a-ship light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  95846 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/sink-a-ship-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/sink-a-ship-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 95846 pixels (ratio 0.08 of all image pixels) are different.
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
  - 95846 pixels (ratio 0.08 of all image pixels) are different.

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
            - generic [ref=e39]: To move
          - generic [ref=e42]: Destroyer sunk
        - generic [ref=e44]:
          - generic [ref=e46]:
            - radiogroup "Boards" [ref=e48]:
              - radio "Your fleet" [ref=e49] [cursor=pointer]:
                - generic [ref=e50]: Your fleet
              - radio "Targeting" [checked] [ref=e51] [cursor=pointer]:
                - generic [ref=e52]: Targeting
            - region "Targeting" [ref=e53]:
              - generic [ref=e55]:
                - generic [ref=e56]:
                  - group "Targeting" [ref=e58]:
                    - generic [ref=e60]: A
                    - generic [ref=e61]: B
                    - generic [ref=e62]: C
                    - generic [ref=e63]: D
                    - generic [ref=e64]: E
                    - generic [ref=e65]: F
                    - generic [ref=e66]: G
                    - generic [ref=e67]: H
                    - generic [ref=e68]: I
                    - generic [ref=e69]: J
                    - generic [ref=e70]: "1"
                    - 'button "A1: not fired at" [disabled] [ref=e71]'
                    - 'button "B1: not fired at" [disabled] [ref=e72]'
                    - 'button "C1: not fired at" [disabled] [ref=e73]'
                    - 'button "D1: not fired at" [disabled] [ref=e74]'
                    - 'button "E1: not fired at" [disabled] [ref=e75]'
                    - 'button "F1: not fired at" [disabled] [ref=e76]'
                    - 'button "G1: not fired at" [disabled] [ref=e77]'
                    - 'button "H1: not fired at" [disabled] [ref=e78]'
                    - 'button "I1: not fired at" [disabled] [ref=e79]'
                    - 'button "J1: not fired at" [disabled] [ref=e80]'
                    - generic [ref=e81]: "2"
                    - 'button "A2: not fired at" [disabled] [ref=e82]'
                    - 'button "B2: not fired at" [disabled] [ref=e83]'
                    - 'button "C2: not fired at" [disabled] [ref=e84]'
                    - 'button "D2: not fired at" [disabled] [ref=e85]'
                    - 'button "E2: not fired at" [disabled] [ref=e86]'
                    - 'button "F2: not fired at" [disabled] [ref=e87]'
                    - 'button "G2: not fired at" [disabled] [ref=e88]'
                    - 'button "H2: not fired at" [disabled] [ref=e89]'
                    - 'button "I2: not fired at" [disabled] [ref=e90]'
                    - 'button "J2: not fired at" [disabled] [ref=e91]'
                    - generic [ref=e92]: "3"
                    - 'button "A3: not fired at" [disabled] [ref=e93]'
                    - 'button "B3: not fired at" [disabled] [ref=e94]'
                    - 'button "C3: not fired at" [disabled] [ref=e95]'
                    - 'button "D3: not fired at" [disabled] [ref=e96]'
                    - 'button "E3: not fired at" [disabled] [ref=e97]'
                    - 'button "F3: not fired at" [disabled] [ref=e98]'
                    - 'button "G3: not fired at" [disabled] [ref=e99]'
                    - 'button "H3: not fired at" [disabled] [ref=e100]'
                    - 'button "I3: not fired at" [disabled] [ref=e101]'
                    - 'button "J3: not fired at" [disabled] [ref=e102]'
                    - generic [ref=e103]: "4"
                    - 'button "A4: not fired at" [disabled] [ref=e104]'
                    - 'button "B4: not fired at" [disabled] [ref=e105]'
                    - 'button "C4: not fired at" [disabled] [ref=e106]'
                    - 'button "D4: not fired at" [disabled] [ref=e107]'
                    - 'button "E4: not fired at" [disabled] [ref=e108]'
                    - 'button "F4: not fired at" [disabled] [ref=e109]'
                    - 'button "G4: not fired at" [disabled] [ref=e110]'
                    - 'button "H4: not fired at" [disabled] [ref=e111]'
                    - 'button "I4: not fired at" [disabled] [ref=e112]'
                    - 'button "J4: not fired at" [disabled] [ref=e113]'
                    - generic [ref=e114]: "5"
                    - 'button "A5: not fired at" [disabled] [ref=e115]'
                    - 'button "B5: not fired at" [disabled] [ref=e116]'
                    - 'button "C5: not fired at" [disabled] [ref=e117]'
                    - 'button "D5: not fired at" [disabled] [ref=e118]'
                    - 'button "E5: not fired at" [disabled] [ref=e119]'
                    - 'button "F5: not fired at" [disabled] [ref=e120]'
                    - 'button "G5: not fired at" [disabled] [ref=e121]'
                    - 'button "H5: not fired at" [disabled] [ref=e122]'
                    - 'button "I5: not fired at" [disabled] [ref=e123]'
                    - 'button "J5: not fired at" [disabled] [ref=e124]'
                    - generic [ref=e125]: "6"
                    - 'button "A6: not fired at" [disabled] [ref=e126]'
                    - 'button "B6: not fired at" [disabled] [ref=e127]'
                    - 'button "C6: not fired at" [disabled] [ref=e128]'
                    - 'button "D6: not fired at" [disabled] [ref=e129]'
                    - 'button "E6: not fired at" [disabled] [ref=e130]'
                    - 'button "F6: not fired at" [disabled] [ref=e131]'
                    - 'button "G6: not fired at" [disabled] [ref=e132]'
                    - 'button "H6: not fired at" [disabled] [ref=e133]'
                    - 'button "I6: not fired at" [disabled] [ref=e134]'
                    - 'button "J6: not fired at" [disabled] [ref=e135]'
                    - generic [ref=e136]: "7"
                    - 'button "A7: not fired at" [disabled] [ref=e137]'
                    - 'button "B7: not fired at" [disabled] [ref=e138]'
                    - 'button "C7: not fired at" [disabled] [ref=e139]'
                    - 'button "D7: not fired at" [disabled] [ref=e140]'
                    - 'button "E7: not fired at" [disabled] [ref=e141]'
                    - 'button "F7: not fired at" [disabled] [ref=e142]'
                    - 'button "G7: not fired at" [disabled] [ref=e143]'
                    - 'button "H7: not fired at" [disabled] [ref=e144]'
                    - 'button "I7: not fired at" [disabled] [ref=e145]'
                    - 'button "J7: not fired at" [disabled] [ref=e146]'
                    - generic [ref=e147]: "8"
                    - 'button "A8: not fired at" [disabled] [ref=e148]'
                    - 'button "B8: not fired at" [disabled] [ref=e149]'
                    - 'button "C8: not fired at" [disabled] [ref=e150]'
                    - 'button "D8: not fired at" [disabled] [ref=e151]'
                    - 'button "E8: not fired at" [disabled] [ref=e152]'
                    - 'button "F8: not fired at" [disabled] [ref=e153]'
                    - 'button "G8: not fired at" [disabled] [ref=e154]'
                    - 'button "H8: not fired at" [disabled] [ref=e155]'
                    - 'button "I8: not fired at" [disabled] [ref=e156]'
                    - 'button "J8: not fired at" [disabled] [ref=e157]'
                    - generic [ref=e158]: "9"
                    - 'button "A9: not fired at" [disabled] [ref=e159]'
                    - 'button "B9: not fired at" [disabled] [ref=e160]'
                    - 'button "C9: not fired at" [disabled] [ref=e161]'
                    - 'button "D9: not fired at" [disabled] [ref=e162]'
                    - 'button "E9: not fired at" [disabled] [ref=e163]'
                    - 'button "F9: not fired at" [disabled] [ref=e164]'
                    - 'button "G9: not fired at" [disabled] [ref=e165]'
                    - 'button "H9: not fired at" [disabled] [ref=e166]'
                    - 'button "I9: not fired at" [disabled] [ref=e167]'
                    - 'button "J9: not fired at" [disabled] [ref=e168]'
                    - generic [ref=e169]: "10"
                    - 'button "A10: not fired at" [disabled] [ref=e170]'
                    - 'button "B10: not fired at" [disabled] [ref=e171]'
                    - 'button "C10: not fired at" [disabled] [ref=e172]'
                    - 'button "D10: not fired at" [disabled] [ref=e173]'
                    - 'button "E10: not fired at" [disabled] [ref=e174]'
                    - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e175]':
                      - generic: ✖
                    - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [active] [ref=e176]':
                      - generic: ✖
                    - 'button "H10: not fired at" [disabled] [ref=e177]'
                    - 'button "I10: not fired at" [disabled] [ref=e178]'
                    - 'button "J10: not fired at" [disabled] [ref=e179]'
                  - generic [ref=e180]:
                    - button "A1–E2" [ref=e181] [cursor=pointer]:
                      - generic [ref=e182]: A1
                      - generic [ref=e183]: E2
                    - button "F1–J2" [ref=e184] [cursor=pointer]:
                      - generic [ref=e185]: F1
                      - generic [ref=e186]: J2
                    - button "A3–E4" [ref=e187] [cursor=pointer]:
                      - generic [ref=e188]: A3
                      - generic [ref=e189]: E4
                    - button "F3–J4" [ref=e190] [cursor=pointer]:
                      - generic [ref=e191]: F3
                      - generic [ref=e192]: J4
                    - button "A5–E6" [ref=e193] [cursor=pointer]:
                      - generic [ref=e194]: A5
                      - generic [ref=e195]: E6
                    - button "F5–J6" [ref=e196] [cursor=pointer]:
                      - generic [ref=e197]: F5
                      - generic [ref=e198]: J6
                    - button "A7–E8" [ref=e199] [cursor=pointer]:
                      - generic [ref=e200]: A7
                      - generic [ref=e201]: E8
                    - button "F7–J8" [ref=e202] [cursor=pointer]:
                      - generic [ref=e203]: F7
                      - generic [ref=e204]: J8
                    - button "A9–E10" [ref=e205] [cursor=pointer]:
                      - generic [ref=e206]: A9
                      - generic [ref=e207]: E10
                    - button "F9–J10" [pressed] [ref=e208] [cursor=pointer]:
                      - generic [ref=e209]: F9
                      - generic [ref=e210]: J10
                - generic [ref=e212]:
                  - paragraph [ref=e213]: "Aim: F9–J10"
                  - button "Map" [ref=e214] [cursor=pointer]:
                    - paragraph [ref=e217]: Map
                - group "Precise aim" [ref=e220]:
                  - generic [ref=e222]: F
                  - generic [ref=e223]: G
                  - generic [ref=e224]: H
                  - generic [ref=e225]: I
                  - generic [ref=e226]: J
                  - generic [ref=e227]: "9"
                  - 'button "F9: not fired at" [disabled] [ref=e228]'
                  - 'button "G9: not fired at" [disabled] [ref=e229]'
                  - 'button "H9: not fired at" [disabled] [ref=e230]'
                  - 'button "I9: not fired at" [disabled] [ref=e231]'
                  - 'button "J9: not fired at" [disabled] [ref=e232]'
                  - generic [ref=e233]: "10"
                  - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e234]':
                    - generic: ✖
                  - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [ref=e235]':
                    - generic: ✖
                  - 'button "H10: not fired at" [disabled] [ref=e236]'
                  - 'button "I10: not fired at" [disabled] [ref=e237]'
                  - 'button "J10: not fired at" [disabled] [ref=e238]'
          - list "Key" [ref=e239]:
            - listitem [ref=e240]:
              - generic [ref=e241]:
                - generic: ■
              - text: Ship
            - listitem [ref=e242]:
              - generic [ref=e243]:
                - generic: ○
              - text: Miss
            - listitem [ref=e244]:
              - generic [ref=e245]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e246]:
              - generic [ref=e247]:
                - generic: ✖
              - text: Sunk
        - status [ref=e249]:
          - generic [ref=e250]:
            - generic [ref=e251]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: You fired at G10 and sank the Destroyer. Red fleet is firing.
        - generic [ref=e259]:
          - img "Blue fleet" [ref=e260]
          - generic "avery" [ref=e263]
      - region "Game record" [ref=e265]:
        - generic [ref=e266]:
          - heading "Game record" [level=2] [ref=e268]
          - paragraph [ref=e269]: You fired at G10 and sank the Destroyer. Red fleet is firing.
        - generic [ref=e270]:
          - list "Moves played" [ref=e272]:
            - listitem [ref=e273]:
              - generic [ref=e274]: "1"
              - 'button "Move 1, Blue fleet: F10 hit" [ref=e277] [cursor=pointer]': F10 hit
              - 'button "Move 2, Red fleet: A2 miss" [ref=e280] [cursor=pointer]': A2 miss
            - listitem [ref=e281]:
              - generic [ref=e282]: "2"
              - 'button "Move 3, Blue fleet: G10 sinks the destroyer" [ref=e285] [cursor=pointer]': G10 sinks the destroyer
          - generic [ref=e286]:
            - generic [ref=e287]:
              - button "Go to the start" [ref=e288] [cursor=pointer]:
                - img [ref=e291]
              - button "Previous move" [ref=e294] [cursor=pointer]:
                - img [ref=e297]
              - button "Next move" [disabled] [ref=e299]:
                - img [ref=e302]
              - button "Return to current position" [ref=e304] [cursor=pointer]:
                - img [ref=e307]
            - button "Go to move" [ref=e310] [cursor=pointer]:
              - generic [ref=e312]:
                - paragraph [ref=e313]: Go to move
                - img [ref=e316]
        - generic [ref=e319]:
          - group "Game actions" [ref=e320]:
            - button "Resign game" [ref=e321] [cursor=pointer]:
              - paragraph [ref=e324]:
                - text: Resign
                - generic [ref=e325]: game
          - button "History and stats" [ref=e326] [cursor=pointer]:
            - paragraph [ref=e329]: History and stats
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