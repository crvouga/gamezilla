from pathlib import Path
import json,subprocess,collections
r=Path(__file__).parent;head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
d=json.loads((r/'interactions/browser-classification.json').read_text());cases=d['cases']
functional=[e for e in cases if e['kind']=='interaction-or-accessibility'];assert not functional,[e['title'] for e in functional]
font=[e for e in cases if 'font readiness' in e['title']];instrumented=[e for e in cases if 'instrumented chess geometry' in e['title']];visual=[e for e in cases if 'font readiness' not in e['title'] and 'instrumented chess geometry' not in e['title']]
assert len(instrumented)==1 and instrumented[0]['kind']=='pass'
assert len(font)==8 and all(e['kind']=='pass' for e in font)
pixels=collections.Counter(e['kind'] for e in visual)
v={'candidateSha':head,'cases':len(cases),'visualCases':len(visual),'fontCases':len(font),'instrumentedGeometryRegression':{'passed':len(instrumented),'failed':0},
 'nativeReadinessPlayBrowserErrorsAxe':{'passed':len(visual),'failed':0},'fontChecks':{'passed':len(font),'failed':0},
 'pixels':dict(pixels),'sharedReferencesAcceptedOnMacOS':False,
 'viewports':[{'width':390,'height':844},{'width':1440,'height':844}],
 'command':'NODE_OPTIONS=--max-old-space-size=8192 bunx turbo run storybook:test --filter=@pkgs/ui-root-harness-ts --only --concurrency=1 -- --workers=2 --reporter=line,json --grep <pattern.txt>',
 'publicStatus':f'All {len(visual)} visual cases passed native readiness/play, browser-error and serious/critical axe stages; all {len(font)} controlled font checks passed. Local pixel comparisons remain separate and no macOS references were accepted. Full bun verify failed the pre-existing /more/troubleshooting statechart-owner rule. Hosted verify:end also failed the Numberlink library-navigation journey before board interaction. Two new independent reviews remain pending.'}
(r/'interactions/runtime-verdict.json').write_text(json.dumps(v,indent=2)+'\n')
j=json.loads((r/'journeys/mapping.json').read_text())
for e in j:
 prefix=e['stories'][0].split('--')[0]+'--';selected=[x for x in visual if x['title'].startswith(prefix)];counts=collections.Counter(x['kind'] for x in selected)
 e['status']=f"{len(selected)} canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: {counts['pass']} passed, {counts['pixel']} failed; no macOS acceptance."
 e['finalMatrix']={'cases':len(selected),'interactionAccessibilityFailures':0,'pixelFailures':counts['pixel'],'pixelPasses':counts['pass']}
 e['evidenceCodeRevision']=head
(r/'journeys/mapping.json').write_text(json.dumps(j,indent=2)+'\n')
print(json.dumps(v,indent=2))
