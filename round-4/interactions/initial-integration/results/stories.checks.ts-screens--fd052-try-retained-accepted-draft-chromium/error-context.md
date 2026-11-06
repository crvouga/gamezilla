# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--recover-and-submit regression word-tiles-retry-retained-accepted-draft
- Location: tests/storybook/stories.checks.ts:222:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  94372 pixels (ratio 0.29 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recover-and-submit-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recover-and-submit-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 94372 pixels (ratio 0.29 of all image pixels) are different.
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
  - 94372 pixels (ratio 0.29 of all image pixels) are different.

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
        - paragraph [ref=e24]: Teal — to play · 83 tiles in the bag
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - generic [ref=e45]:
              - generic [ref=e46]:
                - img "Teal" [ref=e47]
                - generic [ref=e48]: jordan_plays
                - generic [ref=e49]: To move
              - generic [ref=e52]: 7 tiles
            - generic [ref=e53]:
              - generic [ref=e54]: Score
              - generic [ref=e55]: "0"
          - generic [ref=e57]:
            - group "Your rack" [ref=e58]:
              - button "Blank, 0 points" [ref=e59] [cursor=pointer]:
                - generic [ref=e60]: "0"
              - button "E, 1 points" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: E
                - generic [ref=e63]: "1"
              - button "S, 1 points" [ref=e64] [cursor=pointer]:
                - generic [ref=e65]: S
                - generic [ref=e66]: "1"
              - button "Q, 10 points" [ref=e67] [cursor=pointer]:
                - generic [ref=e68]: Q
                - generic [ref=e69]: "10"
              - button "A, 1 points" [ref=e70] [cursor=pointer]:
                - generic [ref=e71]: A
                - generic [ref=e72]: "1"
              - button "B, 3 points" [ref=e73] [cursor=pointer]:
                - generic [ref=e74]: B
                - generic [ref=e75]: "3"
              - button "B, 3 points" [ref=e76] [cursor=pointer]:
                - generic [ref=e77]: B
                - generic [ref=e78]: "3"
            - generic [ref=e79]:
              - group "Word actions" [ref=e80]:
                - button "Play word" [disabled] [ref=e81]:
                  - paragraph [ref=e84]: Play word
                - button "Recall tiles" [disabled] [ref=e85]:
                  - paragraph [ref=e88]: Recall tiles
                - button "Undo" [disabled] [ref=e89]:
                  - paragraph [ref=e92]: Undo
                - button "Redo" [disabled] [ref=e93]:
                  - paragraph [ref=e96]: Redo
                - button "Shuffle rack" [ref=e97] [cursor=pointer]:
                  - paragraph [ref=e100]: Shuffle rack
                - button "Pass" [disabled] [ref=e101]:
                  - paragraph [ref=e104]: Pass
                - button "Exchange tiles" [disabled] [ref=e105]:
                  - paragraph [ref=e108]: Exchange tiles
              - generic [ref=e109]:
                - paragraph [ref=e110]: You can plan a word while you wait. Play it when your turn begins.
                - status [ref=e112]: Choose a tile, then a square.
            - generic [ref=e113]:
              - generic [ref=e114]:
                - button "Fit board" [ref=e115] [cursor=pointer]:
                  - paragraph [ref=e118]: Fit board
                - button "Enlarge board" [pressed] [ref=e119] [cursor=pointer]:
                  - paragraph [ref=e122]: Enlarge board
              - paragraph [ref=e123]: Scroll to explore. Arrow keys move between squares; Enter places your selected tile.
              - generic [ref=e124]:
                - region "Scrollable word board" [ref=e125]:
                  - group "Word board, fifteen columns and fifteen rows" [ref=e126]:
                    - generic [ref=e128]: a
                    - generic [ref=e129]: b
                    - generic [ref=e130]: c
                    - generic [ref=e131]: d
                    - generic [ref=e132]: e
                    - generic [ref=e133]: f
                    - generic [ref=e134]: g
                    - generic [ref=e135]: h
                    - generic [ref=e136]: i
                    - generic [ref=e137]: j
                    - generic [ref=e138]: k
                    - generic [ref=e139]: l
                    - generic [ref=e140]: m
                    - generic [ref=e141]: "n"
                    - generic [ref=e142]: o
                    - generic [ref=e143]: "1"
                    - button "2L, a1, double letter, empty" [ref=e144] [cursor=pointer]:
                      - generic [ref=e145]: 2L
                    - button "b1, empty" [ref=e146] [cursor=pointer]
                    - button "c1, empty" [ref=e147] [cursor=pointer]
                    - button "d1, empty" [ref=e148] [cursor=pointer]
                    - button "3W, e1, triple word, empty" [ref=e149] [cursor=pointer]:
                      - generic [ref=e150]: 3W
                    - button "f1, empty" [ref=e151] [cursor=pointer]
                    - button "g1, empty" [ref=e152] [cursor=pointer]
                    - button "2L, h1, double letter, empty" [ref=e153] [cursor=pointer]:
                      - generic [ref=e154]: 2L
                    - button "i1, empty" [ref=e155] [cursor=pointer]
                    - button "j1, empty" [ref=e156] [cursor=pointer]
                    - button "3W, k1, triple word, empty" [ref=e157] [cursor=pointer]:
                      - generic [ref=e158]: 3W
                    - button "l1, empty" [ref=e159] [cursor=pointer]
                    - button "m1, empty" [ref=e160] [cursor=pointer]
                    - button "n1, empty" [ref=e161] [cursor=pointer]
                    - button "2L, o1, double letter, empty" [ref=e162] [cursor=pointer]:
                      - generic [ref=e163]: 2L
                    - generic [ref=e164]: "2"
                    - button "a2, empty" [ref=e165] [cursor=pointer]
                    - button "b2, empty" [ref=e166] [cursor=pointer]
                    - button "c2, empty" [ref=e167] [cursor=pointer]
                    - button "2L, d2, double letter, empty" [ref=e168] [cursor=pointer]:
                      - generic [ref=e169]: 2L
                    - button "e2, empty" [ref=e170] [cursor=pointer]
                    - button "f2, empty" [ref=e171] [cursor=pointer]
                    - button "2W, g2, double word, empty" [ref=e172] [cursor=pointer]:
                      - generic [ref=e173]: 2W
                    - button "h2, empty" [ref=e174] [cursor=pointer]
                    - button "2W, i2, double word, empty" [ref=e175] [cursor=pointer]:
                      - generic [ref=e176]: 2W
                    - button "j2, empty" [ref=e177] [cursor=pointer]
                    - button "k2, empty" [ref=e178] [cursor=pointer]
                    - button "2L, l2, double letter, empty" [ref=e179] [cursor=pointer]:
                      - generic [ref=e180]: 2L
                    - button "m2, empty" [ref=e181] [cursor=pointer]
                    - button "n2, empty" [ref=e182] [cursor=pointer]
                    - button "o2, empty" [ref=e183] [cursor=pointer]
                    - generic [ref=e184]: "3"
                    - button "a3, empty" [ref=e185] [cursor=pointer]
                    - button "b3, empty" [ref=e186] [cursor=pointer]
                    - button "c3, empty" [ref=e187] [cursor=pointer]
                    - button "d3, empty" [ref=e188] [cursor=pointer]
                    - button "3L, e3, triple letter, empty" [ref=e189] [cursor=pointer]:
                      - generic [ref=e190]: 3L
                    - button "f3, empty" [ref=e191] [cursor=pointer]
                    - button "g3, empty" [ref=e192] [cursor=pointer]
                    - button "h3, empty" [ref=e193] [cursor=pointer]
                    - button "i3, empty" [ref=e194] [cursor=pointer]
                    - button "j3, empty" [ref=e195] [cursor=pointer]
                    - button "3L, k3, triple letter, empty" [ref=e196] [cursor=pointer]:
                      - generic [ref=e197]: 3L
                    - button "l3, empty" [ref=e198] [cursor=pointer]
                    - button "m3, empty" [ref=e199] [cursor=pointer]
                    - button "n3, empty" [ref=e200] [cursor=pointer]
                    - button "o3, empty" [ref=e201] [cursor=pointer]
                    - generic [ref=e202]: "4"
                    - button "a4, empty" [ref=e203] [cursor=pointer]
                    - button "2L, b4, double letter, empty" [ref=e204] [cursor=pointer]:
                      - generic [ref=e205]: 2L
                    - button "c4, empty" [ref=e206] [cursor=pointer]
                    - button "2W, d4, double word, empty" [ref=e207] [cursor=pointer]:
                      - generic [ref=e208]: 2W
                    - button "e4, empty" [ref=e209] [cursor=pointer]
                    - button "f4, empty" [ref=e210] [cursor=pointer]
                    - button "g4, empty" [ref=e211] [cursor=pointer]
                    - button "h4, empty" [ref=e212] [cursor=pointer]
                    - button "i4, empty" [ref=e213] [cursor=pointer]
                    - button "j4, empty" [ref=e214] [cursor=pointer]
                    - button "k4, empty" [ref=e215] [cursor=pointer]
                    - button "2W, l4, double word, empty" [ref=e216] [cursor=pointer]:
                      - generic [ref=e217]: 2W
                    - button "m4, empty" [ref=e218] [cursor=pointer]
                    - button "2L, n4, double letter, empty" [ref=e219] [cursor=pointer]:
                      - generic [ref=e220]: 2L
                    - button "o4, empty" [ref=e221] [cursor=pointer]
                    - generic [ref=e222]: "5"
                    - button "3W, a5, triple word, empty" [ref=e223] [cursor=pointer]:
                      - generic [ref=e224]: 3W
                    - button "b5, empty" [ref=e225] [cursor=pointer]
                    - button "3L, c5, triple letter, empty" [ref=e226] [cursor=pointer]:
                      - generic [ref=e227]: 3L
                    - button "d5, empty" [ref=e228] [cursor=pointer]
                    - button "e5, empty" [ref=e229] [cursor=pointer]
                    - button "f5, empty" [ref=e230] [cursor=pointer]
                    - button "2L, g5, double letter, empty" [ref=e231] [cursor=pointer]:
                      - generic [ref=e232]: 2L
                    - button "h5, empty" [ref=e233] [cursor=pointer]
                    - button "2L, i5, double letter, empty" [ref=e234] [cursor=pointer]:
                      - generic [ref=e235]: 2L
                    - button "j5, empty" [ref=e236] [cursor=pointer]
                    - button "k5, empty" [ref=e237] [cursor=pointer]
                    - button "l5, empty" [ref=e238] [cursor=pointer]
                    - button "3L, m5, triple letter, empty" [ref=e239] [cursor=pointer]:
                      - generic [ref=e240]: 3L
                    - button "n5, empty" [ref=e241] [cursor=pointer]
                    - button "3W, o5, triple word, empty" [ref=e242] [cursor=pointer]:
                      - generic [ref=e243]: 3W
                    - generic [ref=e244]: "6"
                    - button "a6, empty" [ref=e245] [cursor=pointer]
                    - button "b6, empty" [ref=e246] [cursor=pointer]
                    - button "c6, empty" [ref=e247] [cursor=pointer]
                    - button "d6, empty" [ref=e248] [cursor=pointer]
                    - button "e6, empty" [ref=e249] [cursor=pointer]
                    - button "f6, empty" [ref=e250] [cursor=pointer]
                    - button "g6, empty" [ref=e251] [cursor=pointer]
                    - button "3L, h6, triple letter, empty" [ref=e252] [cursor=pointer]:
                      - generic [ref=e253]: 3L
                    - button "i6, empty" [ref=e254] [cursor=pointer]
                    - button "j6, empty" [ref=e255] [cursor=pointer]
                    - button "k6, empty" [ref=e256] [cursor=pointer]
                    - button "l6, empty" [ref=e257] [cursor=pointer]
                    - button "m6, empty" [ref=e258] [cursor=pointer]
                    - button "n6, empty" [ref=e259] [cursor=pointer]
                    - button "o6, empty" [ref=e260] [cursor=pointer]
                    - generic [ref=e261]: "7"
                    - button "a7, empty" [ref=e262] [cursor=pointer]
                    - button "2W, b7, double word, empty" [ref=e263] [cursor=pointer]:
                      - generic [ref=e264]: 2W
                    - button "c7, empty" [ref=e265] [cursor=pointer]
                    - button "d7, empty" [ref=e266] [cursor=pointer]
                    - button "2L, e7, double letter, empty" [ref=e267] [cursor=pointer]:
                      - generic [ref=e268]: 2L
                    - button "f7, empty" [ref=e269] [cursor=pointer]
                    - button "2L, g7, double letter, empty" [ref=e270] [cursor=pointer]:
                      - generic [ref=e271]: 2L
                    - button "h7, empty" [ref=e272] [cursor=pointer]
                    - button "2L, i7, double letter, empty" [ref=e273] [cursor=pointer]:
                      - generic [ref=e274]: 2L
                    - button "j7, empty" [ref=e275] [cursor=pointer]
                    - button "2L, k7, double letter, empty" [ref=e276] [cursor=pointer]:
                      - generic [ref=e277]: 2L
                    - button "l7, empty" [ref=e278] [cursor=pointer]
                    - button "m7, empty" [ref=e279] [cursor=pointer]
                    - button "2W, n7, double word, empty" [ref=e280] [cursor=pointer]:
                      - generic [ref=e281]: 2W
                    - button "o7, empty" [ref=e282] [cursor=pointer]
                    - generic [ref=e283]: "8"
                    - button "2L, a8, double letter, empty" [ref=e284] [cursor=pointer]:
                      - generic [ref=e285]: 2L
                    - button "b8, empty" [ref=e286] [cursor=pointer]
                    - button "c8, empty" [ref=e287] [cursor=pointer]
                    - button "d8, empty" [ref=e288] [cursor=pointer]
                    - button "e8, empty" [ref=e289] [cursor=pointer]
                    - button "3L, f8, triple letter, empty" [ref=e290] [cursor=pointer]:
                      - generic [ref=e291]: 3L
                    - button "C 3, g8, committed" [disabled] [ref=e292]:
                      - generic [ref=e293]: C
                      - generic [ref=e294]: "3"
                    - button "A 1, h8, committed" [disabled] [ref=e295]:
                      - generic [ref=e296]: A
                      - generic [ref=e297]: "1"
                    - button "T 1, i8, committed" [disabled] [ref=e298]:
                      - generic [ref=e299]: T
                      - generic [ref=e300]: "1"
                    - button "3L, j8, triple letter, empty" [ref=e301] [cursor=pointer]:
                      - generic [ref=e302]: 3L
                    - button "k8, empty" [ref=e303] [cursor=pointer]
                    - button "l8, empty" [ref=e304] [cursor=pointer]
                    - button "m8, empty" [ref=e305] [cursor=pointer]
                    - button "n8, empty" [ref=e306] [cursor=pointer]
                    - button "2L, o8, double letter, empty" [ref=e307] [cursor=pointer]:
                      - generic [ref=e308]: 2L
                    - generic [ref=e309]: "9"
                    - button "a9, empty" [ref=e310] [cursor=pointer]
                    - button "2W, b9, double word, empty" [ref=e311] [cursor=pointer]:
                      - generic [ref=e312]: 2W
                    - button "c9, empty" [ref=e313] [cursor=pointer]
                    - button "d9, empty" [ref=e314] [cursor=pointer]
                    - button "2L, e9, double letter, empty" [ref=e315] [cursor=pointer]:
                      - generic [ref=e316]: 2L
                    - button "f9, empty" [ref=e317] [cursor=pointer]
                    - button "2L, g9, double letter, empty" [ref=e318] [cursor=pointer]:
                      - generic [ref=e319]: 2L
                    - button "h9, empty" [ref=e320] [cursor=pointer]
                    - button "2L, i9, double letter, empty" [ref=e321] [cursor=pointer]:
                      - generic [ref=e322]: 2L
                    - button "j9, empty" [ref=e323] [cursor=pointer]
                    - button "2L, k9, double letter, empty" [ref=e324] [cursor=pointer]:
                      - generic [ref=e325]: 2L
                    - button "l9, empty" [ref=e326] [cursor=pointer]
                    - button "m9, empty" [ref=e327] [cursor=pointer]
                    - button "2W, n9, double word, empty" [ref=e328] [cursor=pointer]:
                      - generic [ref=e329]: 2W
                    - button "o9, empty" [ref=e330] [cursor=pointer]
                    - generic [ref=e331]: "10"
                    - button "a10, empty" [ref=e332] [cursor=pointer]
                    - button "b10, empty" [ref=e333] [cursor=pointer]
                    - button "c10, empty" [ref=e334] [cursor=pointer]
                    - button "d10, empty" [ref=e335] [cursor=pointer]
                    - button "e10, empty" [ref=e336] [cursor=pointer]
                    - button "f10, empty" [ref=e337] [cursor=pointer]
                    - button "g10, empty" [ref=e338] [cursor=pointer]
                    - button "3L, h10, triple letter, empty" [ref=e339] [cursor=pointer]:
                      - generic [ref=e340]: 3L
                    - button "i10, empty" [ref=e341] [cursor=pointer]
                    - button "j10, empty" [ref=e342] [cursor=pointer]
                    - button "k10, empty" [ref=e343] [cursor=pointer]
                    - button "l10, empty" [ref=e344] [cursor=pointer]
                    - button "m10, empty" [ref=e345] [cursor=pointer]
                    - button "n10, empty" [ref=e346] [cursor=pointer]
                    - button "o10, empty" [ref=e347] [cursor=pointer]
                    - generic [ref=e348]: "11"
                    - button "3W, a11, triple word, empty" [ref=e349] [cursor=pointer]:
                      - generic [ref=e350]: 3W
                    - button "b11, empty" [ref=e351] [cursor=pointer]
                    - button "3L, c11, triple letter, empty" [ref=e352] [cursor=pointer]:
                      - generic [ref=e353]: 3L
                    - button "d11, empty" [ref=e354] [cursor=pointer]
                    - button "e11, empty" [ref=e355] [cursor=pointer]
                    - button "f11, empty" [ref=e356] [cursor=pointer]
                    - button "2L, g11, double letter, empty" [ref=e357] [cursor=pointer]:
                      - generic [ref=e358]: 2L
                    - button "h11, empty" [ref=e359] [cursor=pointer]
                    - button "2L, i11, double letter, empty" [ref=e360] [cursor=pointer]:
                      - generic [ref=e361]: 2L
                    - button "j11, empty" [ref=e362] [cursor=pointer]
                    - button "k11, empty" [ref=e363] [cursor=pointer]
                    - button "l11, empty" [ref=e364] [cursor=pointer]
                    - button "3L, m11, triple letter, empty" [ref=e365] [cursor=pointer]:
                      - generic [ref=e366]: 3L
                    - button "n11, empty" [ref=e367] [cursor=pointer]
                    - button "3W, o11, triple word, empty" [ref=e368] [cursor=pointer]:
                      - generic [ref=e369]: 3W
                    - generic [ref=e370]: "12"
                    - button "a12, empty" [ref=e371] [cursor=pointer]
                    - button "2L, b12, double letter, empty" [ref=e372] [cursor=pointer]:
                      - generic [ref=e373]: 2L
                    - button "c12, empty" [ref=e374] [cursor=pointer]
                    - button "2W, d12, double word, empty" [ref=e375] [cursor=pointer]:
                      - generic [ref=e376]: 2W
                    - button "e12, empty" [ref=e377] [cursor=pointer]
                    - button "f12, empty" [ref=e378] [cursor=pointer]
                    - button "g12, empty" [ref=e379] [cursor=pointer]
                    - button "h12, empty" [ref=e380] [cursor=pointer]
                    - button "i12, empty" [ref=e381] [cursor=pointer]
                    - button "j12, empty" [ref=e382] [cursor=pointer]
                    - button "k12, empty" [ref=e383] [cursor=pointer]
                    - button "2W, l12, double word, empty" [ref=e384] [cursor=pointer]:
                      - generic [ref=e385]: 2W
                    - button "m12, empty" [ref=e386] [cursor=pointer]
                    - button "2L, n12, double letter, empty" [ref=e387] [cursor=pointer]:
                      - generic [ref=e388]: 2L
                    - button "o12, empty" [ref=e389] [cursor=pointer]
                    - generic [ref=e390]: "13"
                    - button "a13, empty" [ref=e391] [cursor=pointer]
                    - button "b13, empty" [ref=e392] [cursor=pointer]
                    - button "c13, empty" [ref=e393] [cursor=pointer]
                    - button "d13, empty" [ref=e394] [cursor=pointer]
                    - button "3L, e13, triple letter, empty" [ref=e395] [cursor=pointer]:
                      - generic [ref=e396]: 3L
                    - button "f13, empty" [ref=e397] [cursor=pointer]
                    - button "g13, empty" [ref=e398] [cursor=pointer]
                    - button "h13, empty" [ref=e399] [cursor=pointer]
                    - button "i13, empty" [ref=e400] [cursor=pointer]
                    - button "j13, empty" [ref=e401] [cursor=pointer]
                    - button "3L, k13, triple letter, empty" [ref=e402] [cursor=pointer]:
                      - generic [ref=e403]: 3L
                    - button "l13, empty" [ref=e404] [cursor=pointer]
                    - button "m13, empty" [ref=e405] [cursor=pointer]
                    - button "n13, empty" [ref=e406] [cursor=pointer]
                    - button "o13, empty" [ref=e407] [cursor=pointer]
                    - generic [ref=e408]: "14"
                    - button "a14, empty" [ref=e409] [cursor=pointer]
                    - button "b14, empty" [ref=e410] [cursor=pointer]
                    - button "c14, empty" [ref=e411] [cursor=pointer]
                    - button "2L, d14, double letter, empty" [ref=e412] [cursor=pointer]:
                      - generic [ref=e413]: 2L
                    - button "e14, empty" [ref=e414] [cursor=pointer]
                    - button "f14, empty" [ref=e415] [cursor=pointer]
                    - button "2W, g14, double word, empty" [ref=e416] [cursor=pointer]:
                      - generic [ref=e417]: 2W
                    - button "h14, empty" [ref=e418] [cursor=pointer]
                    - button "2W, i14, double word, empty" [ref=e419] [cursor=pointer]:
                      - generic [ref=e420]: 2W
                    - button "j14, empty" [ref=e421] [cursor=pointer]
                    - button "k14, empty" [ref=e422] [cursor=pointer]
                    - button "2L, l14, double letter, empty" [ref=e423] [cursor=pointer]:
                      - generic [ref=e424]: 2L
                    - button "m14, empty" [ref=e425] [cursor=pointer]
                    - button "n14, empty" [ref=e426] [cursor=pointer]
                    - button "o14, empty" [ref=e427] [cursor=pointer]
                    - generic [ref=e428]: "15"
                    - button "2L, a15, double letter, empty" [ref=e429] [cursor=pointer]:
                      - generic [ref=e430]: 2L
                    - button "b15, empty" [ref=e431] [cursor=pointer]
                    - button "c15, empty" [ref=e432] [cursor=pointer]
                    - button "d15, empty" [ref=e433] [cursor=pointer]
                    - button "3W, e15, triple word, empty" [ref=e434] [cursor=pointer]:
                      - generic [ref=e435]: 3W
                    - button "f15, empty" [ref=e436] [cursor=pointer]
                    - button "g15, empty" [ref=e437] [cursor=pointer]
                    - button "2L, h15, double letter, empty" [ref=e438] [cursor=pointer]:
                      - generic [ref=e439]: 2L
                    - button "i15, empty" [ref=e440] [cursor=pointer]
                    - button "j15, empty" [ref=e441] [cursor=pointer]
                    - button "3W, k15, triple word, empty" [ref=e442] [cursor=pointer]:
                      - generic [ref=e443]: 3W
                    - button "l15, empty" [ref=e444] [cursor=pointer]
                    - button "m15, empty" [ref=e445] [cursor=pointer]
                    - button "n15, empty" [ref=e446] [cursor=pointer]
                    - button "2L, o15, double letter, empty" [ref=e447] [cursor=pointer]:
                      - generic [ref=e448]: 2L
                - img "Whole board overview; outline shows the enlarged area" [ref=e449]
          - status [ref=e677]:
            - generic [ref=e678]:
              - generic [ref=e679]: "Amber: avery. Teal: jordan_plays."
              - text: Teal — to play · 83 tiles in the bag
          - generic [ref=e682]:
            - generic [ref=e686]:
              - generic [ref=e687]:
                - img "Amber" [ref=e688]
                - generic [ref=e689]: avery
              - generic [ref=e692]: 7 tiles
            - generic [ref=e693]:
              - generic [ref=e694]: Score
              - generic [ref=e695]: "10"
        - generic [ref=e698]:
          - group "Game actions" [ref=e699]:
            - button "Offer draw" [ref=e700] [cursor=pointer]:
              - paragraph [ref=e703]: Offer draw
            - button "Resign game" [ref=e704] [cursor=pointer]:
              - paragraph [ref=e707]:
                - text: Resign
                - generic [ref=e708]: game
          - button "History and stats" [ref=e709] [cursor=pointer]:
            - generic [ref=e711]:
              - paragraph [ref=e712]: History and stats
              - img [ref=e715]
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