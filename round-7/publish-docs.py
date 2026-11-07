from pathlib import Path
import json,sys
r=Path(__file__).parent;sha=sys.argv[1];m=json.loads((r/'manifest.json').read_text());journeys=m['journeys']
base=f'https://raw.githubusercontent.com/crvouga/gamezilla/{sha}/round-7';repo=f'https://github.com/crvouga/gamezilla/blob/{sha}/round-7'
for part,entries in enumerate([journeys[:7],journeys[7:]],1):
 lines=[f'<!-- overhaul-loop:media-round-7-part-{part} -->',f'## Board round 7 — screenshots and videos, part {part}',f'Candidate `{m["candidateSha"]}` · evidence `{m["evidence_code"]}` · immutable media `{sha}`.',f'[Manifest]({repo}/manifest.json) · [Complete artifact index]({repo}/ARTIFACT_INDEX.md) · [Review inputs]({repo}/REVIEW_INPUTS.md) · [All screenshots]({repo}/GALLERY.md) · [Before/after pairs]({repo}/pairs) · [Exact outcomes and remaining gates]({repo}/HANDOFF.md)',m['publicStatus'],'Round-six images are the before state. Runtime/play/axe, pixel comparisons, full local verification, hosted safety and canonical Ubuntu reference acceptance have separate verdicts in the manifest. No ratings, manual QA, merge or PR watch.','Recordings are automated assertion replays with recorder-only pacing, not natural user timing. The visible animated previews are sampled from the pinned WebM videos at 2 fps; click a preview for its complete recording. These are not GitHub inline video players. Phone 390×844 and desktop 1440×900 captures, both screenshot themes; native checks use desktop 1440×844.','']
 for j in entries:
  story=j['representativeInteractionStories'][0]
  lines += [f'### {j["journeyId"]}: {j["component"]}',j['goal'],'','| View | Before | After |','|---|---|---|']
  for vp in ['phone','desktop']:
   for theme in ['light','dark']:
    f=f'{story}--{vp}--{theme}.png';before=f'![Before]({base}/before/{f})' if (r/'before'/f).exists() else '**New state; no round-six image**';lines.append(f'| {vp} · {theme} | {before} | ![After]({base}/after/{f}) |')
  lines += ['',f'**Checks:** {j["status"]}',f'**Limits:** {j["remainingJourneyGap"]}','']
  for video in j['representativeInteractionStories']:
   lines += [f'**Video — `{video}`**',f'[![Play recorded phone journey]({base}/journeys/recordings/{video}--phone--light.gif)]({base}/journeys/recordings/videos/{video}--phone--light.webm)',f'[Phone WebM]({base}/journeys/recordings/videos/{video}--phone--light.webm) · [Desktop WebM]({base}/journeys/recordings/videos/{video}--desktop--light.webm)','']
 (r/f'media-comment-{part}.md').write_text('\n'.join(lines)+'\n')
lines=['<!-- overhaul-loop:media-round-7-shared -->','## Round 7 — shared frame and secondary controls',f'Candidate `{m["candidateSha"]}` · evidence `{m["evidence_code"]}` · immutable media `{sha}`.',m['publicStatus'],'']
for story in ['screens-games-frame-geometry--four-players','screens-games-frame-geometry--long-name-rail','screens-games-frame-geometry--win','product-wordtileworkbench--secondary-tools']:
 lines += [f'### `{story}`','',f'![Phone light]({base}/after/{story}--phone--light.png)',f'![Desktop dark]({base}/after/{story}--desktop--dark.png)','']
 if story == 'product-wordtileworkbench--secondary-tools':
  lines += [f'[![Animated recording preview]({base}/journeys/recordings/{story}--phone--light.gif)]({base}/journeys/recordings/videos/{story}--phone--light.webm)',f'[Complete phone recording]({base}/journeys/recordings/videos/{story}--phone--light.webm) · [Desktop recording]({base}/journeys/recordings/videos/{story}--desktop--light.webm)','']
lines += ['Animations sample the asserted recordings at 2 fps. Replay pacing is automated, not natural user timing. See the immutable manifest for native geometry, pixel, Ubuntu and full-catalog outcomes.']
(r/'media-comment-3.md').write_text('\n'.join(lines)+'\n')
