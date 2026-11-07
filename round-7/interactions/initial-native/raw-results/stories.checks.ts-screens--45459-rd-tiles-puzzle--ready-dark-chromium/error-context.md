# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--ready dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 171

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=axeAPI",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#dce8d6",
+               "colorParse": undefined,
+               "contrastRatio": 1.17,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#fff6da",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.17 (foreground color: #fff6da, background color: #dce8d6, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button type=\"button\" class=\"_cell_g9au5_67\" data-index=\"66\" data-cell=\"g5\" data-testid=\"word-tiles-puzzle-cell-g5\" data-state=\"empty\" data-square=\"DL\" aria-label=\"2L, g5, double letter, empty\" aria-disabled=\"false\" tabindex=\"-1\"><span aria-hidden=\"true\" class=\"_square_g9au5_108\">2L</span></button>",
+                 "target": Array [
+                   "button[data-index=\"66\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.17 (foreground color: #fff6da, background color: #dce8d6, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span aria-hidden=\"true\" class=\"_square_g9au5_108\">2L</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button[data-index=\"66\"] > ._square_g9au5_108[aria-hidden=\"true\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#dce8d6",
+               "colorParse": undefined,
+               "contrastRatio": 1.17,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#fff6da",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.17 (foreground color: #fff6da, background color: #dce8d6, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button type=\"button\" class=\"_cell_g9au5_67\" data-index=\"68\" data-cell=\"i5\" data-testid=\"word-tiles-puzzle-cell-i5\" data-state=\"empty\" data-square=\"DL\" aria-label=\"2L, i5, double letter, empty\" aria-disabled=\"false\" tabindex=\"-1\"><span aria-hidden=\"true\" class=\"_square_g9au5_108\">2L</span></button>",
+                 "target": Array [
+                   "button[data-index=\"68\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.17 (foreground color: #fff6da, background color: #dce8d6, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span aria-hidden=\"true\" class=\"_square_g9au5_108\">2L</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button[data-index=\"68\"] > ._square_g9au5_108[aria-hidden=\"true\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#dce8d6",
+               "colorParse": undefined,
+               "contrastRatio": 1.17,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#fff6da",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.17 (foreground color: #fff6da, background color: #dce8d6, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button type=\"button\" class=\"_cell_g9au5_67\" data-index=\"72\" data-cell=\"m5\" data-testid=\"word-tiles-puzzle-cell-m5\" data-state=\"empty\" data-square=\"TL\" aria-label=\"3L, m5, triple letter, empty\" aria-disabled=\"false\" tabindex=\"-1\"><span aria-hidden=\"true\" class=\"_square_g9au5_108\">3L</span></button>",
+                 "target": Array [
+                   "button[data-index=\"72\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.17 (foreground color: #fff6da, background color: #dce8d6, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span aria-hidden=\"true\" class=\"_square_g9au5_108\">3L</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button[data-index=\"72\"] > ._square_g9au5_108[aria-hidden=\"true\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#dce8d6",
+               "colorParse": undefined,
+               "contrastRatio": 1.17,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#fff6da",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.17 (foreground color: #fff6da, background color: #dce8d6, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button type=\"button\" class=\"_cell_g9au5_67\" data-index=\"74\" data-cell=\"o5\" data-testid=\"word-tiles-puzzle-cell-o5\" data-state=\"empty\" data-square=\"TW\" aria-label=\"3W, o5, triple word, empty\" aria-disabled=\"false\" tabindex=\"-1\"><span aria-hidden=\"true\" class=\"_square_g9au5_108\">3W</span></button>",
+                 "target": Array [
+                   "button[data-index=\"74\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.17 (foreground color: #fff6da, background color: #dce8d6, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span aria-hidden=\"true\" class=\"_square_g9au5_108\">3W</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button[data-index=\"74\"] > ._square_g9au5_108[aria-hidden=\"true\"]",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 20 points in one move.
    - status [ref=e13]: Choose a tile, then a square.
    - generic [ref=e14]:
      - button "Play word" [disabled] [ref=e15]:
        - paragraph [ref=e18]: Play word
      - button "Recall tiles" [disabled] [ref=e19]:
        - paragraph [ref=e22]: Recall tiles
    - group "Your rack" [ref=e23]:
      - button "A, 1 points" [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: A
        - generic [ref=e26]: "1"
      - button "E, 1 points" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: E
        - generic [ref=e29]: "1"
      - button "S, 1 points" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: S
        - generic [ref=e32]: "1"
      - button "T, 1 points" [ref=e33] [cursor=pointer]:
        - generic [ref=e34]: T
        - generic [ref=e35]: "1"
      - button "Blank, 0 points" [ref=e36] [cursor=pointer]:
        - generic [ref=e37]: "0"
      - button "R, 1 points" [ref=e38] [cursor=pointer]:
        - generic [ref=e39]: R
        - generic [ref=e40]: "1"
      - button "N, 1 points" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: "N"
        - generic [ref=e43]: "1"
    - paragraph [ref=e44]: "2L/3L: double/triple letter. 2W/3W: double/triple word."
    - generic [ref=e46]:
      - region "Scrollable word board" [ref=e47]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e48]:
          - generic [ref=e50]: a
          - generic [ref=e51]: b
          - generic [ref=e52]: c
          - generic [ref=e53]: d
          - generic [ref=e54]: e
          - generic [ref=e55]: f
          - generic [ref=e56]: g
          - generic [ref=e57]: h
          - generic [ref=e58]: i
          - generic [ref=e59]: j
          - generic [ref=e60]: k
          - generic [ref=e61]: l
          - generic [ref=e62]: m
          - generic [ref=e63]: "n"
          - generic [ref=e64]: o
          - generic [ref=e65]: "1"
          - button "2L, a1, double letter, empty" [ref=e66] [cursor=pointer]:
            - generic [ref=e67]: 2L
          - button "b1, empty" [ref=e68] [cursor=pointer]
          - button "c1, empty" [ref=e69] [cursor=pointer]
          - button "d1, empty" [ref=e70] [cursor=pointer]
          - button "3W, e1, triple word, empty" [ref=e71] [cursor=pointer]:
            - generic [ref=e72]: 3W
          - button "f1, empty" [ref=e73] [cursor=pointer]
          - button "g1, empty" [ref=e74] [cursor=pointer]
          - button "2L, h1, double letter, empty" [ref=e75] [cursor=pointer]:
            - generic [ref=e76]: 2L
          - button "i1, empty" [ref=e77] [cursor=pointer]
          - button "j1, empty" [ref=e78] [cursor=pointer]
          - button "3W, k1, triple word, empty" [ref=e79] [cursor=pointer]:
            - generic [ref=e80]: 3W
          - button "l1, empty" [ref=e81] [cursor=pointer]
          - button "m1, empty" [ref=e82] [cursor=pointer]
          - button "n1, empty" [ref=e83] [cursor=pointer]
          - button "2L, o1, double letter, empty" [ref=e84] [cursor=pointer]:
            - generic [ref=e85]: 2L
          - generic [ref=e86]: "2"
          - button "a2, empty" [ref=e87] [cursor=pointer]
          - button "b2, empty" [ref=e88] [cursor=pointer]
          - button "c2, empty" [ref=e89] [cursor=pointer]
          - button "2L, d2, double letter, empty" [ref=e90] [cursor=pointer]:
            - generic [ref=e91]: 2L
          - button "e2, empty" [ref=e92] [cursor=pointer]
          - button "f2, empty" [ref=e93] [cursor=pointer]
          - button "2W, g2, double word, empty" [ref=e94] [cursor=pointer]:
            - generic [ref=e95]: 2W
          - button "h2, empty" [ref=e96] [cursor=pointer]
          - button "2W, i2, double word, empty" [ref=e97] [cursor=pointer]:
            - generic [ref=e98]: 2W
          - button "j2, empty" [ref=e99] [cursor=pointer]
          - button "k2, empty" [ref=e100] [cursor=pointer]
          - button "2L, l2, double letter, empty" [ref=e101] [cursor=pointer]:
            - generic [ref=e102]: 2L
          - button "m2, empty" [ref=e103] [cursor=pointer]
          - button "n2, empty" [ref=e104] [cursor=pointer]
          - button "o2, empty" [ref=e105] [cursor=pointer]
          - generic [ref=e106]: "3"
          - button "a3, empty" [ref=e107] [cursor=pointer]
          - button "b3, empty" [ref=e108] [cursor=pointer]
          - button "c3, empty" [ref=e109] [cursor=pointer]
          - button "d3, empty" [ref=e110] [cursor=pointer]
          - button "3L, e3, triple letter, empty" [ref=e111] [cursor=pointer]:
            - generic [ref=e112]: 3L
          - button "f3, empty" [ref=e113] [cursor=pointer]
          - button "g3, empty" [ref=e114] [cursor=pointer]
          - button "h3, empty" [ref=e115] [cursor=pointer]
          - button "i3, empty" [ref=e116] [cursor=pointer]
          - button "j3, empty" [ref=e117] [cursor=pointer]
          - button "3L, k3, triple letter, empty" [ref=e118] [cursor=pointer]:
            - generic [ref=e119]: 3L
          - button "l3, empty" [ref=e120] [cursor=pointer]
          - button "m3, empty" [ref=e121] [cursor=pointer]
          - button "n3, empty" [ref=e122] [cursor=pointer]
          - button "o3, empty" [ref=e123] [cursor=pointer]
          - generic [ref=e124]: "4"
          - button "a4, empty" [ref=e125] [cursor=pointer]
          - button "2L, b4, double letter, empty" [ref=e126] [cursor=pointer]:
            - generic [ref=e127]: 2L
          - button "c4, empty" [ref=e128] [cursor=pointer]
          - button "2W, d4, double word, empty" [ref=e129] [cursor=pointer]:
            - generic [ref=e130]: 2W
          - button "e4, empty" [ref=e131] [cursor=pointer]
          - button "f4, empty" [ref=e132] [cursor=pointer]
          - button "g4, empty" [ref=e133] [cursor=pointer]
          - button "h4, empty" [ref=e134] [cursor=pointer]
          - button "i4, empty" [ref=e135] [cursor=pointer]
          - button "j4, empty" [ref=e136] [cursor=pointer]
          - button "k4, empty" [ref=e137] [cursor=pointer]
          - button "2W, l4, double word, empty" [ref=e138] [cursor=pointer]:
            - generic [ref=e139]: 2W
          - button "m4, empty" [ref=e140] [cursor=pointer]
          - button "2L, n4, double letter, empty" [ref=e141] [cursor=pointer]:
            - generic [ref=e142]: 2L
          - button "o4, empty" [ref=e143] [cursor=pointer]
          - generic [ref=e144]: "5"
          - button "3W, a5, triple word, empty" [ref=e145] [cursor=pointer]:
            - generic [ref=e146]: 3W
          - button "b5, empty" [ref=e147] [cursor=pointer]
          - button "3L, c5, triple letter, empty" [ref=e148] [cursor=pointer]:
            - generic [ref=e149]: 3L
          - button "d5, empty" [ref=e150] [cursor=pointer]
          - button "e5, empty" [ref=e151] [cursor=pointer]
          - button "f5, empty" [ref=e152] [cursor=pointer]
          - button "2L, g5, double letter, empty" [ref=e153] [cursor=pointer]:
            - generic [ref=e154]: 2L
          - button "h5, empty" [ref=e155] [cursor=pointer]
          - button "2L, i5, double letter, empty" [ref=e156] [cursor=pointer]:
            - generic [ref=e157]: 2L
          - button "j5, empty" [ref=e158] [cursor=pointer]
          - button "k5, empty" [ref=e159] [cursor=pointer]
          - button "l5, empty" [ref=e160] [cursor=pointer]
          - button "3L, m5, triple letter, empty" [ref=e161] [cursor=pointer]:
            - generic [ref=e162]: 3L
          - button "n5, empty" [ref=e163] [cursor=pointer]
          - button "3W, o5, triple word, empty" [ref=e164] [cursor=pointer]:
            - generic [ref=e165]: 3W
          - generic [ref=e166]: "6"
          - button "a6, empty" [ref=e167] [cursor=pointer]
          - button "b6, empty" [ref=e168] [cursor=pointer]
          - button "c6, empty" [ref=e169] [cursor=pointer]
          - button "d6, empty" [ref=e170] [cursor=pointer]
          - button "e6, empty" [ref=e171] [cursor=pointer]
          - button "f6, empty" [ref=e172] [cursor=pointer]
          - button "g6, empty" [ref=e173] [cursor=pointer]
          - button "3L, h6, triple letter, empty" [ref=e174] [cursor=pointer]:
            - generic [ref=e175]: 3L
          - button "i6, empty" [ref=e176] [cursor=pointer]
          - button "j6, empty" [ref=e177] [cursor=pointer]
          - button "k6, empty" [ref=e178] [cursor=pointer]
          - button "l6, empty" [ref=e179] [cursor=pointer]
          - button "m6, empty" [ref=e180] [cursor=pointer]
          - button "n6, empty" [ref=e181] [cursor=pointer]
          - button "o6, empty" [ref=e182] [cursor=pointer]
          - generic [ref=e183]: "7"
          - button "a7, empty" [ref=e184] [cursor=pointer]
          - button "2W, b7, double word, empty" [ref=e185] [cursor=pointer]:
            - generic [ref=e186]: 2W
          - button "c7, empty" [ref=e187] [cursor=pointer]
          - button "d7, empty" [ref=e188] [cursor=pointer]
          - button "2L, e7, double letter, empty" [ref=e189] [cursor=pointer]:
            - generic [ref=e190]: 2L
          - button "f7, empty" [ref=e191] [cursor=pointer]
          - button "2L, g7, double letter, empty" [ref=e192] [cursor=pointer]:
            - generic [ref=e193]: 2L
          - button "h7, empty" [ref=e194] [cursor=pointer]
          - button "2L, i7, double letter, empty" [ref=e195] [cursor=pointer]:
            - generic [ref=e196]: 2L
          - button "j7, empty" [ref=e197] [cursor=pointer]
          - button "2L, k7, double letter, empty" [ref=e198] [cursor=pointer]:
            - generic [ref=e199]: 2L
          - button "l7, empty" [ref=e200] [cursor=pointer]
          - button "m7, empty" [ref=e201] [cursor=pointer]
          - button "2W, n7, double word, empty" [ref=e202] [cursor=pointer]:
            - generic [ref=e203]: 2W
          - button "o7, empty" [ref=e204] [cursor=pointer]
          - generic [ref=e205]: "8"
          - button "2L, a8, double letter, empty" [ref=e206] [cursor=pointer]:
            - generic [ref=e207]: 2L
          - button "b8, empty" [ref=e208] [cursor=pointer]
          - button "c8, empty" [ref=e209] [cursor=pointer]
          - button "d8, empty" [ref=e210] [cursor=pointer]
          - button "e8, empty" [ref=e211] [cursor=pointer]
          - button "3L, f8, triple letter, empty" [ref=e212] [cursor=pointer]:
            - generic [ref=e213]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e214]:
            - generic [ref=e215]: C
            - generic [ref=e216]: "3"
          - button "A 1, h8, committed" [disabled] [active] [ref=e217]:
            - generic [ref=e218]: A
            - generic [ref=e219]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e220]:
            - generic [ref=e221]: T
            - generic [ref=e222]: "1"
          - button "3L, j8, triple letter, empty" [ref=e223] [cursor=pointer]:
            - generic [ref=e224]: 3L
          - button "k8, empty" [ref=e225] [cursor=pointer]
          - button "l8, empty" [ref=e226] [cursor=pointer]
          - button "m8, empty" [ref=e227] [cursor=pointer]
          - button "n8, empty" [ref=e228] [cursor=pointer]
          - button "2L, o8, double letter, empty" [ref=e229] [cursor=pointer]:
            - generic [ref=e230]: 2L
          - generic [ref=e231]: "9"
          - button "a9, empty" [ref=e232] [cursor=pointer]
          - button "2W, b9, double word, empty" [ref=e233] [cursor=pointer]:
            - generic [ref=e234]: 2W
          - button "c9, empty" [ref=e235] [cursor=pointer]
          - button "d9, empty" [ref=e236] [cursor=pointer]
          - button "2L, e9, double letter, empty" [ref=e237] [cursor=pointer]:
            - generic [ref=e238]: 2L
          - button "f9, empty" [ref=e239] [cursor=pointer]
          - button "2L, g9, double letter, empty" [ref=e240] [cursor=pointer]:
            - generic [ref=e241]: 2L
          - button "h9, empty" [ref=e242] [cursor=pointer]
          - button "O 1, i9, committed" [disabled] [ref=e243]:
            - generic [ref=e244]: O
            - generic [ref=e245]: "1"
          - button "j9, empty" [ref=e246] [cursor=pointer]
          - button "2L, k9, double letter, empty" [ref=e247] [cursor=pointer]:
            - generic [ref=e248]: 2L
          - button "l9, empty" [ref=e249] [cursor=pointer]
          - button "m9, empty" [ref=e250] [cursor=pointer]
          - button "2W, n9, double word, empty" [ref=e251] [cursor=pointer]:
            - generic [ref=e252]: 2W
          - button "o9, empty" [ref=e253] [cursor=pointer]
          - generic [ref=e254]: "10"
          - button "a10, empty" [ref=e255] [cursor=pointer]
          - button "b10, empty" [ref=e256] [cursor=pointer]
          - button "c10, empty" [ref=e257] [cursor=pointer]
          - button "d10, empty" [ref=e258] [cursor=pointer]
          - button "e10, empty" [ref=e259] [cursor=pointer]
          - button "f10, empty" [ref=e260] [cursor=pointer]
          - button "g10, empty" [ref=e261] [cursor=pointer]
          - button "3L, h10, triple letter, empty" [ref=e262] [cursor=pointer]:
            - generic [ref=e263]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e264]:
            - generic [ref=e265]: E
            - generic [ref=e266]: "1"
          - button "j10, empty" [ref=e267] [cursor=pointer]
          - button "k10, empty" [ref=e268] [cursor=pointer]
          - button "l10, empty" [ref=e269] [cursor=pointer]
          - button "m10, empty" [ref=e270] [cursor=pointer]
          - button "n10, empty" [ref=e271] [cursor=pointer]
          - button "o10, empty" [ref=e272] [cursor=pointer]
          - generic [ref=e273]: "11"
          - button "3W, a11, triple word, empty" [ref=e274] [cursor=pointer]:
            - generic [ref=e275]: 3W
          - button "b11, empty" [ref=e276] [cursor=pointer]
          - button "3L, c11, triple letter, empty" [ref=e277] [cursor=pointer]:
            - generic [ref=e278]: 3L
          - button "d11, empty" [ref=e279] [cursor=pointer]
          - button "e11, empty" [ref=e280] [cursor=pointer]
          - button "f11, empty" [ref=e281] [cursor=pointer]
          - button "2L, g11, double letter, empty" [ref=e282] [cursor=pointer]:
            - generic [ref=e283]: 2L
          - button "h11, empty" [ref=e284] [cursor=pointer]
          - button "2L, i11, double letter, empty" [ref=e285] [cursor=pointer]:
            - generic [ref=e286]: 2L
          - button "j11, empty" [ref=e287] [cursor=pointer]
          - button "k11, empty" [ref=e288] [cursor=pointer]
          - button "l11, empty" [ref=e289] [cursor=pointer]
          - button "3L, m11, triple letter, empty" [ref=e290] [cursor=pointer]:
            - generic [ref=e291]: 3L
          - button "n11, empty" [ref=e292] [cursor=pointer]
          - button "3W, o11, triple word, empty" [ref=e293] [cursor=pointer]:
            - generic [ref=e294]: 3W
          - generic [ref=e295]: "12"
          - button "a12, empty" [ref=e296] [cursor=pointer]
          - button "2L, b12, double letter, empty" [ref=e297] [cursor=pointer]:
            - generic [ref=e298]: 2L
          - button "c12, empty" [ref=e299] [cursor=pointer]
          - button "2W, d12, double word, empty" [ref=e300] [cursor=pointer]:
            - generic [ref=e301]: 2W
          - button "e12, empty" [ref=e302] [cursor=pointer]
          - button "f12, empty" [ref=e303] [cursor=pointer]
          - button "g12, empty" [ref=e304] [cursor=pointer]
          - button "h12, empty" [ref=e305] [cursor=pointer]
          - button "i12, empty" [ref=e306] [cursor=pointer]
          - button "j12, empty" [ref=e307] [cursor=pointer]
          - button "k12, empty" [ref=e308] [cursor=pointer]
          - button "2W, l12, double word, empty" [ref=e309] [cursor=pointer]:
            - generic [ref=e310]: 2W
          - button "m12, empty" [ref=e311] [cursor=pointer]
          - button "2L, n12, double letter, empty" [ref=e312] [cursor=pointer]:
            - generic [ref=e313]: 2L
          - button "o12, empty" [ref=e314] [cursor=pointer]
          - generic [ref=e315]: "13"
          - button "a13, empty" [ref=e316] [cursor=pointer]
          - button "b13, empty" [ref=e317] [cursor=pointer]
          - button "c13, empty" [ref=e318] [cursor=pointer]
          - button "d13, empty" [ref=e319] [cursor=pointer]
          - button "3L, e13, triple letter, empty" [ref=e320] [cursor=pointer]:
            - generic [ref=e321]: 3L
          - button "f13, empty" [ref=e322] [cursor=pointer]
          - button "g13, empty" [ref=e323] [cursor=pointer]
          - button "h13, empty" [ref=e324] [cursor=pointer]
          - button "i13, empty" [ref=e325] [cursor=pointer]
          - button "j13, empty" [ref=e326] [cursor=pointer]
          - button "3L, k13, triple letter, empty" [ref=e327] [cursor=pointer]:
            - generic [ref=e328]: 3L
          - button "l13, empty" [ref=e329] [cursor=pointer]
          - button "m13, empty" [ref=e330] [cursor=pointer]
          - button "n13, empty" [ref=e331] [cursor=pointer]
          - button "o13, empty" [ref=e332] [cursor=pointer]
          - generic [ref=e333]: "14"
          - button "a14, empty" [ref=e334] [cursor=pointer]
          - button "b14, empty" [ref=e335] [cursor=pointer]
          - button "c14, empty" [ref=e336] [cursor=pointer]
          - button "2L, d14, double letter, empty" [ref=e337] [cursor=pointer]:
            - generic [ref=e338]: 2L
          - button "e14, empty" [ref=e339] [cursor=pointer]
          - button "f14, empty" [ref=e340] [cursor=pointer]
          - button "2W, g14, double word, empty" [ref=e341] [cursor=pointer]:
            - generic [ref=e342]: 2W
          - button "h14, empty" [ref=e343] [cursor=pointer]
          - button "2W, i14, double word, empty" [ref=e344] [cursor=pointer]:
            - generic [ref=e345]: 2W
          - button "j14, empty" [ref=e346] [cursor=pointer]
          - button "k14, empty" [ref=e347] [cursor=pointer]
          - button "2L, l14, double letter, empty" [ref=e348] [cursor=pointer]:
            - generic [ref=e349]: 2L
          - button "m14, empty" [ref=e350] [cursor=pointer]
          - button "n14, empty" [ref=e351] [cursor=pointer]
          - button "o14, empty" [ref=e352] [cursor=pointer]
          - generic [ref=e353]: "15"
          - button "2L, a15, double letter, empty" [ref=e354] [cursor=pointer]:
            - generic [ref=e355]: 2L
          - button "b15, empty" [ref=e356] [cursor=pointer]
          - button "c15, empty" [ref=e357] [cursor=pointer]
          - button "d15, empty" [ref=e358] [cursor=pointer]
          - button "3W, e15, triple word, empty" [ref=e359] [cursor=pointer]:
            - generic [ref=e360]: 3W
          - button "f15, empty" [ref=e361] [cursor=pointer]
          - button "g15, empty" [ref=e362] [cursor=pointer]
          - button "2L, h15, double letter, empty" [ref=e363] [cursor=pointer]:
            - generic [ref=e364]: 2L
          - button "i15, empty" [ref=e365] [cursor=pointer]
          - button "j15, empty" [ref=e366] [cursor=pointer]
          - button "3W, k15, triple word, empty" [ref=e367] [cursor=pointer]:
            - generic [ref=e368]: 3W
          - button "l15, empty" [ref=e369] [cursor=pointer]
          - button "m15, empty" [ref=e370] [cursor=pointer]
          - button "n15, empty" [ref=e371] [cursor=pointer]
          - button "2L, o15, double letter, empty" [ref=e372] [cursor=pointer]:
            - generic [ref=e373]: 2L
      - generic [ref=e374]:
        - generic [ref=e375]:
          - img "Whole board overview; outline shows the enlarged area" [ref=e376]
          - group "View a board region" [ref=e603]:
            - button "View a1 to e5" [ref=e604] [cursor=pointer]
            - button "View f1 to j5" [ref=e605] [cursor=pointer]
            - button "View k1 to o5" [ref=e606] [cursor=pointer]
            - button "View a6 to e10" [ref=e607] [cursor=pointer]
            - button "View f6 to j10" [ref=e608] [cursor=pointer]
            - button "View k6 to o10" [ref=e609] [cursor=pointer]
            - button "View a11 to e15" [ref=e610] [cursor=pointer]
            - button "View f11 to j15" [ref=e611] [cursor=pointer]
            - button "View k11 to o15" [ref=e612] [cursor=pointer]
        - generic [ref=e613]:
          - generic [ref=e614]:
            - button "Fit board" [ref=e615] [cursor=pointer]:
              - paragraph [ref=e618]: Fit board
            - button "Enlarge board" [pressed] [ref=e619] [cursor=pointer]:
              - paragraph [ref=e622]: Enlarge board
          - paragraph [ref=e623]: A 1, h8, committed
          - 'button "Board map: locate a square" [ref=e624] [cursor=pointer]': Map
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
> 49 |   expect(violations).toEqual([]);
     |                      ^ Error: expect(received).toEqual(expected) // deep equality
  50 |   expect(failures).toEqual([]);
  51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```