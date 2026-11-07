# Integration repairs

- Initial 36-case native run: 26 reached pixel comparison; 10 failed native play. Setup's guidance selector read the Ship label (386.0625px phone/264px desktop), corrected by giving the actual guidance its stable identifier. All guidance bounds remain unchanged.
- Word Tiles overview now comprises the diagram and nine superimposed buttons. Moved the overview test identifier to their composite container; full bounds and corner containment still execute. The 132px diagram and all nine 44px controls remain.
- Added explicit local-score pre-input visibility and blank-open overview/button/Map corner checks. The latter extends the existing blank-chooser regression; its new geometry passed in the second native run, with no invented below-fold failure assigned.
- Second 14-case native run: 8 reached pixel comparisons, 6 failed local-score bounds (860.4375 phone, 869.78125 desktop). Compact-board spacing repair remains under verification.
- First aggregate repair run reported 94/96: UI CSS exceeded 500 code lines, and harness manifest tests overlapped a static rebuild. Extracted compact spacing into its own module; subsequent harness checks are serialized after builds. Logs retained, no waived limits or retries.
- A first native selection command matched no tests because of an anchored Playwright title filter. Its selection-error log is retained; no native execution or pass is attributed to it.

- Repair-2 native run: phone local score still ended at 856.4375; desktop ended at 841.78125, inside the browser height but clipped by the app's 828px scroll viewport. The full corner-hit assertion correctly rejected it. The next repair removes remaining compact session/column/board spacing; no assertion was relaxed.
- A desktop diagnostic attempted to use the already-stopped test server and received `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:6007/iframe.html?id=screens-games-word-tiles-board--your-turn&viewMode=story&globals=theme:light`. The diagnostic browser closed in finally. Reused the round6 self-owned diagnostic server adapter for the recorded desktop measurements; it closes both browser and server on completion.
- `bun obs last` was consulted before native diagnosis and reported no recent activity, no nearby activity, exit 1. No extra product logging was added.
