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
  95679 pixels (ratio 0.08 of all image pixels) are different.

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
  - 95679 pixels (ratio 0.08 of all image pixels) are different.
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
  - 95679 pixels (ratio 0.08 of all image pixels) are different.

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
              - generic [ref=e54]:
                - group "Targeting" [ref=e55]:
                  - generic [ref=e57]: A
                  - generic [ref=e58]: B
                  - generic [ref=e59]: C
                  - generic [ref=e60]: D
                  - generic [ref=e61]: E
                  - generic [ref=e62]: F
                  - generic [ref=e63]: G
                  - generic [ref=e64]: H
                  - generic [ref=e65]: I
                  - generic [ref=e66]: J
                  - generic [ref=e67]: "1"
                  - 'button "A1: not fired at" [disabled] [ref=e68]'
                  - 'button "B1: not fired at" [disabled] [ref=e69]'
                  - 'button "C1: not fired at" [disabled] [ref=e70]'
                  - 'button "D1: not fired at" [disabled] [ref=e71]'
                  - 'button "E1: not fired at" [disabled] [ref=e72]'
                  - 'button "F1: not fired at" [disabled] [ref=e73]'
                  - 'button "G1: not fired at" [disabled] [ref=e74]'
                  - 'button "H1: not fired at" [disabled] [ref=e75]'
                  - 'button "I1: not fired at" [disabled] [ref=e76]'
                  - 'button "J1: not fired at" [disabled] [ref=e77]'
                  - generic [ref=e78]: "2"
                  - 'button "A2: not fired at" [disabled] [ref=e79]'
                  - 'button "B2: not fired at" [disabled] [ref=e80]'
                  - 'button "C2: not fired at" [disabled] [ref=e81]'
                  - 'button "D2: not fired at" [disabled] [ref=e82]'
                  - 'button "E2: not fired at" [disabled] [ref=e83]'
                  - 'button "F2: not fired at" [disabled] [ref=e84]'
                  - 'button "G2: not fired at" [disabled] [ref=e85]'
                  - 'button "H2: not fired at" [disabled] [ref=e86]'
                  - 'button "I2: not fired at" [disabled] [ref=e87]'
                  - 'button "J2: not fired at" [disabled] [ref=e88]'
                  - generic [ref=e89]: "3"
                  - 'button "A3: not fired at" [disabled] [ref=e90]'
                  - 'button "B3: not fired at" [disabled] [ref=e91]'
                  - 'button "C3: not fired at" [disabled] [ref=e92]'
                  - 'button "D3: not fired at" [disabled] [ref=e93]'
                  - 'button "E3: not fired at" [disabled] [ref=e94]'
                  - 'button "F3: not fired at" [disabled] [ref=e95]'
                  - 'button "G3: not fired at" [disabled] [ref=e96]'
                  - 'button "H3: not fired at" [disabled] [ref=e97]'
                  - 'button "I3: not fired at" [disabled] [ref=e98]'
                  - 'button "J3: not fired at" [disabled] [ref=e99]'
                  - generic [ref=e100]: "4"
                  - 'button "A4: not fired at" [disabled] [ref=e101]'
                  - 'button "B4: not fired at" [disabled] [ref=e102]'
                  - 'button "C4: not fired at" [disabled] [ref=e103]'
                  - 'button "D4: not fired at" [disabled] [ref=e104]'
                  - 'button "E4: not fired at" [disabled] [ref=e105]'
                  - 'button "F4: not fired at" [disabled] [ref=e106]'
                  - 'button "G4: not fired at" [disabled] [ref=e107]'
                  - 'button "H4: not fired at" [disabled] [ref=e108]'
                  - 'button "I4: not fired at" [disabled] [ref=e109]'
                  - 'button "J4: not fired at" [disabled] [ref=e110]'
                  - generic [ref=e111]: "5"
                  - 'button "A5: not fired at" [disabled] [ref=e112]'
                  - 'button "B5: not fired at" [disabled] [ref=e113]'
                  - 'button "C5: not fired at" [disabled] [ref=e114]'
                  - 'button "D5: not fired at" [disabled] [ref=e115]'
                  - 'button "E5: not fired at" [disabled] [ref=e116]'
                  - 'button "F5: not fired at" [disabled] [ref=e117]'
                  - 'button "G5: not fired at" [disabled] [ref=e118]'
                  - 'button "H5: not fired at" [disabled] [ref=e119]'
                  - 'button "I5: not fired at" [disabled] [ref=e120]'
                  - 'button "J5: not fired at" [disabled] [ref=e121]'
                  - generic [ref=e122]: "6"
                  - 'button "A6: not fired at" [disabled] [ref=e123]'
                  - 'button "B6: not fired at" [disabled] [ref=e124]'
                  - 'button "C6: not fired at" [disabled] [ref=e125]'
                  - 'button "D6: not fired at" [disabled] [ref=e126]'
                  - 'button "E6: not fired at" [disabled] [ref=e127]'
                  - 'button "F6: not fired at" [disabled] [ref=e128]'
                  - 'button "G6: not fired at" [disabled] [ref=e129]'
                  - 'button "H6: not fired at" [disabled] [ref=e130]'
                  - 'button "I6: not fired at" [disabled] [ref=e131]'
                  - 'button "J6: not fired at" [disabled] [ref=e132]'
                  - generic [ref=e133]: "7"
                  - 'button "A7: not fired at" [disabled] [ref=e134]'
                  - 'button "B7: not fired at" [disabled] [ref=e135]'
                  - 'button "C7: not fired at" [disabled] [ref=e136]'
                  - 'button "D7: not fired at" [disabled] [ref=e137]'
                  - 'button "E7: not fired at" [disabled] [ref=e138]'
                  - 'button "F7: not fired at" [disabled] [ref=e139]'
                  - 'button "G7: not fired at" [disabled] [ref=e140]'
                  - 'button "H7: not fired at" [disabled] [ref=e141]'
                  - 'button "I7: not fired at" [disabled] [ref=e142]'
                  - 'button "J7: not fired at" [disabled] [ref=e143]'
                  - generic [ref=e144]: "8"
                  - 'button "A8: not fired at" [disabled] [ref=e145]'
                  - 'button "B8: not fired at" [disabled] [ref=e146]'
                  - 'button "C8: not fired at" [disabled] [ref=e147]'
                  - 'button "D8: not fired at" [disabled] [ref=e148]'
                  - 'button "E8: not fired at" [disabled] [ref=e149]'
                  - 'button "F8: not fired at" [disabled] [ref=e150]'
                  - 'button "G8: not fired at" [disabled] [ref=e151]'
                  - 'button "H8: not fired at" [disabled] [ref=e152]'
                  - 'button "I8: not fired at" [disabled] [ref=e153]'
                  - 'button "J8: not fired at" [disabled] [ref=e154]'
                  - generic [ref=e155]: "9"
                  - 'button "A9: not fired at" [disabled] [ref=e156]'
                  - 'button "B9: not fired at" [disabled] [ref=e157]'
                  - 'button "C9: not fired at" [disabled] [ref=e158]'
                  - 'button "D9: not fired at" [disabled] [ref=e159]'
                  - 'button "E9: not fired at" [disabled] [ref=e160]'
                  - 'button "F9: not fired at" [disabled] [ref=e161]'
                  - 'button "G9: not fired at" [disabled] [ref=e162]'
                  - 'button "H9: not fired at" [disabled] [ref=e163]'
                  - 'button "I9: not fired at" [disabled] [ref=e164]'
                  - 'button "J9: not fired at" [disabled] [ref=e165]'
                  - generic [ref=e166]: "10"
                  - 'button "A10: not fired at" [disabled] [ref=e167]'
                  - 'button "B10: not fired at" [disabled] [ref=e168]'
                  - 'button "C10: not fired at" [disabled] [ref=e169]'
                  - 'button "D10: not fired at" [disabled] [ref=e170]'
                  - 'button "E10: not fired at" [disabled] [ref=e171]'
                  - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e172]':
                    - generic: ✖
                  - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [active] [ref=e173]':
                    - generic: ✖
                  - 'button "H10: not fired at" [disabled] [ref=e174]'
                  - 'button "I10: not fired at" [disabled] [ref=e175]'
                  - 'button "J10: not fired at" [disabled] [ref=e176]'
                - button "Larger targets" [ref=e178] [cursor=pointer]:
                  - paragraph [ref=e181]: Larger targets
          - list "Key" [ref=e182]:
            - listitem [ref=e183]:
              - generic [ref=e184]:
                - generic: ■
              - text: Ship
            - listitem [ref=e185]:
              - generic [ref=e186]:
                - generic: ○
              - text: Miss
            - listitem [ref=e187]:
              - generic [ref=e188]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e189]:
              - generic [ref=e190]:
                - generic: ✖
              - text: Sunk
        - status [ref=e192]:
          - generic [ref=e193]:
            - generic [ref=e194]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: You fired at G10 and sank the Destroyer. Red fleet is firing.
        - generic [ref=e202]:
          - img "Blue fleet" [ref=e203]
          - generic "avery" [ref=e206]
      - region "Game record" [ref=e208]:
        - generic [ref=e209]:
          - heading "Game record" [level=2] [ref=e211]
          - paragraph [ref=e212]: You fired at G10 and sank the Destroyer. Red fleet is firing.
        - generic [ref=e213]:
          - list "Moves played" [ref=e215]:
            - listitem [ref=e216]:
              - generic [ref=e217]: "1"
              - 'button "Move 1, Blue fleet: F10 hit" [ref=e220] [cursor=pointer]': F10 hit
              - 'button "Move 2, Red fleet: A2 miss" [ref=e223] [cursor=pointer]': A2 miss
            - listitem [ref=e224]:
              - generic [ref=e225]: "2"
              - 'button "Move 3, Blue fleet: G10 sinks the destroyer" [ref=e228] [cursor=pointer]': G10 sinks the destroyer
          - generic [ref=e229]:
            - generic [ref=e230]:
              - button "Go to the start" [ref=e231] [cursor=pointer]:
                - img [ref=e234]
              - button "Previous move" [ref=e237] [cursor=pointer]:
                - img [ref=e240]
              - button "Next move" [disabled] [ref=e242]:
                - img [ref=e245]
              - button "Return to current position" [ref=e247] [cursor=pointer]:
                - img [ref=e250]
            - button "Go to move" [ref=e253] [cursor=pointer]:
              - generic [ref=e255]:
                - paragraph [ref=e256]: Go to move
                - img [ref=e259]
        - generic [ref=e262]:
          - group "Game actions" [ref=e263]:
            - button "Resign game" [ref=e264] [cursor=pointer]:
              - paragraph [ref=e267]:
                - text: Resign
                - generic [ref=e268]: game
          - button "History and stats" [ref=e269] [cursor=pointer]:
            - paragraph [ref=e272]: History and stats
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