# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--enlarged-placement regression battleship-enlargement-below-fold
- Location: tests/storybook/stories.checks.ts:278:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "success"
Received: "error: expected 40.359375 to be greater than or equal to 44"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - status [ref=e11]: 0 of 5 ships placed.
    - generic [ref=e12]:
      - button "Rotate down" [ref=e13] [cursor=pointer]:
        - paragraph [ref=e16]: Rotate down
      - button "Remove" [disabled] [ref=e17]:
        - paragraph [ref=e20]: Remove
    - generic [ref=e21]:
      - button "Close enlarged placement" [active] [ref=e22] [cursor=pointer]:
        - paragraph [ref=e25]: Close enlarged placement
      - button "Ship to place" [ref=e27] [cursor=pointer]:
        - paragraph [ref=e28]: Carrier · 5
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
        - 'button "A1: open water" [ref=e46] [cursor=pointer]'
        - 'button "B1: open water" [ref=e47] [cursor=pointer]'
        - 'button "C1: open water" [ref=e48] [cursor=pointer]'
        - 'button "D1: open water" [ref=e49] [cursor=pointer]'
        - 'button "E1: open water" [ref=e50] [cursor=pointer]'
        - generic [ref=e51]: "2"
        - 'button "A2: open water" [ref=e52] [cursor=pointer]'
        - 'button "B2: open water" [ref=e53] [cursor=pointer]'
        - 'button "C2: open water" [ref=e54] [cursor=pointer]'
        - 'button "D2: open water" [ref=e55] [cursor=pointer]'
        - 'button "E2: open water" [ref=e56] [cursor=pointer]'
        - generic [ref=e57]: "3"
        - 'button "A3: open water" [ref=e58] [cursor=pointer]'
        - 'button "B3: open water" [ref=e59] [cursor=pointer]'
        - 'button "C3: open water" [ref=e60] [cursor=pointer]'
        - 'button "D3: open water" [ref=e61] [cursor=pointer]'
        - 'button "E3: open water" [ref=e62] [cursor=pointer]'
        - generic [ref=e63]: "4"
        - 'button "A4: open water" [ref=e64] [cursor=pointer]'
        - 'button "B4: open water" [ref=e65] [cursor=pointer]'
        - 'button "C4: open water" [ref=e66] [cursor=pointer]'
        - 'button "D4: open water" [ref=e67] [cursor=pointer]'
        - 'button "E4: open water" [ref=e68] [cursor=pointer]'
        - generic [ref=e69]: "5"
        - 'button "A5: open water" [ref=e70] [cursor=pointer]'
        - 'button "B5: open water" [ref=e71] [cursor=pointer]'
        - 'button "C5: open water" [ref=e72] [cursor=pointer]'
        - 'button "D5: open water" [ref=e73] [cursor=pointer]'
        - 'button "E5: open water" [ref=e74] [cursor=pointer]'
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
      - 'button "A1: open water" [ref=e88] [cursor=pointer]'
      - 'button "B1: open water" [ref=e89] [cursor=pointer]'
      - 'button "C1: open water" [ref=e90] [cursor=pointer]'
      - 'button "D1: open water" [ref=e91] [cursor=pointer]'
      - 'button "E1: open water" [ref=e92] [cursor=pointer]'
      - 'button "F1: open water" [ref=e93] [cursor=pointer]'
      - 'button "G1: open water" [ref=e94] [cursor=pointer]'
      - 'button "H1: open water" [ref=e95] [cursor=pointer]'
      - 'button "I1: open water" [ref=e96] [cursor=pointer]'
      - 'button "J1: open water" [ref=e97] [cursor=pointer]'
      - generic [ref=e98]: "2"
      - 'button "A2: open water" [ref=e99] [cursor=pointer]'
      - 'button "B2: open water" [ref=e100] [cursor=pointer]'
      - 'button "C2: open water" [ref=e101] [cursor=pointer]'
      - 'button "D2: open water" [ref=e102] [cursor=pointer]'
      - 'button "E2: open water" [ref=e103] [cursor=pointer]'
      - 'button "F2: open water" [ref=e104] [cursor=pointer]'
      - 'button "G2: open water" [ref=e105] [cursor=pointer]'
      - 'button "H2: open water" [ref=e106] [cursor=pointer]'
      - 'button "I2: open water" [ref=e107] [cursor=pointer]'
      - 'button "J2: open water" [ref=e108] [cursor=pointer]'
      - generic [ref=e109]: "3"
      - 'button "A3: open water" [ref=e110] [cursor=pointer]'
      - 'button "B3: open water" [ref=e111] [cursor=pointer]'
      - 'button "C3: open water" [ref=e112] [cursor=pointer]'
      - 'button "D3: open water" [ref=e113] [cursor=pointer]'
      - 'button "E3: open water" [ref=e114] [cursor=pointer]'
      - 'button "F3: open water" [ref=e115] [cursor=pointer]'
      - 'button "G3: open water" [ref=e116] [cursor=pointer]'
      - 'button "H3: open water" [ref=e117] [cursor=pointer]'
      - 'button "I3: open water" [ref=e118] [cursor=pointer]'
      - 'button "J3: open water" [ref=e119] [cursor=pointer]'
      - generic [ref=e120]: "4"
      - 'button "A4: open water" [ref=e121] [cursor=pointer]'
      - 'button "B4: open water" [ref=e122] [cursor=pointer]'
      - 'button "C4: open water" [ref=e123] [cursor=pointer]'
      - 'button "D4: open water" [ref=e124] [cursor=pointer]'
      - 'button "E4: open water" [ref=e125] [cursor=pointer]'
      - 'button "F4: open water" [ref=e126] [cursor=pointer]'
      - 'button "G4: open water" [ref=e127] [cursor=pointer]'
      - 'button "H4: open water" [ref=e128] [cursor=pointer]'
      - 'button "I4: open water" [ref=e129] [cursor=pointer]'
      - 'button "J4: open water" [ref=e130] [cursor=pointer]'
      - generic [ref=e131]: "5"
      - 'button "A5: open water" [ref=e132] [cursor=pointer]'
      - 'button "B5: open water" [ref=e133] [cursor=pointer]'
      - 'button "C5: open water" [ref=e134] [cursor=pointer]'
      - 'button "D5: open water" [ref=e135] [cursor=pointer]'
      - 'button "E5: open water" [ref=e136] [cursor=pointer]'
      - 'button "F5: open water" [ref=e137] [cursor=pointer]'
      - 'button "G5: open water" [ref=e138] [cursor=pointer]'
      - 'button "H5: open water" [ref=e139] [cursor=pointer]'
      - 'button "I5: open water" [ref=e140] [cursor=pointer]'
      - 'button "J5: open water" [ref=e141] [cursor=pointer]'
      - generic [ref=e142]: "6"
      - 'button "A6: open water" [ref=e143] [cursor=pointer]'
      - 'button "B6: open water" [ref=e144] [cursor=pointer]'
      - 'button "C6: open water" [ref=e145] [cursor=pointer]'
      - 'button "D6: open water" [ref=e146] [cursor=pointer]'
      - 'button "E6: open water" [ref=e147] [cursor=pointer]'
      - 'button "F6: open water" [ref=e148] [cursor=pointer]'
      - 'button "G6: open water" [ref=e149] [cursor=pointer]'
      - 'button "H6: open water" [ref=e150] [cursor=pointer]'
      - 'button "I6: open water" [ref=e151] [cursor=pointer]'
      - 'button "J6: open water" [ref=e152] [cursor=pointer]'
      - generic [ref=e153]: "7"
      - 'button "A7: open water" [ref=e154] [cursor=pointer]'
      - 'button "B7: open water" [ref=e155] [cursor=pointer]'
      - 'button "C7: open water" [ref=e156] [cursor=pointer]'
      - 'button "D7: open water" [ref=e157] [cursor=pointer]'
      - 'button "E7: open water" [ref=e158] [cursor=pointer]'
      - 'button "F7: open water" [ref=e159] [cursor=pointer]'
      - 'button "G7: open water" [ref=e160] [cursor=pointer]'
      - 'button "H7: open water" [ref=e161] [cursor=pointer]'
      - 'button "I7: open water" [ref=e162] [cursor=pointer]'
      - 'button "J7: open water" [ref=e163] [cursor=pointer]'
      - generic [ref=e164]: "8"
      - 'button "A8: open water" [ref=e165] [cursor=pointer]'
      - 'button "B8: open water" [ref=e166] [cursor=pointer]'
      - 'button "C8: open water" [ref=e167] [cursor=pointer]'
      - 'button "D8: open water" [ref=e168] [cursor=pointer]'
      - 'button "E8: open water" [ref=e169] [cursor=pointer]'
      - 'button "F8: open water" [ref=e170] [cursor=pointer]'
      - 'button "G8: open water" [ref=e171] [cursor=pointer]'
      - 'button "H8: open water" [ref=e172] [cursor=pointer]'
      - 'button "I8: open water" [ref=e173] [cursor=pointer]'
      - 'button "J8: open water" [ref=e174] [cursor=pointer]'
      - generic [ref=e175]: "9"
      - 'button "A9: open water" [ref=e176] [cursor=pointer]'
      - 'button "B9: open water" [ref=e177] [cursor=pointer]'
      - 'button "C9: open water" [ref=e178] [cursor=pointer]'
      - 'button "D9: open water" [ref=e179] [cursor=pointer]'
      - 'button "E9: open water" [ref=e180] [cursor=pointer]'
      - 'button "F9: open water" [ref=e181] [cursor=pointer]'
      - 'button "G9: open water" [ref=e182] [cursor=pointer]'
      - 'button "H9: open water" [ref=e183] [cursor=pointer]'
      - 'button "I9: open water" [ref=e184] [cursor=pointer]'
      - 'button "J9: open water" [ref=e185] [cursor=pointer]'
      - generic [ref=e186]: "10"
      - 'button "A10: open water" [ref=e187] [cursor=pointer]'
      - 'button "B10: open water" [ref=e188] [cursor=pointer]'
      - 'button "C10: open water" [ref=e189] [cursor=pointer]'
      - 'button "D10: open water" [ref=e190] [cursor=pointer]'
      - 'button "E10: open water" [ref=e191] [cursor=pointer]'
      - 'button "F10: open water" [ref=e192] [cursor=pointer]'
      - 'button "G10: open water" [ref=e193] [cursor=pointer]'
      - 'button "H10: open water" [ref=e194] [cursor=pointer]'
      - 'button "I10: open water" [ref=e195] [cursor=pointer]'
      - 'button "J10: open water" [ref=e196] [cursor=pointer]'
    - group "Ships" [ref=e197]:
      - generic [ref=e198]: Ships
      - generic [ref=e199]:
        - generic [ref=e200] [cursor=pointer]:
          - radio "Carrier 5 cells" [checked] [ref=e201]
          - generic [ref=e202]: Carrier
          - generic [ref=e203]: 5 cells
        - generic [ref=e204] [cursor=pointer]:
          - radio "Battleship 4 cells" [ref=e205]
          - generic [ref=e206]: Battleship
          - generic [ref=e207]: 4 cells
        - generic [ref=e208] [cursor=pointer]:
          - radio "Cruiser 3 cells" [ref=e209]
          - generic [ref=e210]: Cruiser
          - generic [ref=e211]: 3 cells
        - generic [ref=e212] [cursor=pointer]:
          - radio "Submarine 3 cells" [ref=e213]
          - generic [ref=e214]: Submarine
          - generic [ref=e215]: 3 cells
        - generic [ref=e216] [cursor=pointer]:
          - radio "Destroyer 2 cells" [ref=e217]
          - generic [ref=e218]: Destroyer
          - generic [ref=e219]: 2 cells
    - paragraph [ref=e220]: "Carrier: 5 cells across. Tap its first cell to place it; use Rotate to change direction."
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
> 35 |     .toBe('success');
     |      ^ Error: expect(received).toBe(expected) // Object.is equality
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
  51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```