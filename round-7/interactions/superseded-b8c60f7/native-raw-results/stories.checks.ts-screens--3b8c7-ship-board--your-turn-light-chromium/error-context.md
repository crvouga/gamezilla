# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--your-turn light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  57638 pixels (ratio 0.18 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/your-turn-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/your-turn-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 57638 pixels (ratio 0.18 of all image pixels) are different.
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
  - 57638 pixels (ratio 0.18 of all image pixels) are different.

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
        - paragraph [ref=e24]: Red fleet fired at C4 and missed. Your turn to fire.
        - generic [ref=e25]:
          - list "Moves played" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e32]: Move 4
              - 'button "Move 7, Blue fleet: G2 hit" [ref=e35] [cursor=pointer]': G2 hit
              - 'button "Move 8, Red fleet: C4 miss" [ref=e38] [cursor=pointer]': C4 miss
          - button "All moves" [ref=e39] [cursor=pointer]:
            - img [ref=e43]
      - generic [ref=e45]:
        - generic [ref=e47]:
          - generic [ref=e53]:
            - generic [ref=e54]:
              - img "Red fleet" [ref=e55]
              - generic "jordan_plays" [ref=e58]
            - generic [ref=e61]: Destroyer sunk
          - generic [ref=e63]:
            - generic [ref=e65]:
              - radiogroup "Boards" [ref=e67]:
                - radio "Your fleet" [ref=e68] [cursor=pointer]:
                  - generic [ref=e69]: Your fleet
                - radio "Targeting" [checked] [ref=e70] [cursor=pointer]:
                  - generic [ref=e71]: Targeting
              - region "Targeting" [ref=e72]:
                - generic [ref=e73]:
                  - generic [ref=e74]:
                    - generic [ref=e75]:
                      - group "Targeting" [ref=e77]:
                        - generic [ref=e79]: A
                        - generic [ref=e80]: B
                        - generic [ref=e81]: C
                        - generic [ref=e82]: D
                        - generic [ref=e83]: E
                        - generic [ref=e84]: F
                        - generic [ref=e85]: G
                        - generic [ref=e86]: H
                        - generic [ref=e87]: I
                        - generic [ref=e88]: J
                        - generic [ref=e89]: "1"
                        - button "Fire at A1" [ref=e90] [cursor=pointer]
                        - button "Fire at B1" [ref=e91] [cursor=pointer]
                        - button "Fire at C1" [ref=e92] [cursor=pointer]
                        - button "Fire at D1" [ref=e93] [cursor=pointer]
                        - button "Fire at E1" [ref=e94] [cursor=pointer]
                        - button "Fire at F1" [ref=e95] [cursor=pointer]
                        - button "Fire at G1" [ref=e96] [cursor=pointer]
                        - button "Fire at H1" [ref=e97] [cursor=pointer]
                        - button "Fire at I1" [ref=e98] [cursor=pointer]
                        - button "Fire at J1" [ref=e99] [cursor=pointer]
                        - generic [ref=e100]: "2"
                        - button "Fire at A2" [ref=e101] [cursor=pointer]
                        - button "Fire at B2" [ref=e102] [cursor=pointer]
                        - button "Fire at C2" [ref=e103] [cursor=pointer]
                        - button "Fire at D2" [ref=e104] [cursor=pointer]
                        - button "Fire at E2" [ref=e105] [cursor=pointer]
                        - 'button "F2: hit" [disabled] [ref=e106]':
                          - generic: ✕
                        - 'button "G2: hit, latest shot" [disabled] [ref=e107]':
                          - generic: ✕
                        - button "Fire at H2" [ref=e108] [cursor=pointer]
                        - button "Fire at I2" [ref=e109] [cursor=pointer]
                        - button "Fire at J2" [ref=e110] [cursor=pointer]
                        - generic [ref=e111]: "3"
                        - button "Fire at A3" [ref=e112] [cursor=pointer]
                        - button "Fire at B3" [ref=e113] [cursor=pointer]
                        - button "Fire at C3" [ref=e114] [cursor=pointer]
                        - button "Fire at D3" [ref=e115] [cursor=pointer]
                        - button "Fire at E3" [ref=e116] [cursor=pointer]
                        - button "Fire at F3" [ref=e117] [cursor=pointer]
                        - button "Fire at G3" [ref=e118] [cursor=pointer]
                        - button "Fire at H3" [ref=e119] [cursor=pointer]
                        - button "Fire at I3" [ref=e120] [cursor=pointer]
                        - button "Fire at J3" [ref=e121] [cursor=pointer]
                        - generic [ref=e122]: "4"
                        - button "Fire at A4" [ref=e123] [cursor=pointer]
                        - button "Fire at B4" [ref=e124] [cursor=pointer]
                        - button "Fire at C4" [ref=e125] [cursor=pointer]
                        - button "Fire at D4" [ref=e126] [cursor=pointer]
                        - button "Fire at E4" [ref=e127] [cursor=pointer]
                        - button "Fire at F4" [ref=e128] [cursor=pointer]
                        - button "Fire at G4" [ref=e129] [cursor=pointer]
                        - button "Fire at H4" [ref=e130] [cursor=pointer]
                        - button "Fire at I4" [ref=e131] [cursor=pointer]
                        - button "Fire at J4" [ref=e132] [cursor=pointer]
                        - generic [ref=e133]: "5"
                        - button "Fire at A5" [ref=e134] [cursor=pointer]
                        - button "Fire at B5" [ref=e135] [cursor=pointer]
                        - button "Fire at C5" [ref=e136] [cursor=pointer]
                        - button "Fire at D5" [ref=e137] [cursor=pointer]
                        - button "Fire at E5" [ref=e138] [cursor=pointer]
                        - button "Fire at F5" [ref=e139] [cursor=pointer]
                        - button "Fire at G5" [ref=e140] [cursor=pointer]
                        - button "Fire at H5" [ref=e141] [cursor=pointer]
                        - button "Fire at I5" [ref=e142] [cursor=pointer]
                        - button "Fire at J5" [ref=e143] [cursor=pointer]
                        - generic [ref=e144]: "6"
                        - button "Fire at A6" [ref=e145] [cursor=pointer]
                        - button "Fire at B6" [ref=e146] [cursor=pointer]
                        - button "Fire at C6" [ref=e147] [cursor=pointer]
                        - button "Fire at D6" [ref=e148] [cursor=pointer]
                        - button "Fire at E6" [ref=e149] [cursor=pointer]
                        - button "Fire at F6" [ref=e150] [cursor=pointer]
                        - button "Fire at G6" [ref=e151] [cursor=pointer]
                        - button "Fire at H6" [ref=e152] [cursor=pointer]
                        - button "Fire at I6" [ref=e153] [cursor=pointer]
                        - button "Fire at J6" [ref=e154] [cursor=pointer]
                        - generic [ref=e155]: "7"
                        - button "Fire at A7" [ref=e156] [cursor=pointer]
                        - button "Fire at B7" [ref=e157] [cursor=pointer]
                        - button "Fire at C7" [ref=e158] [cursor=pointer]
                        - button "Fire at D7" [ref=e159] [cursor=pointer]
                        - button "Fire at E7" [ref=e160] [cursor=pointer]
                        - button "Fire at F7" [ref=e161] [cursor=pointer]
                        - button "Fire at G7" [ref=e162] [cursor=pointer]
                        - button "Fire at H7" [ref=e163] [cursor=pointer]
                        - button "Fire at I7" [ref=e164] [cursor=pointer]
                        - button "Fire at J7" [ref=e165] [cursor=pointer]
                        - generic [ref=e166]: "8"
                        - button "Fire at A8" [ref=e167] [cursor=pointer]
                        - button "Fire at B8" [ref=e168] [cursor=pointer]
                        - button "Fire at C8" [ref=e169] [cursor=pointer]
                        - button "Fire at D8" [ref=e170] [cursor=pointer]
                        - button "Fire at E8" [ref=e171] [cursor=pointer]
                        - button "Fire at F8" [ref=e172] [cursor=pointer]
                        - button "Fire at G8" [ref=e173] [cursor=pointer]
                        - button "Fire at H8" [ref=e174] [cursor=pointer]
                        - button "Fire at I8" [ref=e175] [cursor=pointer]
                        - button "Fire at J8" [ref=e176] [cursor=pointer]
                        - generic [ref=e177]: "9"
                        - button "Fire at A9" [ref=e178] [cursor=pointer]
                        - button "Fire at B9" [ref=e179] [cursor=pointer]
                        - button "Fire at C9" [ref=e180] [cursor=pointer]
                        - button "Fire at D9" [ref=e181] [cursor=pointer]
                        - button "Fire at E9" [ref=e182] [cursor=pointer]
                        - button "Fire at F9" [ref=e183] [cursor=pointer]
                        - button "Fire at G9" [ref=e184] [cursor=pointer]
                        - button "Fire at H9" [ref=e185] [cursor=pointer]
                        - button "Fire at I9" [ref=e186] [cursor=pointer]
                        - button "Fire at J9" [ref=e187] [cursor=pointer]
                        - generic [ref=e188]: "10"
                        - button "Fire at A10" [ref=e189] [cursor=pointer]
                        - button "Fire at B10" [ref=e190] [cursor=pointer]
                        - button "Fire at C10" [ref=e191] [cursor=pointer]
                        - button "Fire at D10" [ref=e192] [cursor=pointer]
                        - button "Fire at E10" [ref=e193] [cursor=pointer]
                        - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e194]':
                          - generic: ✖
                        - 'button "G10: hit, sunk Destroyer" [disabled] [ref=e195]':
                          - generic: ✖
                        - button "Fire at H10" [ref=e196] [cursor=pointer]
                        - button "Fire at I10" [ref=e197] [cursor=pointer]
                        - button "Fire at J10" [ref=e198] [cursor=pointer]
                      - generic [ref=e199]:
                        - button "A1–E2" [pressed] [ref=e200] [cursor=pointer]:
                          - generic [ref=e201]: A1
                          - generic [ref=e202]: E2
                        - button "F1–J2" [ref=e203] [cursor=pointer]:
                          - generic [ref=e204]: F1
                          - generic [ref=e205]: J2
                        - button "A3–E4" [ref=e206] [cursor=pointer]:
                          - generic [ref=e207]: A3
                          - generic [ref=e208]: E4
                        - button "F3–J4" [ref=e209] [cursor=pointer]:
                          - generic [ref=e210]: F3
                          - generic [ref=e211]: J4
                        - button "A5–E6" [ref=e212] [cursor=pointer]:
                          - generic [ref=e213]: A5
                          - generic [ref=e214]: E6
                        - button "F5–J6" [ref=e215] [cursor=pointer]:
                          - generic [ref=e216]: F5
                          - generic [ref=e217]: J6
                        - button "A7–E8" [ref=e218] [cursor=pointer]:
                          - generic [ref=e219]: A7
                          - generic [ref=e220]: E8
                        - button "F7–J8" [ref=e221] [cursor=pointer]:
                          - generic [ref=e222]: F7
                          - generic [ref=e223]: J8
                        - button "A9–E10" [ref=e224] [cursor=pointer]:
                          - generic [ref=e225]: A9
                          - generic [ref=e226]: E10
                        - button "F9–J10" [ref=e227] [cursor=pointer]:
                          - generic [ref=e228]: F9
                          - generic [ref=e229]: J10
                    - generic [ref=e231]:
                      - paragraph [ref=e232]: "Aim: A1–E2"
                      - button "Map" [ref=e233] [cursor=pointer]:
                        - paragraph [ref=e236]: Map
                    - group "Precise aim" [ref=e239]:
                      - generic [ref=e241]: A
                      - generic [ref=e242]: B
                      - generic [ref=e243]: C
                      - generic [ref=e244]: D
                      - generic [ref=e245]: E
                      - generic [ref=e246]: "1"
                      - button "Fire at A1" [ref=e247] [cursor=pointer]
                      - button "Fire at B1" [ref=e248] [cursor=pointer]
                      - button "Fire at C1" [ref=e249] [cursor=pointer]
                      - button "Fire at D1" [ref=e250] [cursor=pointer]
                      - button "Fire at E1" [ref=e251] [cursor=pointer]
                      - generic [ref=e252]: "2"
                      - button "Fire at A2" [ref=e253] [cursor=pointer]
                      - button "Fire at B2" [ref=e254] [cursor=pointer]
                      - button "Fire at C2" [ref=e255] [cursor=pointer]
                      - button "Fire at D2" [ref=e256] [cursor=pointer]
                      - button "Fire at E2" [ref=e257] [cursor=pointer]
                  - button "Choose a target" [disabled] [ref=e259]:
                    - paragraph [ref=e262]: Choose a target
            - list "Key" [ref=e263]:
              - listitem [ref=e264]:
                - generic [ref=e265]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e266]:
                - generic [ref=e267]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e268]:
                - generic [ref=e269]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e270]:
                - generic [ref=e271]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e273]:
            - generic [ref=e274]:
              - generic [ref=e275]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Red fleet fired at C4 and missed. Your turn to fire.
          - generic [ref=e283]:
            - img "Blue fleet" [ref=e284]
            - generic "avery" [ref=e287]
            - generic [ref=e288]: Your move
        - generic [ref=e291]:
          - group "Game actions" [ref=e292]:
            - button "Resign game" [ref=e293] [cursor=pointer]:
              - paragraph [ref=e296]:
                - text: Resign
                - generic [ref=e297]: game
          - button "History and stats" [ref=e298] [cursor=pointer]:
            - generic [ref=e300]:
              - paragraph [ref=e301]: History and stats
              - img [ref=e304]
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