# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--enlarged-placement light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  77064 pixels (ratio 0.24 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/enlarged-placement-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/enlarged-placement-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 77064 pixels (ratio 0.24 of all image pixels) are different.
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
  - 77064 pixels (ratio 0.24 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - status [ref=e11]: All five ships placed. Your fleet is ready.
    - generic [ref=e12]:
      - button "Rotate down" [disabled] [ref=e13]:
        - paragraph [ref=e16]: Rotate down
      - button "Remove" [disabled] [ref=e17]:
        - paragraph [ref=e20]: Remove
    - generic [ref=e21]:
      - button "Close enlarged placement" [ref=e22] [cursor=pointer]:
        - paragraph [ref=e25]: Close enlarged placement
      - button "Ship to place" [ref=e27] [cursor=pointer]:
        - paragraph [ref=e28]: Select…
        - img [ref=e30]
      - button "Placement area" [ref=e33] [cursor=pointer]:
        - paragraph [ref=e34]: A–E / 1–5
        - img [ref=e36]
      - group "Enlarged bow placement" [ref=e38]:
        - generic [ref=e40]: A
        - generic [ref=e41]: B
        - generic [ref=e42]: C
        - generic [ref=e43]: D
        - generic [ref=e44]: E
        - generic [ref=e45]: "1"
        - 'button "A1: Carrier" [disabled] [ref=e46]':
          - generic: ■
        - 'button "B1: Carrier" [disabled] [ref=e47]':
          - generic: ■
        - 'button "C1: Carrier" [disabled] [ref=e48]':
          - generic: ■
        - 'button "D1: Carrier" [disabled] [ref=e49]':
          - generic: ■
        - 'button "E1: Carrier" [disabled] [ref=e50]':
          - generic: ■
        - generic [ref=e51]: "2"
        - 'button "A2: open water" [disabled] [ref=e52]'
        - 'button "B2: Destroyer" [disabled] [active] [ref=e53]':
          - generic: ■
        - 'button "C2: Destroyer" [disabled] [ref=e54]':
          - generic: ■
        - 'button "D2: open water" [disabled] [ref=e55]'
        - 'button "E2: open water" [disabled] [ref=e56]'
        - generic [ref=e57]: "3"
        - 'button "A3: Battleship" [disabled] [ref=e58]':
          - generic: ■
        - 'button "B3: open water" [disabled] [ref=e59]'
        - 'button "C3: Cruiser" [disabled] [ref=e60]':
          - generic: ■
        - 'button "D3: open water" [disabled] [ref=e61]'
        - 'button "E3: Submarine" [disabled] [ref=e62]':
          - generic: ■
        - generic [ref=e63]: "4"
        - 'button "A4: Battleship" [disabled] [ref=e64]':
          - generic: ■
        - 'button "B4: open water" [disabled] [ref=e65]'
        - 'button "C4: Cruiser" [disabled] [ref=e66]':
          - generic: ■
        - 'button "D4: open water" [disabled] [ref=e67]'
        - 'button "E4: Submarine" [disabled] [ref=e68]':
          - generic: ■
        - generic [ref=e69]: "5"
        - 'button "A5: Battleship" [disabled] [ref=e70]':
          - generic: ■
        - 'button "B5: open water" [disabled] [ref=e71]'
        - 'button "C5: Cruiser" [disabled] [ref=e72]':
          - generic: ■
        - 'button "D5: open water" [disabled] [ref=e73]'
        - 'button "E5: Submarine" [disabled] [ref=e74]':
          - generic: ■
    - group "Your waters" [ref=e75]:
      - generic [ref=e77]: A
      - generic [ref=e78]: B
      - generic [ref=e79]: C
      - generic [ref=e80]: D
      - generic [ref=e81]: E
      - generic [ref=e82]: F
      - generic [ref=e83]: G
      - generic [ref=e84]: H
      - generic [ref=e85]: I
      - generic [ref=e86]: J
      - generic [ref=e87]: "1"
      - 'button "A1: Carrier" [disabled] [ref=e88]':
        - generic: ■
      - 'button "B1: Carrier" [disabled] [ref=e89]':
        - generic: ■
      - 'button "C1: Carrier" [disabled] [ref=e90]':
        - generic: ■
      - 'button "D1: Carrier" [disabled] [ref=e91]':
        - generic: ■
      - 'button "E1: Carrier" [disabled] [ref=e92]':
        - generic: ■
      - 'button "F1: open water" [disabled] [ref=e93]'
      - 'button "G1: open water" [disabled] [ref=e94]'
      - 'button "H1: open water" [disabled] [ref=e95]'
      - 'button "I1: open water" [disabled] [ref=e96]'
      - 'button "J1: open water" [disabled] [ref=e97]'
      - generic [ref=e98]: "2"
      - 'button "A2: open water" [disabled] [ref=e99]'
      - 'button "B2: Destroyer" [disabled] [ref=e100]':
        - generic: ■
      - 'button "C2: Destroyer" [disabled] [ref=e101]':
        - generic: ■
      - 'button "D2: open water" [disabled] [ref=e102]'
      - 'button "E2: open water" [disabled] [ref=e103]'
      - 'button "F2: open water" [disabled] [ref=e104]'
      - 'button "G2: open water" [disabled] [ref=e105]'
      - 'button "H2: open water" [disabled] [ref=e106]'
      - 'button "I2: open water" [disabled] [ref=e107]'
      - 'button "J2: open water" [disabled] [ref=e108]'
      - generic [ref=e109]: "3"
      - 'button "A3: Battleship" [disabled] [ref=e110]':
        - generic: ■
      - 'button "B3: open water" [disabled] [ref=e111]'
      - 'button "C3: Cruiser" [disabled] [ref=e112]':
        - generic: ■
      - 'button "D3: open water" [disabled] [ref=e113]'
      - 'button "E3: Submarine" [disabled] [ref=e114]':
        - generic: ■
      - 'button "F3: open water" [disabled] [ref=e115]'
      - 'button "G3: open water" [disabled] [ref=e116]'
      - 'button "H3: open water" [disabled] [ref=e117]'
      - 'button "I3: open water" [disabled] [ref=e118]'
      - 'button "J3: open water" [disabled] [ref=e119]'
      - generic [ref=e120]: "4"
      - 'button "A4: Battleship" [disabled] [ref=e121]':
        - generic: ■
      - 'button "B4: open water" [disabled] [ref=e122]'
      - 'button "C4: Cruiser" [disabled] [ref=e123]':
        - generic: ■
      - 'button "D4: open water" [disabled] [ref=e124]'
      - 'button "E4: Submarine" [disabled] [ref=e125]':
        - generic: ■
      - 'button "F4: open water" [disabled] [ref=e126]'
      - 'button "G4: open water" [disabled] [ref=e127]'
      - 'button "H4: open water" [disabled] [ref=e128]'
      - 'button "I4: open water" [disabled] [ref=e129]'
      - 'button "J4: open water" [disabled] [ref=e130]'
      - generic [ref=e131]: "5"
      - 'button "A5: Battleship" [disabled] [ref=e132]':
        - generic: ■
      - 'button "B5: open water" [disabled] [ref=e133]'
      - 'button "C5: Cruiser" [disabled] [ref=e134]':
        - generic: ■
      - 'button "D5: open water" [disabled] [ref=e135]'
      - 'button "E5: Submarine" [disabled] [ref=e136]':
        - generic: ■
      - 'button "F5: open water" [disabled] [ref=e137]'
      - 'button "G5: open water" [disabled] [ref=e138]'
      - 'button "H5: open water" [disabled] [ref=e139]'
      - 'button "I5: open water" [disabled] [ref=e140]'
      - 'button "J5: open water" [disabled] [ref=e141]'
      - generic [ref=e142]: "6"
      - 'button "A6: Battleship" [disabled] [ref=e143]':
        - generic: ■
      - 'button "B6: open water" [disabled] [ref=e144]'
      - 'button "C6: open water" [disabled] [ref=e145]'
      - 'button "D6: open water" [disabled] [ref=e146]'
      - 'button "E6: open water" [disabled] [ref=e147]'
      - 'button "F6: open water" [disabled] [ref=e148]'
      - 'button "G6: open water" [disabled] [ref=e149]'
      - 'button "H6: open water" [disabled] [ref=e150]'
      - 'button "I6: open water" [disabled] [ref=e151]'
      - 'button "J6: open water" [disabled] [ref=e152]'
      - generic [ref=e153]: "7"
      - 'button "A7: open water" [disabled] [ref=e154]'
      - 'button "B7: open water" [disabled] [ref=e155]'
      - 'button "C7: open water" [disabled] [ref=e156]'
      - 'button "D7: open water" [disabled] [ref=e157]'
      - 'button "E7: open water" [disabled] [ref=e158]'
      - 'button "F7: open water" [disabled] [ref=e159]'
      - 'button "G7: open water" [disabled] [ref=e160]'
      - 'button "H7: open water" [disabled] [ref=e161]'
      - 'button "I7: open water" [disabled] [ref=e162]'
      - 'button "J7: open water" [disabled] [ref=e163]'
      - generic [ref=e164]: "8"
      - 'button "A8: open water" [disabled] [ref=e165]'
      - 'button "B8: open water" [disabled] [ref=e166]'
      - 'button "C8: open water" [disabled] [ref=e167]'
      - 'button "D8: open water" [disabled] [ref=e168]'
      - 'button "E8: open water" [disabled] [ref=e169]'
      - 'button "F8: open water" [disabled] [ref=e170]'
      - 'button "G8: open water" [disabled] [ref=e171]'
      - 'button "H8: open water" [disabled] [ref=e172]'
      - 'button "I8: open water" [disabled] [ref=e173]'
      - 'button "J8: open water" [disabled] [ref=e174]'
      - generic [ref=e175]: "9"
      - 'button "A9: open water" [disabled] [ref=e176]'
      - 'button "B9: open water" [disabled] [ref=e177]'
      - 'button "C9: open water" [disabled] [ref=e178]'
      - 'button "D9: open water" [disabled] [ref=e179]'
      - 'button "E9: open water" [disabled] [ref=e180]'
      - 'button "F9: open water" [disabled] [ref=e181]'
      - 'button "G9: open water" [disabled] [ref=e182]'
      - 'button "H9: open water" [disabled] [ref=e183]'
      - 'button "I9: open water" [disabled] [ref=e184]'
      - 'button "J9: open water" [disabled] [ref=e185]'
      - generic [ref=e186]: "10"
      - 'button "A10: open water" [disabled] [ref=e187]'
      - 'button "B10: open water" [disabled] [ref=e188]'
      - 'button "C10: open water" [disabled] [ref=e189]'
      - 'button "D10: open water" [disabled] [ref=e190]'
      - 'button "E10: open water" [disabled] [ref=e191]'
      - 'button "F10: open water" [disabled] [ref=e192]'
      - 'button "G10: open water" [disabled] [ref=e193]'
      - 'button "H10: open water" [disabled] [ref=e194]'
      - 'button "I10: open water" [disabled] [ref=e195]'
      - 'button "J10: open water" [disabled] [ref=e196]'
    - group "Ships" [ref=e197]:
      - generic [ref=e198]: Ships
      - generic [ref=e199]:
        - generic [ref=e200] [cursor=pointer]:
          - radio "Carrier A1, across" [ref=e201]
          - generic [ref=e202]: Carrier
          - generic [ref=e203]: A1, across
        - generic [ref=e204] [cursor=pointer]:
          - radio "Battleship A3, down" [ref=e205]
          - generic [ref=e206]: Battleship
          - generic [ref=e207]: A3, down
        - generic [ref=e208] [cursor=pointer]:
          - radio "Cruiser C3, down" [ref=e209]
          - generic [ref=e210]: Cruiser
          - generic [ref=e211]: C3, down
        - generic [ref=e212] [cursor=pointer]:
          - radio "Submarine E3, down" [ref=e213]
          - generic [ref=e214]: Submarine
          - generic [ref=e215]: E3, down
        - generic [ref=e216] [cursor=pointer]:
          - radio "Destroyer B2, across" [ref=e217]
          - generic [ref=e218]: Destroyer
          - generic [ref=e219]: B2, across
    - paragraph [ref=e220]: Choose a placed ship to move or remove it.
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