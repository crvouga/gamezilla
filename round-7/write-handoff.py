from pathlib import Path
import json,subprocess
r=Path(__file__).parent
read=lambda p:json.loads((r/p).read_text())
m=read('manifest.json');local=read('interactions/full-verify-verdict.json');native=m['runtime'];ubuntu=m['ubuntu'];pub=read('publication.json') if (r/'publication.json').exists() else None
media=pub['mediaSha'] if pub else 'This immutable media commit; exact SHA added in the publication receipt commit.'
checks=m['hostedChecks']['statusCheckRollup'];states=[f"{x.get('name',x.get('context','check'))}: {x.get('conclusion') or x.get('status') or x.get('state')}" for x in checks]
lines=['# Round-seven integrated evidence handoff','',f"Source: `{m['candidateSha']}`. Media: `{media}`. Evidence code: `{m['evidence_code']}`.",'','No scores or acceptance assigned. Two NEW independent reviews remain parent-owned. No manual QA, subagents, merge, PR watch or reference acceptance.','',
'## Source and repairs','',
'Integrated Word Tiles phone precision, nine coarse regions below the board, direct blank-letter entry, and Battleship responsive setup / precise targeting. Preserved parent readiness updates and explicit native registrations. Source paths and worker handoffs are indexed; root implementation notes were preserved in excluded evidence and removed from the checkout.',
'Native integration repaired desktop blank-letter overlap from expanded Fit/Enlarge hit areas, empty-premium label contrast (cream text on pale background), the setup guidance selector, composite overview hit target, and Word Tiles score/viewport layout. Full pre-input bounds and corner-hit assertions remain, including blank-open context and near-seat score. Failed runs and images are retained.',
'Hosted b8c60f7 shard 2 exposed an absent full-layout ship selector on the production phone default. 439536df1 adds visible Ship/Region gestures and precise bow placement to live and custom-game automation. The literal regression failed before repair, then passed. No timeout, retry, mode override, readiness bypass or spec edit. The targeting consumer audit found no stale four-quadrant indices; retained full-map keyboard targets remain interactive.',
'', '## Separate verification verdicts','',
'- Aggregate focused tasks: 96/96 passed. Repaired Battleship packages: 9/9 lint/typecheck/test tasks passed, including 43 component tests. ci:goals passed. See interactions/*final.log and consumer-package-logs.',
f"- Full local catalog: bun verify once on final source, failed at `{local['blockingTask']}`: `{local['message']}`. Reported counts: {local['reportedTaskCounts']}. No board spec edited. The public troubleshooting route requires ownership by its chart-owning change.",
f"- Native checks: {native['publicStatus']}",
f"- Local pixels: `{json.dumps(native['pixels'],sort_keys=True)}`. No baseline or tolerance waiver.",
f"- Hosted safety at receipt: {'; '.join(states)}. Exact-head snapshot and logs in interactions/pr-final-status.json and hosted-run-*.",
f"- Canonical Ubuntu: [{ubuntu['runId']}]({ubuntu['runUrl']}), `{ubuntu['status']}`, author `{ubuntu['authorStatus']}`, compare `{ubuntu['compareStatus']}`. References not accepted automatically; pending or failed is not a pass.",
'', '## Media and audit','',
f"{m['boardFamilies']} board families; {m['storyCount']} selected stories; {m['screenshots']} screenshots, light/dark at 390×844 and 1440×900; {m['beforeScreenshots']} immutable round-six before PNGs; {m['pairs']} pairs. {len(m['absentBeforeImages'])} new-state before images are absent and explicitly marked. Native desktop checks use 1440×844.",
f"{m['videoCount']} playable light-theme recordings for {m['videoJourneys']} journeys at both capture viewports. Each complete WebM has an assertion checkpoint log and intermediate frames. Exact checkpoint counts/durations are in journeys/recordings/video-manifest.json. Recorder pacing is automated, not human timing. Before/after human action counts are unknown, not inferred from assertions.",
'Round-six raw evidence remains immutable (8,217 manifest-bound files hash-checked). Before binding: source 863c687fae76c57527d495ec436afcf0ea99539a, media 60ff27e35a1a772884b05d9e64141fbebc42c73c, evidence 95e2cf5e91b0fcee.',
'The classifier audit corrected earlier axe failures mislabeled as pixel-only due to nearby code excerpts; interactions/classifier-audit.json contains prior and corrected counts. ARTIFACT_INDEX.md and artifact-inventory.json enumerate raw artifacts, including failed logs/images and superseded b8c60f7 results. archive-inventory.json records archive internals. Split verify diagnostics are reconstructable with ordered parts and SHA-256. No failed or interrupted native run is promoted to a final pass.',
'', '## Remaining limits','',
'Two new independent parent reviews, reference acceptance decision, and any outstanding hosted/canonical outcomes remain separate gates. The known outside-board troubleshooting chart ownership failure remains. On superseded head 4e6fa4c19, hosted Quoridor Hill party/health stalled after a refused move; the preserved diagnosis distinguishes move progression from record visibility and documents unchanged round-six ownership. See interactions/outside-scope/QUORIDOR_HILL_HOSTED_DIAGNOSIS.md; exact attempted action and rebase order remain unknown. Numberlink republication was not rerun without a repair; the round-six diagnosis is retained under interactions/outside-scope. Board fixtures establish no live persistence, transport, full-match, lexicon-service or app-update recovery claim.',
'', '## Publication receipts','']
if pub:
 lines += [f"[Manifest]({pub['manifest']}) · [Gallery]({pub['gallery']})"]+pub['comments']+['','publication-verification.json verifies exact comment bodies and pinned PNG/GIF/WebM bytes.']
else:lines+=['Publication receipt is written after this media commit is pushed; no unpublished URL is claimed as live.']
lines+=['',f"PR https://github.com/crvouga/gamezilla/pull/280, head {m['candidateSha']}, checks and reviews {'; '.join(states)}; two NEW independent reviews parent-owned."]
(r/'HANDOFF.md').write_text('\n'.join(lines)+'\n')
