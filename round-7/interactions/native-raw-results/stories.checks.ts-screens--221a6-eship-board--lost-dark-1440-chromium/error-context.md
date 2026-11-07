# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--lost dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  131210 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/lost-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/lost-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 131210 pixels (ratio 0.11 of all image pixels) are different.
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
  - 131210 pixels (ratio 0.11 of all image pixels) are different.

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
        - heading "avery wins" [level=2] [ref=e28]
        - group "What next" [ref=e29]:
          - button "Rematch" [ref=e30] [cursor=pointer]:
            - paragraph [ref=e33]: Rematch
          - button "Change game" [ref=e34] [cursor=pointer]:
            - paragraph [ref=e37]: Change game
          - button "Review" [ref=e38] [cursor=pointer]:
            - paragraph [ref=e41]: Review
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e51]:
            - img "Blue fleet" [ref=e52]
            - generic "avery" [ref=e55]
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
          - status [ref=e200]:
            - generic [ref=e201]:
              - generic [ref=e202]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Sank the whole fleet.
          - generic [ref=e209]:
            - generic [ref=e210]:
              - img "Red fleet" [ref=e211]
              - generic "jordan_plays" [ref=e214]
            - generic [ref=e217]: 5 ships sunk
        - list "Standings" [ref=e220]:
          - listitem [ref=e221]:
            - generic [ref=e222]:
              - generic [ref=e223]: 1st
              - generic [ref=e226]: avery
          - listitem [ref=e227]:
            - generic [ref=e228]:
              - generic [ref=e229]: 2nd
              - generic [ref=e232]: jordan_plays
        - region "Game record" [ref=e234]:
          - heading "Game record" [level=2] [ref=e237]
          - generic [ref=e238]:
            - list "Moves played" [ref=e240]:
              - listitem [ref=e241]:
                - generic [ref=e242]: "1"
                - 'button "Move 1, Blue fleet: F2 hit" [ref=e245] [cursor=pointer]': F2 hit
                - 'button "Move 2, Red fleet: A2 miss" [ref=e248] [cursor=pointer]': A2 miss
              - listitem [ref=e249]:
                - generic [ref=e250]: "2"
                - 'button "Move 3, Blue fleet: G2 hit" [ref=e253] [cursor=pointer]': G2 hit
                - 'button "Move 4, Red fleet: B2 miss" [ref=e256] [cursor=pointer]': B2 miss
              - listitem [ref=e257]:
                - generic [ref=e258]: "3"
                - 'button "Move 5, Blue fleet: H2 hit" [ref=e261] [cursor=pointer]': H2 hit
                - 'button "Move 6, Red fleet: C2 miss" [ref=e264] [cursor=pointer]': C2 miss
              - listitem [ref=e265]:
                - generic [ref=e266]: "4"
                - 'button "Move 7, Blue fleet: I2 hit" [ref=e269] [cursor=pointer]': I2 hit
                - 'button "Move 8, Red fleet: D2 miss" [ref=e272] [cursor=pointer]': D2 miss
              - listitem [ref=e273]:
                - generic [ref=e274]: "5"
                - 'button "Move 9, Blue fleet: J2 sinks the carrier" [ref=e277] [cursor=pointer]': J2 sinks the carrier
                - 'button "Move 10, Red fleet: E2 miss" [ref=e280] [cursor=pointer]': E2 miss
              - listitem [ref=e281]:
                - generic [ref=e282]: "6"
                - 'button "Move 11, Blue fleet: F4 hit" [ref=e285] [cursor=pointer]': F4 hit
                - 'button "Move 12, Red fleet: F2 miss" [ref=e288] [cursor=pointer]': F2 miss
              - listitem [ref=e289]:
                - generic [ref=e290]: "7"
                - 'button "Move 13, Blue fleet: G4 hit" [ref=e293] [cursor=pointer]': G4 hit
                - 'button "Move 14, Red fleet: G2 miss" [ref=e296] [cursor=pointer]': G2 miss
              - listitem [ref=e297]:
                - generic [ref=e298]: "8"
                - 'button "Move 15, Blue fleet: H4 hit" [ref=e301] [cursor=pointer]': H4 hit
                - 'button "Move 16, Red fleet: H2 miss" [ref=e304] [cursor=pointer]': H2 miss
              - listitem [ref=e305]:
                - generic [ref=e306]: "9"
                - 'button "Move 17, Blue fleet: I4 sinks the battleship" [ref=e309] [cursor=pointer]': I4 sinks the battleship
                - 'button "Move 18, Red fleet: I2 miss" [ref=e312] [cursor=pointer]': I2 miss
              - listitem [ref=e313]:
                - generic [ref=e314]: "10"
                - 'button "Move 19, Blue fleet: F6 hit" [ref=e317] [cursor=pointer]': F6 hit
                - 'button "Move 20, Red fleet: J2 miss" [ref=e320] [cursor=pointer]': J2 miss
              - listitem [ref=e321]:
                - generic [ref=e322]: "11"
                - 'button "Move 21, Blue fleet: G6 hit" [ref=e325] [cursor=pointer]': G6 hit
                - 'button "Move 22, Red fleet: A4 miss" [ref=e328] [cursor=pointer]': A4 miss
              - listitem [ref=e329]:
                - generic [ref=e330]: "12"
                - 'button "Move 23, Blue fleet: H6 sinks the cruiser" [ref=e333] [cursor=pointer]': H6 sinks the cruiser
                - 'button "Move 24, Red fleet: B4 miss" [ref=e336] [cursor=pointer]': B4 miss
              - listitem [ref=e337]:
                - generic [ref=e338]: "13"
                - 'button "Move 25, Blue fleet: F8 hit" [ref=e341] [cursor=pointer]': F8 hit
                - 'button "Move 26, Red fleet: C4 miss" [ref=e344] [cursor=pointer]': C4 miss
              - listitem [ref=e345]:
                - generic [ref=e346]: "14"
                - 'button "Move 27, Blue fleet: G8 hit" [ref=e349] [cursor=pointer]': G8 hit
                - 'button "Move 28, Red fleet: D4 miss" [ref=e352] [cursor=pointer]': D4 miss
              - listitem [ref=e353]:
                - generic [ref=e354]: "15"
                - 'button "Move 29, Blue fleet: H8 sinks the submarine" [ref=e357] [cursor=pointer]': H8 sinks the submarine
                - 'button "Move 30, Red fleet: E4 miss" [ref=e360] [cursor=pointer]': E4 miss
              - listitem [ref=e361]:
                - generic [ref=e362]: "16"
                - 'button "Move 31, Blue fleet: F10 hit" [ref=e365] [cursor=pointer]': F10 hit
                - 'button "Move 32, Red fleet: F4 miss" [ref=e368] [cursor=pointer]': F4 miss
              - listitem [ref=e369]:
                - generic [ref=e370]: "17"
                - 'button "Move 33, Blue fleet: G10 sinks the destroyer" [ref=e373] [cursor=pointer]': G10 sinks the destroyer
            - generic [ref=e374]:
              - generic [ref=e375]:
                - button "Go to the start" [ref=e376] [cursor=pointer]:
                  - img [ref=e379]
                - button "Previous move" [ref=e382] [cursor=pointer]:
                  - img [ref=e385]
                - button "Next move" [disabled] [ref=e387]:
                  - img [ref=e390]
                - button "Return to current position" [ref=e392] [cursor=pointer]:
                  - img [ref=e395]
              - button "Go to move" [ref=e398] [cursor=pointer]:
                - generic [ref=e400]:
                  - paragraph [ref=e401]: Go to move
                  - img [ref=e404]
          - button "History and stats" [ref=e408] [cursor=pointer]:
            - paragraph [ref=e411]: History and stats
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