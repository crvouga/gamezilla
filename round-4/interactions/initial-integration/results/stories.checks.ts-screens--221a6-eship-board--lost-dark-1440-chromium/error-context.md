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
  74494 pixels (ratio 0.07 of all image pixels) are different.

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
  - 74494 pixels (ratio 0.07 of all image pixels) are different.
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
  - 74494 pixels (ratio 0.07 of all image pixels) are different.

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
        - generic [ref=e34]:
          - img "Blue fleet" [ref=e35]
          - generic [ref=e36]: avery
        - generic [ref=e38]:
          - paragraph [ref=e39]: Red fleet destroyed — all five ships sunk.
          - generic [ref=e41]:
            - radiogroup "Boards" [ref=e43]:
              - radio "Your fleet" [checked] [ref=e44] [cursor=pointer]:
                - generic [ref=e45]: Your fleet
              - radio "Targeting" [ref=e46] [cursor=pointer]:
                - generic [ref=e47]: Targeting
            - region "Your fleet" [ref=e48]:
              - group "Your fleet" [ref=e49]:
                - generic [ref=e51]: A
                - generic [ref=e52]: B
                - generic [ref=e53]: C
                - generic [ref=e54]: D
                - generic [ref=e55]: E
                - generic [ref=e56]: F
                - generic [ref=e57]: G
                - generic [ref=e58]: H
                - generic [ref=e59]: I
                - generic [ref=e60]: J
                - generic [ref=e61]: "1"
                - 'button "A1: open water" [disabled] [ref=e62]'
                - 'button "B1: open water" [disabled] [ref=e63]'
                - 'button "C1: open water" [disabled] [ref=e64]'
                - 'button "D1: open water" [disabled] [ref=e65]'
                - 'button "E1: open water" [disabled] [ref=e66]'
                - 'button "F1: open water" [disabled] [ref=e67]'
                - 'button "G1: open water" [disabled] [ref=e68]'
                - 'button "H1: open water" [disabled] [ref=e69]'
                - 'button "I1: open water" [disabled] [ref=e70]'
                - 'button "J1: open water" [disabled] [ref=e71]'
                - generic [ref=e72]: "2"
                - 'button "A2: open water" [disabled] [ref=e73]'
                - 'button "B2: open water" [disabled] [ref=e74]'
                - 'button "C2: open water" [disabled] [ref=e75]'
                - 'button "D2: open water" [disabled] [ref=e76]'
                - 'button "E2: open water" [disabled] [ref=e77]'
                - 'button "F2: your Carrier, sunk" [disabled] [ref=e78]':
                  - generic: ✖
                - 'button "G2: your Carrier, sunk" [disabled] [ref=e79]':
                  - generic: ✖
                - 'button "H2: your Carrier, sunk" [disabled] [ref=e80]':
                  - generic: ✖
                - 'button "I2: your Carrier, sunk" [disabled] [ref=e81]':
                  - generic: ✖
                - 'button "J2: your Carrier, sunk" [disabled] [ref=e82]':
                  - generic: ✖
                - generic [ref=e83]: "3"
                - 'button "A3: open water" [disabled] [ref=e84]'
                - 'button "B3: open water" [disabled] [ref=e85]'
                - 'button "C3: open water" [disabled] [ref=e86]'
                - 'button "D3: open water" [disabled] [ref=e87]'
                - 'button "E3: open water" [disabled] [ref=e88]'
                - 'button "F3: open water" [disabled] [ref=e89]'
                - 'button "G3: open water" [disabled] [ref=e90]'
                - 'button "H3: open water" [disabled] [ref=e91]'
                - 'button "I3: open water" [disabled] [ref=e92]'
                - 'button "J3: open water" [disabled] [ref=e93]'
                - generic [ref=e94]: "4"
                - 'button "A4: open water" [disabled] [ref=e95]'
                - 'button "B4: open water" [disabled] [ref=e96]'
                - 'button "C4: open water" [disabled] [ref=e97]'
                - 'button "D4: open water" [disabled] [ref=e98]'
                - 'button "E4: open water" [disabled] [ref=e99]'
                - 'button "F4: your Battleship, sunk" [disabled] [ref=e100]':
                  - generic: ✖
                - 'button "G4: your Battleship, sunk" [disabled] [ref=e101]':
                  - generic: ✖
                - 'button "H4: your Battleship, sunk" [disabled] [ref=e102]':
                  - generic: ✖
                - 'button "I4: your Battleship, sunk" [disabled] [ref=e103]':
                  - generic: ✖
                - 'button "J4: open water" [disabled] [ref=e104]'
                - generic [ref=e105]: "5"
                - 'button "A5: open water" [disabled] [ref=e106]'
                - 'button "B5: open water" [disabled] [ref=e107]'
                - 'button "C5: open water" [disabled] [ref=e108]'
                - 'button "D5: open water" [disabled] [ref=e109]'
                - 'button "E5: open water" [disabled] [ref=e110]'
                - 'button "F5: open water" [disabled] [ref=e111]'
                - 'button "G5: open water" [disabled] [ref=e112]'
                - 'button "H5: open water" [disabled] [ref=e113]'
                - 'button "I5: open water" [disabled] [ref=e114]'
                - 'button "J5: open water" [disabled] [ref=e115]'
                - generic [ref=e116]: "6"
                - 'button "A6: open water" [disabled] [ref=e117]'
                - 'button "B6: open water" [disabled] [ref=e118]'
                - 'button "C6: open water" [disabled] [ref=e119]'
                - 'button "D6: open water" [disabled] [ref=e120]'
                - 'button "E6: open water" [disabled] [ref=e121]'
                - 'button "F6: your Cruiser, sunk" [disabled] [ref=e122]':
                  - generic: ✖
                - 'button "G6: your Cruiser, sunk" [disabled] [ref=e123]':
                  - generic: ✖
                - 'button "H6: your Cruiser, sunk" [disabled] [ref=e124]':
                  - generic: ✖
                - 'button "I6: open water" [disabled] [ref=e125]'
                - 'button "J6: open water" [disabled] [ref=e126]'
                - generic [ref=e127]: "7"
                - 'button "A7: open water" [disabled] [ref=e128]'
                - 'button "B7: open water" [disabled] [ref=e129]'
                - 'button "C7: open water" [disabled] [ref=e130]'
                - 'button "D7: open water" [disabled] [ref=e131]'
                - 'button "E7: open water" [disabled] [ref=e132]'
                - 'button "F7: open water" [disabled] [ref=e133]'
                - 'button "G7: open water" [disabled] [ref=e134]'
                - 'button "H7: open water" [disabled] [ref=e135]'
                - 'button "I7: open water" [disabled] [ref=e136]'
                - 'button "J7: open water" [disabled] [ref=e137]'
                - generic [ref=e138]: "8"
                - 'button "A8: open water" [disabled] [ref=e139]'
                - 'button "B8: open water" [disabled] [ref=e140]'
                - 'button "C8: open water" [disabled] [ref=e141]'
                - 'button "D8: open water" [disabled] [ref=e142]'
                - 'button "E8: open water" [disabled] [ref=e143]'
                - 'button "F8: your Submarine, sunk" [disabled] [ref=e144]':
                  - generic: ✖
                - 'button "G8: your Submarine, sunk" [disabled] [ref=e145]':
                  - generic: ✖
                - 'button "H8: your Submarine, sunk" [disabled] [ref=e146]':
                  - generic: ✖
                - 'button "I8: open water" [disabled] [ref=e147]'
                - 'button "J8: open water" [disabled] [ref=e148]'
                - generic [ref=e149]: "9"
                - 'button "A9: open water" [disabled] [ref=e150]'
                - 'button "B9: open water" [disabled] [ref=e151]'
                - 'button "C9: open water" [disabled] [ref=e152]'
                - 'button "D9: open water" [disabled] [ref=e153]'
                - 'button "E9: open water" [disabled] [ref=e154]'
                - 'button "F9: open water" [disabled] [ref=e155]'
                - 'button "G9: open water" [disabled] [ref=e156]'
                - 'button "H9: open water" [disabled] [ref=e157]'
                - 'button "I9: open water" [disabled] [ref=e158]'
                - 'button "J9: open water" [disabled] [ref=e159]'
                - generic [ref=e160]: "10"
                - 'button "A10: open water" [disabled] [ref=e161]'
                - 'button "B10: open water" [disabled] [ref=e162]'
                - 'button "C10: open water" [disabled] [ref=e163]'
                - 'button "D10: open water" [disabled] [ref=e164]'
                - 'button "E10: open water" [disabled] [ref=e165]'
                - 'button "F10: your Destroyer, sunk" [disabled] [ref=e166]':
                  - generic: ✖
                - 'button "G10: your Destroyer, sunk, latest shot" [disabled] [ref=e167]':
                  - generic: ✖
                - 'button "H10: open water" [disabled] [ref=e168]'
                - 'button "I10: open water" [disabled] [ref=e169]'
                - 'button "J10: open water" [disabled] [ref=e170]'
          - list "Key" [ref=e171]:
            - listitem [ref=e172]:
              - generic [ref=e173]:
                - generic: ■
              - text: Ship
            - listitem [ref=e174]:
              - generic [ref=e175]:
                - generic: ○
              - text: Miss
            - listitem [ref=e176]:
              - generic [ref=e177]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e178]:
              - generic [ref=e179]:
                - generic: ✖
              - text: Sunk
        - status [ref=e183]:
          - generic [ref=e184]:
            - generic [ref=e185]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: Sank the whole fleet.
        - generic [ref=e192]:
          - generic [ref=e193]:
            - img "Red fleet" [ref=e194]
            - generic [ref=e195]: jordan_plays
          - generic [ref=e198]: 5 ships sunk
      - generic [ref=e200]:
        - heading "avery wins" [level=2] [ref=e202]
        - list "Standings" [ref=e203]:
          - listitem [ref=e204]:
            - generic [ref=e205]:
              - generic [ref=e206]: 1st
              - generic [ref=e209]: avery
          - listitem [ref=e210]:
            - generic [ref=e211]:
              - generic [ref=e212]: 2nd
              - generic [ref=e215]: jordan_plays
      - region "Game record" [ref=e217]:
        - heading "Game record" [level=2] [ref=e220]
        - generic [ref=e221]:
          - list "Moves played" [ref=e223]:
            - listitem [ref=e224]:
              - generic [ref=e225]: "1"
              - 'button "Move 1, Blue fleet: F2 hit" [ref=e228] [cursor=pointer]': F2 hit
              - 'button "Move 2, Red fleet: A2 miss" [ref=e231] [cursor=pointer]': A2 miss
            - listitem [ref=e232]:
              - generic [ref=e233]: "2"
              - 'button "Move 3, Blue fleet: G2 hit" [ref=e236] [cursor=pointer]': G2 hit
              - 'button "Move 4, Red fleet: B2 miss" [ref=e239] [cursor=pointer]': B2 miss
            - listitem [ref=e240]:
              - generic [ref=e241]: "3"
              - 'button "Move 5, Blue fleet: H2 hit" [ref=e244] [cursor=pointer]': H2 hit
              - 'button "Move 6, Red fleet: C2 miss" [ref=e247] [cursor=pointer]': C2 miss
            - listitem [ref=e248]:
              - generic [ref=e249]: "4"
              - 'button "Move 7, Blue fleet: I2 hit" [ref=e252] [cursor=pointer]': I2 hit
              - 'button "Move 8, Red fleet: D2 miss" [ref=e255] [cursor=pointer]': D2 miss
            - listitem [ref=e256]:
              - generic [ref=e257]: "5"
              - 'button "Move 9, Blue fleet: J2 sinks the carrier" [ref=e260] [cursor=pointer]': J2 sinks the carrier
              - 'button "Move 10, Red fleet: E2 miss" [ref=e263] [cursor=pointer]': E2 miss
            - listitem [ref=e264]:
              - generic [ref=e265]: "6"
              - 'button "Move 11, Blue fleet: F4 hit" [ref=e268] [cursor=pointer]': F4 hit
              - 'button "Move 12, Red fleet: F2 miss" [ref=e271] [cursor=pointer]': F2 miss
            - listitem [ref=e272]:
              - generic [ref=e273]: "7"
              - 'button "Move 13, Blue fleet: G4 hit" [ref=e276] [cursor=pointer]': G4 hit
              - 'button "Move 14, Red fleet: G2 miss" [ref=e279] [cursor=pointer]': G2 miss
            - listitem [ref=e280]:
              - generic [ref=e281]: "8"
              - 'button "Move 15, Blue fleet: H4 hit" [ref=e284] [cursor=pointer]': H4 hit
              - 'button "Move 16, Red fleet: H2 miss" [ref=e287] [cursor=pointer]': H2 miss
            - listitem [ref=e288]:
              - generic [ref=e289]: "9"
              - 'button "Move 17, Blue fleet: I4 sinks the battleship" [ref=e292] [cursor=pointer]': I4 sinks the battleship
              - 'button "Move 18, Red fleet: I2 miss" [ref=e295] [cursor=pointer]': I2 miss
            - listitem [ref=e296]:
              - generic [ref=e297]: "10"
              - 'button "Move 19, Blue fleet: F6 hit" [ref=e300] [cursor=pointer]': F6 hit
              - 'button "Move 20, Red fleet: J2 miss" [ref=e303] [cursor=pointer]': J2 miss
            - listitem [ref=e304]:
              - generic [ref=e305]: "11"
              - 'button "Move 21, Blue fleet: G6 hit" [ref=e308] [cursor=pointer]': G6 hit
              - 'button "Move 22, Red fleet: A4 miss" [ref=e311] [cursor=pointer]': A4 miss
            - listitem [ref=e312]:
              - generic [ref=e313]: "12"
              - 'button "Move 23, Blue fleet: H6 sinks the cruiser" [ref=e316] [cursor=pointer]': H6 sinks the cruiser
              - 'button "Move 24, Red fleet: B4 miss" [ref=e319] [cursor=pointer]': B4 miss
            - listitem [ref=e320]:
              - generic [ref=e321]: "13"
              - 'button "Move 25, Blue fleet: F8 hit" [ref=e324] [cursor=pointer]': F8 hit
              - 'button "Move 26, Red fleet: C4 miss" [ref=e327] [cursor=pointer]': C4 miss
            - listitem [ref=e328]:
              - generic [ref=e329]: "14"
              - 'button "Move 27, Blue fleet: G8 hit" [ref=e332] [cursor=pointer]': G8 hit
              - 'button "Move 28, Red fleet: D4 miss" [ref=e335] [cursor=pointer]': D4 miss
            - listitem [ref=e336]:
              - generic [ref=e337]: "15"
              - 'button "Move 29, Blue fleet: H8 sinks the submarine" [ref=e340] [cursor=pointer]': H8 sinks the submarine
              - 'button "Move 30, Red fleet: E4 miss" [ref=e343] [cursor=pointer]': E4 miss
            - listitem [ref=e344]:
              - generic [ref=e345]: "16"
              - 'button "Move 31, Blue fleet: F10 hit" [ref=e348] [cursor=pointer]': F10 hit
              - 'button "Move 32, Red fleet: F4 miss" [ref=e351] [cursor=pointer]': F4 miss
            - listitem [ref=e352]:
              - generic [ref=e353]: "17"
              - 'button "Move 33, Blue fleet: G10 sinks the destroyer" [ref=e356] [cursor=pointer]': G10 sinks the destroyer
          - generic [ref=e357]:
            - generic [ref=e358]:
              - button "Go to the start" [ref=e359] [cursor=pointer]:
                - img [ref=e362]
              - button "Previous move" [ref=e365] [cursor=pointer]:
                - img [ref=e368]
              - button "Next move" [disabled] [ref=e370]:
                - img [ref=e373]
              - button "Return to current position" [ref=e375] [cursor=pointer]:
                - img [ref=e378]
            - button "Go to move" [ref=e381] [cursor=pointer]:
              - generic [ref=e383]:
                - paragraph [ref=e384]: Go to move
                - img [ref=e387]
        - generic [ref=e390]:
          - group "What next" [ref=e391]:
            - button "Rematch" [ref=e392] [cursor=pointer]:
              - paragraph [ref=e395]: Rematch
            - button "Change game" [ref=e396] [cursor=pointer]:
              - paragraph [ref=e399]: Change game
            - button "Review" [ref=e400] [cursor=pointer]:
              - paragraph [ref=e403]: Review
          - button "History and stats" [ref=e404] [cursor=pointer]:
            - paragraph [ref=e407]: History and stats
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