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
  93672 pixels (ratio 0.08 of all image pixels) are different.

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
  - 93672 pixels (ratio 0.08 of all image pixels) are different.
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
  - 93672 pixels (ratio 0.08 of all image pixels) are different.

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
            - generic [ref=e36]: jordan_plays
          - generic [ref=e39]: 5 ships sunk
        - generic [ref=e41]:
          - paragraph [ref=e42]: Red fleet destroyed — all five ships sunk.
          - generic [ref=e44]:
            - radiogroup "Boards" [ref=e46]:
              - radio "Your fleet" [ref=e47] [cursor=pointer]:
                - generic [ref=e48]: Your fleet
              - radio "Targeting" [checked] [ref=e49] [cursor=pointer]:
                - generic [ref=e50]: Targeting
            - region "Targeting" [ref=e51]:
              - generic [ref=e52]:
                - group "Targeting" [ref=e53]:
                  - generic [ref=e55]: A
                  - generic [ref=e56]: B
                  - generic [ref=e57]: C
                  - generic [ref=e58]: D
                  - generic [ref=e59]: E
                  - generic [ref=e60]: F
                  - generic [ref=e61]: G
                  - generic [ref=e62]: H
                  - generic [ref=e63]: I
                  - generic [ref=e64]: J
                  - generic [ref=e65]: "1"
                  - 'button "A1: not fired at" [disabled] [ref=e66]'
                  - 'button "B1: not fired at" [disabled] [ref=e67]'
                  - 'button "C1: not fired at" [disabled] [ref=e68]'
                  - 'button "D1: not fired at" [disabled] [ref=e69]'
                  - 'button "E1: not fired at" [disabled] [ref=e70]'
                  - 'button "F1: not fired at" [disabled] [ref=e71]'
                  - 'button "G1: not fired at" [disabled] [ref=e72]'
                  - 'button "H1: not fired at" [disabled] [ref=e73]'
                  - 'button "I1: not fired at" [disabled] [ref=e74]'
                  - 'button "J1: not fired at" [disabled] [ref=e75]'
                  - generic [ref=e76]: "2"
                  - 'button "A2: not fired at" [disabled] [ref=e77]'
                  - 'button "B2: not fired at" [disabled] [ref=e78]'
                  - 'button "C2: not fired at" [disabled] [ref=e79]'
                  - 'button "D2: not fired at" [disabled] [ref=e80]'
                  - 'button "E2: not fired at" [disabled] [ref=e81]'
                  - 'button "F2: hit, sunk Carrier" [disabled] [ref=e82]':
                    - generic: ✖
                  - 'button "G2: hit, sunk Carrier" [disabled] [ref=e83]':
                    - generic: ✖
                  - 'button "H2: hit, sunk Carrier" [disabled] [ref=e84]':
                    - generic: ✖
                  - 'button "I2: hit, sunk Carrier" [disabled] [ref=e85]':
                    - generic: ✖
                  - 'button "J2: hit, sunk Carrier" [disabled] [ref=e86]':
                    - generic: ✖
                  - generic [ref=e87]: "3"
                  - 'button "A3: not fired at" [disabled] [ref=e88]'
                  - 'button "B3: not fired at" [disabled] [ref=e89]'
                  - 'button "C3: not fired at" [disabled] [ref=e90]'
                  - 'button "D3: not fired at" [disabled] [ref=e91]'
                  - 'button "E3: not fired at" [disabled] [ref=e92]'
                  - 'button "F3: not fired at" [disabled] [ref=e93]'
                  - 'button "G3: not fired at" [disabled] [ref=e94]'
                  - 'button "H3: not fired at" [disabled] [ref=e95]'
                  - 'button "I3: not fired at" [disabled] [ref=e96]'
                  - 'button "J3: not fired at" [disabled] [ref=e97]'
                  - generic [ref=e98]: "4"
                  - 'button "A4: not fired at" [disabled] [ref=e99]'
                  - 'button "B4: not fired at" [disabled] [ref=e100]'
                  - 'button "C4: not fired at" [disabled] [ref=e101]'
                  - 'button "D4: not fired at" [disabled] [ref=e102]'
                  - 'button "E4: not fired at" [disabled] [ref=e103]'
                  - 'button "F4: hit, sunk Battleship" [disabled] [ref=e104]':
                    - generic: ✖
                  - 'button "G4: hit, sunk Battleship" [disabled] [ref=e105]':
                    - generic: ✖
                  - 'button "H4: hit, sunk Battleship" [disabled] [ref=e106]':
                    - generic: ✖
                  - 'button "I4: hit, sunk Battleship" [disabled] [ref=e107]':
                    - generic: ✖
                  - 'button "J4: not fired at" [disabled] [ref=e108]'
                  - generic [ref=e109]: "5"
                  - 'button "A5: not fired at" [disabled] [ref=e110]'
                  - 'button "B5: not fired at" [disabled] [ref=e111]'
                  - 'button "C5: not fired at" [disabled] [ref=e112]'
                  - 'button "D5: not fired at" [disabled] [ref=e113]'
                  - 'button "E5: not fired at" [disabled] [ref=e114]'
                  - 'button "F5: not fired at" [disabled] [ref=e115]'
                  - 'button "G5: not fired at" [disabled] [ref=e116]'
                  - 'button "H5: not fired at" [disabled] [ref=e117]'
                  - 'button "I5: not fired at" [disabled] [ref=e118]'
                  - 'button "J5: not fired at" [disabled] [ref=e119]'
                  - generic [ref=e120]: "6"
                  - 'button "A6: not fired at" [disabled] [ref=e121]'
                  - 'button "B6: not fired at" [disabled] [ref=e122]'
                  - 'button "C6: not fired at" [disabled] [ref=e123]'
                  - 'button "D6: not fired at" [disabled] [ref=e124]'
                  - 'button "E6: not fired at" [disabled] [ref=e125]'
                  - 'button "F6: hit, sunk Cruiser" [disabled] [ref=e126]':
                    - generic: ✖
                  - 'button "G6: hit, sunk Cruiser" [disabled] [ref=e127]':
                    - generic: ✖
                  - 'button "H6: hit, sunk Cruiser" [disabled] [ref=e128]':
                    - generic: ✖
                  - 'button "I6: not fired at" [disabled] [ref=e129]'
                  - 'button "J6: not fired at" [disabled] [ref=e130]'
                  - generic [ref=e131]: "7"
                  - 'button "A7: not fired at" [disabled] [ref=e132]'
                  - 'button "B7: not fired at" [disabled] [ref=e133]'
                  - 'button "C7: not fired at" [disabled] [ref=e134]'
                  - 'button "D7: not fired at" [disabled] [ref=e135]'
                  - 'button "E7: not fired at" [disabled] [ref=e136]'
                  - 'button "F7: not fired at" [disabled] [ref=e137]'
                  - 'button "G7: not fired at" [disabled] [ref=e138]'
                  - 'button "H7: not fired at" [disabled] [ref=e139]'
                  - 'button "I7: not fired at" [disabled] [ref=e140]'
                  - 'button "J7: not fired at" [disabled] [ref=e141]'
                  - generic [ref=e142]: "8"
                  - 'button "A8: not fired at" [disabled] [ref=e143]'
                  - 'button "B8: not fired at" [disabled] [ref=e144]'
                  - 'button "C8: not fired at" [disabled] [ref=e145]'
                  - 'button "D8: not fired at" [disabled] [ref=e146]'
                  - 'button "E8: not fired at" [disabled] [ref=e147]'
                  - 'button "F8: hit, sunk Submarine" [disabled] [ref=e148]':
                    - generic: ✖
                  - 'button "G8: hit, sunk Submarine" [disabled] [ref=e149]':
                    - generic: ✖
                  - 'button "H8: hit, sunk Submarine" [disabled] [ref=e150]':
                    - generic: ✖
                  - 'button "I8: not fired at" [disabled] [ref=e151]'
                  - 'button "J8: not fired at" [disabled] [ref=e152]'
                  - generic [ref=e153]: "9"
                  - 'button "A9: not fired at" [disabled] [ref=e154]'
                  - 'button "B9: not fired at" [disabled] [ref=e155]'
                  - 'button "C9: not fired at" [disabled] [ref=e156]'
                  - 'button "D9: not fired at" [disabled] [ref=e157]'
                  - 'button "E9: not fired at" [disabled] [ref=e158]'
                  - 'button "F9: not fired at" [disabled] [ref=e159]'
                  - 'button "G9: not fired at" [disabled] [ref=e160]'
                  - 'button "H9: not fired at" [disabled] [ref=e161]'
                  - 'button "I9: not fired at" [disabled] [ref=e162]'
                  - 'button "J9: not fired at" [disabled] [ref=e163]'
                  - generic [ref=e164]: "10"
                  - 'button "A10: not fired at" [disabled] [ref=e165]'
                  - 'button "B10: not fired at" [disabled] [ref=e166]'
                  - 'button "C10: not fired at" [disabled] [ref=e167]'
                  - 'button "D10: not fired at" [disabled] [ref=e168]'
                  - 'button "E10: not fired at" [disabled] [ref=e169]'
                  - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e170]':
                    - generic: ✖
                  - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [active] [ref=e171]':
                    - generic: ✖
                  - 'button "H10: not fired at" [disabled] [ref=e172]'
                  - 'button "I10: not fired at" [disabled] [ref=e173]'
                  - 'button "J10: not fired at" [disabled] [ref=e174]'
                - button "Larger targets" [ref=e175] [cursor=pointer]:
                  - paragraph [ref=e178]: Larger targets
          - list "Key" [ref=e179]:
            - listitem [ref=e180]:
              - generic [ref=e181]:
                - generic: ■
              - text: Ship
            - listitem [ref=e182]:
              - generic [ref=e183]:
                - generic: ○
              - text: Miss
            - listitem [ref=e184]:
              - generic [ref=e185]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e186]:
              - generic [ref=e187]:
                - generic: ✖
              - text: Sunk
        - status [ref=e191]:
          - generic [ref=e192]:
            - generic [ref=e193]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: Sank the whole fleet.
        - generic [ref=e201]:
          - img "Blue fleet" [ref=e202]
          - generic [ref=e203]: avery
      - generic [ref=e205]:
        - heading "You win" [level=2] [ref=e207]
        - list "Standings" [ref=e208]:
          - listitem [ref=e209]:
            - generic [ref=e210]:
              - generic [ref=e211]: 1st
              - generic [ref=e214]: avery
          - listitem [ref=e215]:
            - generic [ref=e216]:
              - generic [ref=e217]: 2nd
              - generic [ref=e220]: jordan_plays
      - region "Game record" [ref=e222]:
        - heading "Game record" [level=2] [ref=e225]
        - generic [ref=e226]:
          - list "Moves played" [ref=e228]:
            - listitem [ref=e229]:
              - generic [ref=e230]: "1"
              - 'button "Move 1, Blue fleet: F2 hit" [ref=e233] [cursor=pointer]': F2 hit
              - 'button "Move 2, Red fleet: A2 miss" [ref=e236] [cursor=pointer]': A2 miss
            - listitem [ref=e237]:
              - generic [ref=e238]: "2"
              - 'button "Move 3, Blue fleet: G2 hit" [ref=e241] [cursor=pointer]': G2 hit
              - 'button "Move 4, Red fleet: B2 miss" [ref=e244] [cursor=pointer]': B2 miss
            - listitem [ref=e245]:
              - generic [ref=e246]: "3"
              - 'button "Move 5, Blue fleet: H2 hit" [ref=e249] [cursor=pointer]': H2 hit
              - 'button "Move 6, Red fleet: C2 miss" [ref=e252] [cursor=pointer]': C2 miss
            - listitem [ref=e253]:
              - generic [ref=e254]: "4"
              - 'button "Move 7, Blue fleet: I2 hit" [ref=e257] [cursor=pointer]': I2 hit
              - 'button "Move 8, Red fleet: D2 miss" [ref=e260] [cursor=pointer]': D2 miss
            - listitem [ref=e261]:
              - generic [ref=e262]: "5"
              - 'button "Move 9, Blue fleet: J2 sinks the carrier" [ref=e265] [cursor=pointer]': J2 sinks the carrier
              - 'button "Move 10, Red fleet: E2 miss" [ref=e268] [cursor=pointer]': E2 miss
            - listitem [ref=e269]:
              - generic [ref=e270]: "6"
              - 'button "Move 11, Blue fleet: F4 hit" [ref=e273] [cursor=pointer]': F4 hit
              - 'button "Move 12, Red fleet: F2 miss" [ref=e276] [cursor=pointer]': F2 miss
            - listitem [ref=e277]:
              - generic [ref=e278]: "7"
              - 'button "Move 13, Blue fleet: G4 hit" [ref=e281] [cursor=pointer]': G4 hit
              - 'button "Move 14, Red fleet: G2 miss" [ref=e284] [cursor=pointer]': G2 miss
            - listitem [ref=e285]:
              - generic [ref=e286]: "8"
              - 'button "Move 15, Blue fleet: H4 hit" [ref=e289] [cursor=pointer]': H4 hit
              - 'button "Move 16, Red fleet: H2 miss" [ref=e292] [cursor=pointer]': H2 miss
            - listitem [ref=e293]:
              - generic [ref=e294]: "9"
              - 'button "Move 17, Blue fleet: I4 sinks the battleship" [ref=e297] [cursor=pointer]': I4 sinks the battleship
              - 'button "Move 18, Red fleet: I2 miss" [ref=e300] [cursor=pointer]': I2 miss
            - listitem [ref=e301]:
              - generic [ref=e302]: "10"
              - 'button "Move 19, Blue fleet: F6 hit" [ref=e305] [cursor=pointer]': F6 hit
              - 'button "Move 20, Red fleet: J2 miss" [ref=e308] [cursor=pointer]': J2 miss
            - listitem [ref=e309]:
              - generic [ref=e310]: "11"
              - 'button "Move 21, Blue fleet: G6 hit" [ref=e313] [cursor=pointer]': G6 hit
              - 'button "Move 22, Red fleet: A4 miss" [ref=e316] [cursor=pointer]': A4 miss
            - listitem [ref=e317]:
              - generic [ref=e318]: "12"
              - 'button "Move 23, Blue fleet: H6 sinks the cruiser" [ref=e321] [cursor=pointer]': H6 sinks the cruiser
              - 'button "Move 24, Red fleet: B4 miss" [ref=e324] [cursor=pointer]': B4 miss
            - listitem [ref=e325]:
              - generic [ref=e326]: "13"
              - 'button "Move 25, Blue fleet: F8 hit" [ref=e329] [cursor=pointer]': F8 hit
              - 'button "Move 26, Red fleet: C4 miss" [ref=e332] [cursor=pointer]': C4 miss
            - listitem [ref=e333]:
              - generic [ref=e334]: "14"
              - 'button "Move 27, Blue fleet: G8 hit" [ref=e337] [cursor=pointer]': G8 hit
              - 'button "Move 28, Red fleet: D4 miss" [ref=e340] [cursor=pointer]': D4 miss
            - listitem [ref=e341]:
              - generic [ref=e342]: "15"
              - 'button "Move 29, Blue fleet: H8 sinks the submarine" [ref=e345] [cursor=pointer]': H8 sinks the submarine
              - 'button "Move 30, Red fleet: E4 miss" [ref=e348] [cursor=pointer]': E4 miss
            - listitem [ref=e349]:
              - generic [ref=e350]: "16"
              - 'button "Move 31, Blue fleet: F10 hit" [ref=e353] [cursor=pointer]': F10 hit
              - 'button "Move 32, Red fleet: F4 miss" [ref=e356] [cursor=pointer]': F4 miss
            - listitem [ref=e357]:
              - generic [ref=e358]: "17"
              - 'button "Move 33, Blue fleet: G10 sinks the destroyer" [ref=e361] [cursor=pointer]': G10 sinks the destroyer
          - generic [ref=e362]:
            - generic [ref=e363]:
              - button "Go to the start" [ref=e364] [cursor=pointer]:
                - img [ref=e367]
              - button "Previous move" [ref=e370] [cursor=pointer]:
                - img [ref=e373]
              - button "Next move" [disabled] [ref=e375]:
                - img [ref=e378]
              - button "Return to current position" [ref=e380] [cursor=pointer]:
                - img [ref=e383]
            - button "Go to move" [ref=e386] [cursor=pointer]:
              - generic [ref=e388]:
                - paragraph [ref=e389]: Go to move
                - img [ref=e392]
        - generic [ref=e395]:
          - group "What next" [ref=e396]:
            - button "Rematch" [ref=e397] [cursor=pointer]:
              - paragraph [ref=e400]: Rematch
            - button "Change game" [ref=e401] [cursor=pointer]:
              - paragraph [ref=e404]: Change game
            - button "Review" [ref=e405] [cursor=pointer]:
              - paragraph [ref=e408]: Review
          - button "History and stats" [ref=e409] [cursor=pointer]:
            - paragraph [ref=e412]: History and stats
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