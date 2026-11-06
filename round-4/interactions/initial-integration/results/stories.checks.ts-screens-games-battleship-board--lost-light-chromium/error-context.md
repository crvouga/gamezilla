# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--lost light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  48937 pixels (ratio 0.15 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/lost-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/lost-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 48937 pixels (ratio 0.15 of all image pixels) are different.
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
  - 48937 pixels (ratio 0.15 of all image pixels) are different.

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
      - generic [ref=e24]:
        - paragraph [ref=e27]: Live
        - list "Moves played" [ref=e32]:
          - listitem [ref=e33]:
            - generic [ref=e34]: Move 17
            - 'button "Move 33, Blue fleet: G10 sinks the destroyer" [ref=e37] [cursor=pointer]': G10 sinks the destroyer
        - button "All moves" [ref=e38] [cursor=pointer]:
          - img [ref=e42]
      - generic [ref=e44]:
        - generic [ref=e46]:
          - generic [ref=e53]:
            - img "Blue fleet" [ref=e54]
            - generic [ref=e55]: avery
          - generic [ref=e57]:
            - paragraph [ref=e58]: Red fleet destroyed — all five ships sunk.
            - generic [ref=e60]:
              - radiogroup "Boards" [ref=e62]:
                - radio "Your fleet" [checked] [ref=e63] [cursor=pointer]:
                  - generic [ref=e64]: Your fleet
                - radio "Targeting" [ref=e65] [cursor=pointer]:
                  - generic [ref=e66]: Targeting
              - region "Your fleet" [ref=e67]:
                - group "Your fleet" [ref=e68]:
                  - generic [ref=e70]: A
                  - generic [ref=e71]: B
                  - generic [ref=e72]: C
                  - generic [ref=e73]: D
                  - generic [ref=e74]: E
                  - generic [ref=e75]: F
                  - generic [ref=e76]: G
                  - generic [ref=e77]: H
                  - generic [ref=e78]: I
                  - generic [ref=e79]: J
                  - generic [ref=e80]: "1"
                  - 'button "A1: open water" [disabled] [ref=e81]'
                  - 'button "B1: open water" [disabled] [ref=e82]'
                  - 'button "C1: open water" [disabled] [ref=e83]'
                  - 'button "D1: open water" [disabled] [ref=e84]'
                  - 'button "E1: open water" [disabled] [ref=e85]'
                  - 'button "F1: open water" [disabled] [ref=e86]'
                  - 'button "G1: open water" [disabled] [ref=e87]'
                  - 'button "H1: open water" [disabled] [ref=e88]'
                  - 'button "I1: open water" [disabled] [ref=e89]'
                  - 'button "J1: open water" [disabled] [ref=e90]'
                  - generic [ref=e91]: "2"
                  - 'button "A2: open water" [disabled] [ref=e92]'
                  - 'button "B2: open water" [disabled] [ref=e93]'
                  - 'button "C2: open water" [disabled] [ref=e94]'
                  - 'button "D2: open water" [disabled] [ref=e95]'
                  - 'button "E2: open water" [disabled] [ref=e96]'
                  - 'button "F2: your Carrier, sunk" [disabled] [ref=e97]':
                    - generic: ✖
                  - 'button "G2: your Carrier, sunk" [disabled] [ref=e98]':
                    - generic: ✖
                  - 'button "H2: your Carrier, sunk" [disabled] [ref=e99]':
                    - generic: ✖
                  - 'button "I2: your Carrier, sunk" [disabled] [ref=e100]':
                    - generic: ✖
                  - 'button "J2: your Carrier, sunk" [disabled] [ref=e101]':
                    - generic: ✖
                  - generic [ref=e102]: "3"
                  - 'button "A3: open water" [disabled] [ref=e103]'
                  - 'button "B3: open water" [disabled] [ref=e104]'
                  - 'button "C3: open water" [disabled] [ref=e105]'
                  - 'button "D3: open water" [disabled] [ref=e106]'
                  - 'button "E3: open water" [disabled] [ref=e107]'
                  - 'button "F3: open water" [disabled] [ref=e108]'
                  - 'button "G3: open water" [disabled] [ref=e109]'
                  - 'button "H3: open water" [disabled] [ref=e110]'
                  - 'button "I3: open water" [disabled] [ref=e111]'
                  - 'button "J3: open water" [disabled] [ref=e112]'
                  - generic [ref=e113]: "4"
                  - 'button "A4: open water" [disabled] [ref=e114]'
                  - 'button "B4: open water" [disabled] [ref=e115]'
                  - 'button "C4: open water" [disabled] [ref=e116]'
                  - 'button "D4: open water" [disabled] [ref=e117]'
                  - 'button "E4: open water" [disabled] [ref=e118]'
                  - 'button "F4: your Battleship, sunk" [disabled] [ref=e119]':
                    - generic: ✖
                  - 'button "G4: your Battleship, sunk" [disabled] [ref=e120]':
                    - generic: ✖
                  - 'button "H4: your Battleship, sunk" [disabled] [ref=e121]':
                    - generic: ✖
                  - 'button "I4: your Battleship, sunk" [disabled] [ref=e122]':
                    - generic: ✖
                  - 'button "J4: open water" [disabled] [ref=e123]'
                  - generic [ref=e124]: "5"
                  - 'button "A5: open water" [disabled] [ref=e125]'
                  - 'button "B5: open water" [disabled] [ref=e126]'
                  - 'button "C5: open water" [disabled] [ref=e127]'
                  - 'button "D5: open water" [disabled] [ref=e128]'
                  - 'button "E5: open water" [disabled] [ref=e129]'
                  - 'button "F5: open water" [disabled] [ref=e130]'
                  - 'button "G5: open water" [disabled] [ref=e131]'
                  - 'button "H5: open water" [disabled] [ref=e132]'
                  - 'button "I5: open water" [disabled] [ref=e133]'
                  - 'button "J5: open water" [disabled] [ref=e134]'
                  - generic [ref=e135]: "6"
                  - 'button "A6: open water" [disabled] [ref=e136]'
                  - 'button "B6: open water" [disabled] [ref=e137]'
                  - 'button "C6: open water" [disabled] [ref=e138]'
                  - 'button "D6: open water" [disabled] [ref=e139]'
                  - 'button "E6: open water" [disabled] [ref=e140]'
                  - 'button "F6: your Cruiser, sunk" [disabled] [ref=e141]':
                    - generic: ✖
                  - 'button "G6: your Cruiser, sunk" [disabled] [ref=e142]':
                    - generic: ✖
                  - 'button "H6: your Cruiser, sunk" [disabled] [ref=e143]':
                    - generic: ✖
                  - 'button "I6: open water" [disabled] [ref=e144]'
                  - 'button "J6: open water" [disabled] [ref=e145]'
                  - generic [ref=e146]: "7"
                  - 'button "A7: open water" [disabled] [ref=e147]'
                  - 'button "B7: open water" [disabled] [ref=e148]'
                  - 'button "C7: open water" [disabled] [ref=e149]'
                  - 'button "D7: open water" [disabled] [ref=e150]'
                  - 'button "E7: open water" [disabled] [ref=e151]'
                  - 'button "F7: open water" [disabled] [ref=e152]'
                  - 'button "G7: open water" [disabled] [ref=e153]'
                  - 'button "H7: open water" [disabled] [ref=e154]'
                  - 'button "I7: open water" [disabled] [ref=e155]'
                  - 'button "J7: open water" [disabled] [ref=e156]'
                  - generic [ref=e157]: "8"
                  - 'button "A8: open water" [disabled] [ref=e158]'
                  - 'button "B8: open water" [disabled] [ref=e159]'
                  - 'button "C8: open water" [disabled] [ref=e160]'
                  - 'button "D8: open water" [disabled] [ref=e161]'
                  - 'button "E8: open water" [disabled] [ref=e162]'
                  - 'button "F8: your Submarine, sunk" [disabled] [ref=e163]':
                    - generic: ✖
                  - 'button "G8: your Submarine, sunk" [disabled] [ref=e164]':
                    - generic: ✖
                  - 'button "H8: your Submarine, sunk" [disabled] [ref=e165]':
                    - generic: ✖
                  - 'button "I8: open water" [disabled] [ref=e166]'
                  - 'button "J8: open water" [disabled] [ref=e167]'
                  - generic [ref=e168]: "9"
                  - 'button "A9: open water" [disabled] [ref=e169]'
                  - 'button "B9: open water" [disabled] [ref=e170]'
                  - 'button "C9: open water" [disabled] [ref=e171]'
                  - 'button "D9: open water" [disabled] [ref=e172]'
                  - 'button "E9: open water" [disabled] [ref=e173]'
                  - 'button "F9: open water" [disabled] [ref=e174]'
                  - 'button "G9: open water" [disabled] [ref=e175]'
                  - 'button "H9: open water" [disabled] [ref=e176]'
                  - 'button "I9: open water" [disabled] [ref=e177]'
                  - 'button "J9: open water" [disabled] [ref=e178]'
                  - generic [ref=e179]: "10"
                  - 'button "A10: open water" [disabled] [ref=e180]'
                  - 'button "B10: open water" [disabled] [ref=e181]'
                  - 'button "C10: open water" [disabled] [ref=e182]'
                  - 'button "D10: open water" [disabled] [ref=e183]'
                  - 'button "E10: open water" [disabled] [ref=e184]'
                  - 'button "F10: your Destroyer, sunk" [disabled] [ref=e185]':
                    - generic: ✖
                  - 'button "G10: your Destroyer, sunk, latest shot" [disabled] [ref=e186]':
                    - generic: ✖
                  - 'button "H10: open water" [disabled] [ref=e187]'
                  - 'button "I10: open water" [disabled] [ref=e188]'
                  - 'button "J10: open water" [disabled] [ref=e189]'
            - list "Key" [ref=e190]:
              - listitem [ref=e191]:
                - generic [ref=e192]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e193]:
                - generic [ref=e194]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e195]:
                - generic [ref=e196]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e197]:
                - generic [ref=e198]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e202]:
            - generic [ref=e203]:
              - generic [ref=e204]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Sank the whole fleet.
          - generic [ref=e211]:
            - generic [ref=e212]:
              - img "Red fleet" [ref=e213]
              - generic [ref=e214]: jordan_plays
            - generic [ref=e217]: 5 ships sunk
        - generic [ref=e218]:
          - generic [ref=e219]:
            - heading "avery wins" [level=2] [ref=e221]
            - list "Standings" [ref=e222]:
              - listitem [ref=e223]:
                - generic [ref=e224]:
                  - generic [ref=e225]: 1st
                  - generic [ref=e228]: avery
              - listitem [ref=e229]:
                - generic [ref=e230]:
                  - generic [ref=e231]: 2nd
                  - generic [ref=e234]: jordan_plays
          - generic [ref=e236]:
            - group "What next" [ref=e237]:
              - button "Rematch" [ref=e238] [cursor=pointer]:
                - paragraph [ref=e241]: Rematch
              - button "Change game" [ref=e242] [cursor=pointer]:
                - paragraph [ref=e245]: Change game
              - button "Review" [ref=e246] [cursor=pointer]:
                - paragraph [ref=e249]: Review
            - button "History and stats" [ref=e250] [cursor=pointer]:
              - generic [ref=e252]:
                - paragraph [ref=e253]: History and stats
                - img [ref=e256]
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