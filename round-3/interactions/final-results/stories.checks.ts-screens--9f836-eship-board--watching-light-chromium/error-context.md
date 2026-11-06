# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--watching light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  916 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/watching-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/watching-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 916 pixels (ratio 0.01 of all image pixels) are different.
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
  - 916 pixels (ratio 0.01 of all image pixels) are different.

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
        - paragraph [ref=e24]: Red fleet fired at C4 and missed. Blue fleet to fire.
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
              - generic [ref=e56]: jordan_plays
            - generic [ref=e59]: Destroyer sunk
          - generic [ref=e61]:
            - generic [ref=e63]:
              - radiogroup "Boards" [ref=e65]:
                - radio "Blue fleet waters" [checked] [ref=e66] [cursor=pointer]:
                  - generic [ref=e67]: Blue fleet waters
                - radio "Red fleet waters" [ref=e68] [cursor=pointer]:
                  - generic [ref=e69]: Red fleet waters
              - region "Blue fleet waters" [ref=e70]:
                - group "Blue fleet waters" [ref=e71]:
                  - generic [ref=e73]: A
                  - generic [ref=e74]: B
                  - generic [ref=e75]: C
                  - generic [ref=e76]: D
                  - generic [ref=e77]: E
                  - generic [ref=e78]: F
                  - generic [ref=e79]: G
                  - generic [ref=e80]: H
                  - generic [ref=e81]: I
                  - generic [ref=e82]: J
                  - generic [ref=e83]: "1"
                  - 'button "A1: hit" [disabled] [ref=e84]':
                    - generic: ✕
                  - 'button "B1: not fired at" [disabled] [ref=e85]'
                  - 'button "C1: not fired at" [disabled] [ref=e86]'
                  - 'button "D1: not fired at" [disabled] [ref=e87]'
                  - 'button "E1: not fired at" [disabled] [ref=e88]'
                  - 'button "F1: not fired at" [disabled] [ref=e89]'
                  - 'button "G1: not fired at" [disabled] [ref=e90]'
                  - 'button "H1: not fired at" [disabled] [ref=e91]'
                  - 'button "I1: not fired at" [disabled] [ref=e92]'
                  - 'button "J1: not fired at" [disabled] [ref=e93]'
                  - generic [ref=e94]: "2"
                  - 'button "A2: miss" [disabled] [ref=e95]':
                    - generic: ○
                  - 'button "B2: not fired at" [disabled] [ref=e96]'
                  - 'button "C2: not fired at" [disabled] [ref=e97]'
                  - 'button "D2: not fired at" [disabled] [ref=e98]'
                  - 'button "E2: not fired at" [disabled] [ref=e99]'
                  - 'button "F2: not fired at" [disabled] [ref=e100]'
                  - 'button "G2: not fired at" [disabled] [ref=e101]'
                  - 'button "H2: not fired at" [disabled] [ref=e102]'
                  - 'button "I2: not fired at" [disabled] [ref=e103]'
                  - 'button "J2: not fired at" [disabled] [ref=e104]'
                  - generic [ref=e105]: "3"
                  - 'button "A3: not fired at" [disabled] [ref=e106]'
                  - 'button "B3: not fired at" [disabled] [ref=e107]'
                  - 'button "C3: not fired at" [disabled] [ref=e108]'
                  - 'button "D3: not fired at" [disabled] [ref=e109]'
                  - 'button "E3: not fired at" [disabled] [ref=e110]'
                  - 'button "F3: not fired at" [disabled] [ref=e111]'
                  - 'button "G3: not fired at" [disabled] [ref=e112]'
                  - 'button "H3: not fired at" [disabled] [ref=e113]'
                  - 'button "I3: not fired at" [disabled] [ref=e114]'
                  - 'button "J3: not fired at" [disabled] [ref=e115]'
                  - generic [ref=e116]: "4"
                  - 'button "A4: not fired at" [disabled] [ref=e117]'
                  - 'button "B4: not fired at" [disabled] [ref=e118]'
                  - 'button "C4: miss, latest shot" [disabled] [ref=e119]':
                    - generic: ○
                  - 'button "D4: not fired at" [disabled] [ref=e120]'
                  - 'button "E4: not fired at" [disabled] [ref=e121]'
                  - 'button "F4: not fired at" [disabled] [ref=e122]'
                  - 'button "G4: not fired at" [disabled] [ref=e123]'
                  - 'button "H4: not fired at" [disabled] [ref=e124]'
                  - 'button "I4: not fired at" [disabled] [ref=e125]'
                  - 'button "J4: not fired at" [disabled] [ref=e126]'
                  - generic [ref=e127]: "5"
                  - 'button "A5: not fired at" [disabled] [ref=e128]'
                  - 'button "B5: not fired at" [disabled] [ref=e129]'
                  - 'button "C5: not fired at" [disabled] [ref=e130]'
                  - 'button "D5: not fired at" [disabled] [ref=e131]'
                  - 'button "E5: not fired at" [disabled] [ref=e132]'
                  - 'button "F5: not fired at" [disabled] [ref=e133]'
                  - 'button "G5: not fired at" [disabled] [ref=e134]'
                  - 'button "H5: not fired at" [disabled] [ref=e135]'
                  - 'button "I5: not fired at" [disabled] [ref=e136]'
                  - 'button "J5: not fired at" [disabled] [ref=e137]'
                  - generic [ref=e138]: "6"
                  - 'button "A6: not fired at" [disabled] [ref=e139]'
                  - 'button "B6: not fired at" [disabled] [ref=e140]'
                  - 'button "C6: not fired at" [disabled] [ref=e141]'
                  - 'button "D6: not fired at" [disabled] [ref=e142]'
                  - 'button "E6: not fired at" [disabled] [ref=e143]'
                  - 'button "F6: not fired at" [disabled] [ref=e144]'
                  - 'button "G6: not fired at" [disabled] [ref=e145]'
                  - 'button "H6: not fired at" [disabled] [ref=e146]'
                  - 'button "I6: not fired at" [disabled] [ref=e147]'
                  - 'button "J6: not fired at" [disabled] [ref=e148]'
                  - generic [ref=e149]: "7"
                  - 'button "A7: not fired at" [disabled] [ref=e150]'
                  - 'button "B7: not fired at" [disabled] [ref=e151]'
                  - 'button "C7: not fired at" [disabled] [ref=e152]'
                  - 'button "D7: not fired at" [disabled] [ref=e153]'
                  - 'button "E7: not fired at" [disabled] [ref=e154]'
                  - 'button "F7: not fired at" [disabled] [ref=e155]'
                  - 'button "G7: not fired at" [disabled] [ref=e156]'
                  - 'button "H7: not fired at" [disabled] [ref=e157]'
                  - 'button "I7: not fired at" [disabled] [ref=e158]'
                  - 'button "J7: not fired at" [disabled] [ref=e159]'
                  - generic [ref=e160]: "8"
                  - 'button "A8: not fired at" [disabled] [ref=e161]'
                  - 'button "B8: not fired at" [disabled] [ref=e162]'
                  - 'button "C8: not fired at" [disabled] [ref=e163]'
                  - 'button "D8: not fired at" [disabled] [ref=e164]'
                  - 'button "E8: not fired at" [disabled] [ref=e165]'
                  - 'button "F8: not fired at" [disabled] [ref=e166]'
                  - 'button "G8: not fired at" [disabled] [ref=e167]'
                  - 'button "H8: not fired at" [disabled] [ref=e168]'
                  - 'button "I8: not fired at" [disabled] [ref=e169]'
                  - 'button "J8: not fired at" [disabled] [ref=e170]'
                  - generic [ref=e171]: "9"
                  - 'button "A9: not fired at" [disabled] [ref=e172]'
                  - 'button "B9: hit" [disabled] [ref=e173]':
                    - generic: ✕
                  - 'button "C9: not fired at" [disabled] [ref=e174]'
                  - 'button "D9: not fired at" [disabled] [ref=e175]'
                  - 'button "E9: not fired at" [disabled] [ref=e176]'
                  - 'button "F9: not fired at" [disabled] [ref=e177]'
                  - 'button "G9: not fired at" [disabled] [ref=e178]'
                  - 'button "H9: not fired at" [disabled] [ref=e179]'
                  - 'button "I9: not fired at" [disabled] [ref=e180]'
                  - 'button "J9: not fired at" [disabled] [ref=e181]'
                  - generic [ref=e182]: "10"
                  - 'button "A10: not fired at" [disabled] [ref=e183]'
                  - 'button "B10: not fired at" [disabled] [ref=e184]'
                  - 'button "C10: not fired at" [disabled] [ref=e185]'
                  - 'button "D10: not fired at" [disabled] [ref=e186]'
                  - 'button "E10: not fired at" [disabled] [ref=e187]'
                  - 'button "F10: not fired at" [disabled] [ref=e188]'
                  - 'button "G10: not fired at" [disabled] [ref=e189]'
                  - 'button "H10: not fired at" [disabled] [ref=e190]'
                  - 'button "I10: not fired at" [disabled] [ref=e191]'
                  - 'button "J10: not fired at" [disabled] [ref=e192]'
            - list "Key" [ref=e193]:
              - listitem [ref=e194]:
                - generic [ref=e195]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e196]:
                - generic [ref=e197]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e198]:
                - generic [ref=e199]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e201]:
            - generic [ref=e202]:
              - generic [ref=e203]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Red fleet fired at C4 and missed. Blue fleet to fire.
          - generic [ref=e211]:
            - img "Blue fleet" [ref=e212]
            - generic [ref=e213]: avery
            - generic [ref=e214]: To move
        - button "History and stats" [ref=e218] [cursor=pointer]:
          - generic [ref=e220]:
            - paragraph [ref=e221]: History and stats
            - img [ref=e224]
      - generic [ref=e226]:
        - img [ref=e229]
        - generic [ref=e232]:
          - paragraph [ref=e233]: You're watching
          - paragraph [ref=e234]: Moves appear as they are played.
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