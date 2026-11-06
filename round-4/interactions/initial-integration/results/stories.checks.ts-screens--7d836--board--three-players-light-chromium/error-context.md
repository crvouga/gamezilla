# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--three-players light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  97698 pixels (ratio 0.30 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/three-players-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/three-players-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 97698 pixels (ratio 0.30 of all image pixels) are different.
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
  - 97698 pixels (ratio 0.30 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Word Tiles" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Amber — to play · 74 tiles in the bag
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - list "Players" [ref=e40]:
            - listitem [ref=e41]:
              - generic [ref=e44]:
                - generic [ref=e45]: avery
                - generic [ref=e46]:
                  - generic [ref=e48]: Score 10
                  - generic [ref=e50]: You
                  - generic [ref=e52]: 7 tiles
            - listitem [ref=e53]:
              - generic [ref=e55]:
                - generic [ref=e56]: jordan_plays
                - generic [ref=e57]:
                  - generic [ref=e59]: Score 3
                  - generic [ref=e61]: 7 tiles
            - listitem [ref=e62]:
              - generic [ref=e64]:
                - generic [ref=e65]: morgan
                - generic [ref=e66]:
                  - generic [ref=e68]: Score 0
                  - generic [ref=e70]: 7 tiles
          - generic [ref=e72]:
            - group "Your rack" [ref=e73]:
              - button "O, 1 points" [ref=e74] [cursor=pointer]:
                - generic [ref=e75]: O
                - generic [ref=e76]: "1"
              - button "E, 1 points" [ref=e77] [cursor=pointer]:
                - generic [ref=e78]: E
                - generic [ref=e79]: "1"
              - button "R, 1 points" [ref=e80] [cursor=pointer]:
                - generic [ref=e81]: R
                - generic [ref=e82]: "1"
              - button "T, 1 points" [ref=e83] [cursor=pointer]:
                - generic [ref=e84]: T
                - generic [ref=e85]: "1"
              - button "I, 1 points" [ref=e86] [cursor=pointer]:
                - generic [ref=e87]: I
                - generic [ref=e88]: "1"
              - button "N, 1 points" [ref=e89] [cursor=pointer]:
                - generic [ref=e90]: "N"
                - generic [ref=e91]: "1"
              - button "Blank, 0 points" [ref=e92] [cursor=pointer]:
                - generic [ref=e93]: "0"
            - generic [ref=e94]:
              - group "Word actions" [ref=e95]:
                - button "Play word" [disabled] [ref=e96]:
                  - paragraph [ref=e99]: Play word
                - button "Recall tiles" [disabled] [ref=e100]:
                  - paragraph [ref=e103]: Recall tiles
                - button "Undo" [disabled] [ref=e104]:
                  - paragraph [ref=e107]: Undo
                - button "Redo" [disabled] [ref=e108]:
                  - paragraph [ref=e111]: Redo
                - button "Shuffle rack" [ref=e112] [cursor=pointer]:
                  - paragraph [ref=e115]: Shuffle rack
                - button "Pass" [ref=e116] [cursor=pointer]:
                  - paragraph [ref=e119]: Pass
                - button "Exchange tiles" [ref=e120] [cursor=pointer]:
                  - paragraph [ref=e123]: Exchange tiles
              - status [ref=e126]: Choose a tile, then a square.
            - generic [ref=e127]:
              - generic [ref=e128]:
                - button "Fit board" [pressed] [ref=e129] [cursor=pointer]:
                  - paragraph [ref=e132]: Fit board
                - button "Enlarge board" [ref=e133] [cursor=pointer]:
                  - paragraph [ref=e136]: Enlarge board
              - region "Scrollable word board" [ref=e138]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e139]:
                  - generic [ref=e141]: a
                  - generic [ref=e142]: b
                  - generic [ref=e143]: c
                  - generic [ref=e144]: d
                  - generic [ref=e145]: e
                  - generic [ref=e146]: f
                  - generic [ref=e147]: g
                  - generic [ref=e148]: h
                  - generic [ref=e149]: i
                  - generic [ref=e150]: j
                  - generic [ref=e151]: k
                  - generic [ref=e152]: l
                  - generic [ref=e153]: m
                  - generic [ref=e154]: "n"
                  - generic [ref=e155]: o
                  - generic [ref=e156]: "1"
                  - button "2L, a1, double letter, empty" [ref=e157] [cursor=pointer]:
                    - generic [ref=e158]: 2L
                  - button "b1, empty" [ref=e159] [cursor=pointer]
                  - button "c1, empty" [ref=e160] [cursor=pointer]
                  - button "d1, empty" [ref=e161] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e162] [cursor=pointer]:
                    - generic [ref=e163]: 3W
                  - button "f1, empty" [ref=e164] [cursor=pointer]
                  - button "g1, empty" [ref=e165] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e166] [cursor=pointer]:
                    - generic [ref=e167]: 2L
                  - button "i1, empty" [ref=e168] [cursor=pointer]
                  - button "j1, empty" [ref=e169] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e170] [cursor=pointer]:
                    - generic [ref=e171]: 3W
                  - button "l1, empty" [ref=e172] [cursor=pointer]
                  - button "m1, empty" [ref=e173] [cursor=pointer]
                  - button "n1, empty" [ref=e174] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e175] [cursor=pointer]:
                    - generic [ref=e176]: 2L
                  - generic [ref=e177]: "2"
                  - button "a2, empty" [ref=e178] [cursor=pointer]
                  - button "b2, empty" [ref=e179] [cursor=pointer]
                  - button "c2, empty" [ref=e180] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e181] [cursor=pointer]:
                    - generic [ref=e182]: 2L
                  - button "e2, empty" [ref=e183] [cursor=pointer]
                  - button "f2, empty" [ref=e184] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e185] [cursor=pointer]:
                    - generic [ref=e186]: 2W
                  - button "h2, empty" [ref=e187] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e188] [cursor=pointer]:
                    - generic [ref=e189]: 2W
                  - button "j2, empty" [ref=e190] [cursor=pointer]
                  - button "k2, empty" [ref=e191] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e192] [cursor=pointer]:
                    - generic [ref=e193]: 2L
                  - button "m2, empty" [ref=e194] [cursor=pointer]
                  - button "n2, empty" [ref=e195] [cursor=pointer]
                  - button "o2, empty" [ref=e196] [cursor=pointer]
                  - generic [ref=e197]: "3"
                  - button "a3, empty" [ref=e198] [cursor=pointer]
                  - button "b3, empty" [ref=e199] [cursor=pointer]
                  - button "c3, empty" [ref=e200] [cursor=pointer]
                  - button "d3, empty" [ref=e201] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e202] [cursor=pointer]:
                    - generic [ref=e203]: 3L
                  - button "f3, empty" [ref=e204] [cursor=pointer]
                  - button "g3, empty" [ref=e205] [cursor=pointer]
                  - button "h3, empty" [ref=e206] [cursor=pointer]
                  - button "i3, empty" [ref=e207] [cursor=pointer]
                  - button "j3, empty" [ref=e208] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e209] [cursor=pointer]:
                    - generic [ref=e210]: 3L
                  - button "l3, empty" [ref=e211] [cursor=pointer]
                  - button "m3, empty" [ref=e212] [cursor=pointer]
                  - button "n3, empty" [ref=e213] [cursor=pointer]
                  - button "o3, empty" [ref=e214] [cursor=pointer]
                  - generic [ref=e215]: "4"
                  - button "a4, empty" [ref=e216] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e217] [cursor=pointer]:
                    - generic [ref=e218]: 2L
                  - button "c4, empty" [ref=e219] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e220] [cursor=pointer]:
                    - generic [ref=e221]: 2W
                  - button "e4, empty" [ref=e222] [cursor=pointer]
                  - button "f4, empty" [ref=e223] [cursor=pointer]
                  - button "g4, empty" [ref=e224] [cursor=pointer]
                  - button "h4, empty" [ref=e225] [cursor=pointer]
                  - button "i4, empty" [ref=e226] [cursor=pointer]
                  - button "j4, empty" [ref=e227] [cursor=pointer]
                  - button "k4, empty" [ref=e228] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e229] [cursor=pointer]:
                    - generic [ref=e230]: 2W
                  - button "m4, empty" [ref=e231] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e232] [cursor=pointer]:
                    - generic [ref=e233]: 2L
                  - button "o4, empty" [ref=e234] [cursor=pointer]
                  - generic [ref=e235]: "5"
                  - button "3W, a5, triple word, empty" [ref=e236] [cursor=pointer]:
                    - generic [ref=e237]: 3W
                  - button "b5, empty" [ref=e238] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e239] [cursor=pointer]:
                    - generic [ref=e240]: 3L
                  - button "d5, empty" [ref=e241] [cursor=pointer]
                  - button "e5, empty" [ref=e242] [cursor=pointer]
                  - button "f5, empty" [ref=e243] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e244] [cursor=pointer]:
                    - generic [ref=e245]: 2L
                  - button "h5, empty" [ref=e246] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e247] [cursor=pointer]:
                    - generic [ref=e248]: 2L
                  - button "j5, empty" [ref=e249] [cursor=pointer]
                  - button "k5, empty" [ref=e250] [cursor=pointer]
                  - button "l5, empty" [ref=e251] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e252] [cursor=pointer]:
                    - generic [ref=e253]: 3L
                  - button "n5, empty" [ref=e254] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e255] [cursor=pointer]:
                    - generic [ref=e256]: 3W
                  - generic [ref=e257]: "6"
                  - button "a6, empty" [ref=e258] [cursor=pointer]
                  - button "b6, empty" [ref=e259] [cursor=pointer]
                  - button "c6, empty" [ref=e260] [cursor=pointer]
                  - button "d6, empty" [ref=e261] [cursor=pointer]
                  - button "e6, empty" [ref=e262] [cursor=pointer]
                  - button "f6, empty" [ref=e263] [cursor=pointer]
                  - button "g6, empty" [ref=e264] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e265] [cursor=pointer]:
                    - generic [ref=e266]: 3L
                  - button "i6, empty" [ref=e267] [cursor=pointer]
                  - button "j6, empty" [ref=e268] [cursor=pointer]
                  - button "k6, empty" [ref=e269] [cursor=pointer]
                  - button "l6, empty" [ref=e270] [cursor=pointer]
                  - button "m6, empty" [ref=e271] [cursor=pointer]
                  - button "n6, empty" [ref=e272] [cursor=pointer]
                  - button "o6, empty" [ref=e273] [cursor=pointer]
                  - generic [ref=e274]: "7"
                  - button "a7, empty" [ref=e275] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e276] [cursor=pointer]:
                    - generic [ref=e277]: 2W
                  - button "c7, empty" [ref=e278] [cursor=pointer]
                  - button "d7, empty" [ref=e279] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e280] [cursor=pointer]:
                    - generic [ref=e281]: 2L
                  - button "f7, empty" [ref=e282] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e283] [cursor=pointer]:
                    - generic [ref=e284]: 2L
                  - button "h7, empty" [ref=e285] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e286] [cursor=pointer]:
                    - generic [ref=e287]: 2L
                  - button "j7, empty" [ref=e288] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e289] [cursor=pointer]:
                    - generic [ref=e290]: 2L
                  - button "l7, empty" [ref=e291] [cursor=pointer]
                  - button "m7, empty" [ref=e292] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e293] [cursor=pointer]:
                    - generic [ref=e294]: 2W
                  - button "o7, empty" [ref=e295] [cursor=pointer]
                  - generic [ref=e296]: "8"
                  - button "2L, a8, double letter, empty" [ref=e297] [cursor=pointer]:
                    - generic [ref=e298]: 2L
                  - button "b8, empty" [ref=e299] [cursor=pointer]
                  - button "c8, empty" [ref=e300] [cursor=pointer]
                  - button "d8, empty" [ref=e301] [cursor=pointer]
                  - button "e8, empty" [ref=e302] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e303] [cursor=pointer]:
                    - generic [ref=e304]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e305]:
                    - generic [ref=e306]: C
                  - button "A 1, h8, committed" [disabled] [ref=e307]:
                    - generic [ref=e308]: A
                  - button "T 1, i8, committed" [disabled] [ref=e309]:
                    - generic [ref=e310]: T
                  - button "3L, j8, triple letter, empty" [ref=e311] [cursor=pointer]:
                    - generic [ref=e312]: 3L
                  - button "k8, empty" [ref=e313] [cursor=pointer]
                  - button "l8, empty" [ref=e314] [cursor=pointer]
                  - button "m8, empty" [ref=e315] [cursor=pointer]
                  - button "n8, empty" [ref=e316] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e317] [cursor=pointer]:
                    - generic [ref=e318]: 2L
                  - generic [ref=e319]: "9"
                  - button "a9, empty" [ref=e320] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e321] [cursor=pointer]:
                    - generic [ref=e322]: 2W
                  - button "c9, empty" [ref=e323] [cursor=pointer]
                  - button "d9, empty" [ref=e324] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e325] [cursor=pointer]:
                    - generic [ref=e326]: 2L
                  - button "f9, empty" [ref=e327] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e328] [cursor=pointer]:
                    - generic [ref=e329]: 2L
                  - button "h9, empty" [ref=e330] [cursor=pointer]
                  - button "O 1, i9, committed" [disabled] [ref=e331]:
                    - generic [ref=e332]: O
                  - button "j9, empty" [ref=e333] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e334] [cursor=pointer]:
                    - generic [ref=e335]: 2L
                  - button "l9, empty" [ref=e336] [cursor=pointer]
                  - button "m9, empty" [ref=e337] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e338] [cursor=pointer]:
                    - generic [ref=e339]: 2W
                  - button "o9, empty" [ref=e340] [cursor=pointer]
                  - generic [ref=e341]: "10"
                  - button "a10, empty" [ref=e342] [cursor=pointer]
                  - button "b10, empty" [ref=e343] [cursor=pointer]
                  - button "c10, empty" [ref=e344] [cursor=pointer]
                  - button "d10, empty" [ref=e345] [cursor=pointer]
                  - button "e10, empty" [ref=e346] [cursor=pointer]
                  - button "f10, empty" [ref=e347] [cursor=pointer]
                  - button "g10, empty" [ref=e348] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e349] [cursor=pointer]:
                    - generic [ref=e350]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e351]:
                    - generic [ref=e352]: E
                  - button "j10, empty" [ref=e353] [cursor=pointer]
                  - button "k10, empty" [ref=e354] [cursor=pointer]
                  - button "l10, empty" [ref=e355] [cursor=pointer]
                  - button "m10, empty" [ref=e356] [cursor=pointer]
                  - button "n10, empty" [ref=e357] [cursor=pointer]
                  - button "o10, empty" [ref=e358] [cursor=pointer]
                  - generic [ref=e359]: "11"
                  - button "3W, a11, triple word, empty" [ref=e360] [cursor=pointer]:
                    - generic [ref=e361]: 3W
                  - button "b11, empty" [ref=e362] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e363] [cursor=pointer]:
                    - generic [ref=e364]: 3L
                  - button "d11, empty" [ref=e365] [cursor=pointer]
                  - button "e11, empty" [ref=e366] [cursor=pointer]
                  - button "f11, empty" [ref=e367] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e368] [cursor=pointer]:
                    - generic [ref=e369]: 2L
                  - button "h11, empty" [ref=e370] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e371] [cursor=pointer]:
                    - generic [ref=e372]: 2L
                  - button "j11, empty" [ref=e373] [cursor=pointer]
                  - button "k11, empty" [ref=e374] [cursor=pointer]
                  - button "l11, empty" [ref=e375] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e376] [cursor=pointer]:
                    - generic [ref=e377]: 3L
                  - button "n11, empty" [ref=e378] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e379] [cursor=pointer]:
                    - generic [ref=e380]: 3W
                  - generic [ref=e381]: "12"
                  - button "a12, empty" [ref=e382] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e383] [cursor=pointer]:
                    - generic [ref=e384]: 2L
                  - button "c12, empty" [ref=e385] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e386] [cursor=pointer]:
                    - generic [ref=e387]: 2W
                  - button "e12, empty" [ref=e388] [cursor=pointer]
                  - button "f12, empty" [ref=e389] [cursor=pointer]
                  - button "g12, empty" [ref=e390] [cursor=pointer]
                  - button "h12, empty" [ref=e391] [cursor=pointer]
                  - button "i12, empty" [ref=e392] [cursor=pointer]
                  - button "j12, empty" [ref=e393] [cursor=pointer]
                  - button "k12, empty" [ref=e394] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e395] [cursor=pointer]:
                    - generic [ref=e396]: 2W
                  - button "m12, empty" [ref=e397] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e398] [cursor=pointer]:
                    - generic [ref=e399]: 2L
                  - button "o12, empty" [ref=e400] [cursor=pointer]
                  - generic [ref=e401]: "13"
                  - button "a13, empty" [ref=e402] [cursor=pointer]
                  - button "b13, empty" [ref=e403] [cursor=pointer]
                  - button "c13, empty" [ref=e404] [cursor=pointer]
                  - button "d13, empty" [ref=e405] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e406] [cursor=pointer]:
                    - generic [ref=e407]: 3L
                  - button "f13, empty" [ref=e408] [cursor=pointer]
                  - button "g13, empty" [ref=e409] [cursor=pointer]
                  - button "h13, empty" [ref=e410] [cursor=pointer]
                  - button "i13, empty" [ref=e411] [cursor=pointer]
                  - button "j13, empty" [ref=e412] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e413] [cursor=pointer]:
                    - generic [ref=e414]: 3L
                  - button "l13, empty" [ref=e415] [cursor=pointer]
                  - button "m13, empty" [ref=e416] [cursor=pointer]
                  - button "n13, empty" [ref=e417] [cursor=pointer]
                  - button "o13, empty" [ref=e418] [cursor=pointer]
                  - generic [ref=e419]: "14"
                  - button "a14, empty" [ref=e420] [cursor=pointer]
                  - button "b14, empty" [ref=e421] [cursor=pointer]
                  - button "c14, empty" [ref=e422] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e423] [cursor=pointer]:
                    - generic [ref=e424]: 2L
                  - button "e14, empty" [ref=e425] [cursor=pointer]
                  - button "f14, empty" [ref=e426] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e427] [cursor=pointer]:
                    - generic [ref=e428]: 2W
                  - button "h14, empty" [ref=e429] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e430] [cursor=pointer]:
                    - generic [ref=e431]: 2W
                  - button "j14, empty" [ref=e432] [cursor=pointer]
                  - button "k14, empty" [ref=e433] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e434] [cursor=pointer]:
                    - generic [ref=e435]: 2L
                  - button "m14, empty" [ref=e436] [cursor=pointer]
                  - button "n14, empty" [ref=e437] [cursor=pointer]
                  - button "o14, empty" [ref=e438] [cursor=pointer]
                  - generic [ref=e439]: "15"
                  - button "2L, a15, double letter, empty" [ref=e440] [cursor=pointer]:
                    - generic [ref=e441]: 2L
                  - button "b15, empty" [ref=e442] [cursor=pointer]
                  - button "c15, empty" [ref=e443] [cursor=pointer]
                  - button "d15, empty" [ref=e444] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e445] [cursor=pointer]:
                    - generic [ref=e446]: 3W
                  - button "f15, empty" [ref=e447] [cursor=pointer]
                  - button "g15, empty" [ref=e448] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e449] [cursor=pointer]:
                    - generic [ref=e450]: 2L
                  - button "i15, empty" [ref=e451] [cursor=pointer]
                  - button "j15, empty" [ref=e452] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e453] [cursor=pointer]:
                    - generic [ref=e454]: 3W
                  - button "l15, empty" [ref=e455] [cursor=pointer]
                  - button "m15, empty" [ref=e456] [cursor=pointer]
                  - button "n15, empty" [ref=e457] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e458] [cursor=pointer]:
                    - generic [ref=e459]: 2L
          - status [ref=e461]:
            - generic [ref=e462]:
              - generic [ref=e463]: "Amber: avery. Teal: jordan_plays. Violet: morgan."
              - text: Amber — to play · 74 tiles in the bag
        - generic [ref=e466]:
          - group "Game actions" [ref=e467]:
            - button "Offer draw" [ref=e468] [cursor=pointer]:
              - paragraph [ref=e471]: Offer draw
            - button "Resign game" [ref=e472] [cursor=pointer]:
              - paragraph [ref=e475]:
                - text: Resign
                - generic [ref=e476]: game
          - button "History and stats" [ref=e477] [cursor=pointer]:
            - generic [ref=e479]:
              - paragraph [ref=e480]: History and stats
              - img [ref=e483]
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