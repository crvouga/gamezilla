import json,re,collections,sys
from pathlib import Path
r=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent/'interactions'
p=r/'browser-results.json'
if (r/'browser.log').exists():
 text=(r/'browser.log').read_text()
 text=re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',text)
 text='\n'.join(re.sub(r'^@pkgs/ui-root-harness-ts:storybook:test: ?', '',line) for line in text.splitlines())
 start=text.find('{\n  "config":')
 if start<0: raise Exception('No Playwright JSON report found')
 data,_=json.JSONDecoder().raw_decode(text[start:]);p.write_text(json.dumps(data,indent=2)+'\n')
else:data=json.loads(p.read_text())
entries=[]
def visit(suite):
 for spec in suite.get('specs',[]):
  for test in spec['tests']:
   for result in test['results']:
    errors=[x.get('message','') for x in result.get('errors',[])]
    kind='pass' if result['status']=='passed' else 'pixel' if errors and all('toHaveScreenshot' in e or 'snapshot' in e.lower() for e in errors) else 'interaction-or-accessibility'
    entries.append({'title':spec['title'],'status':result['status'],'kind':kind,'errors':errors,'attachments':result.get('attachments',[]),'durationMs':result['duration']})
 for child in suite.get('suites',[]):visit(child)
for s in data['suites']:visit(s)
(r/'browser-classification.json').write_text(json.dumps({'counts':dict(collections.Counter(e['kind'] for e in entries)),'cases':entries},indent=2)+'\n')
(r/'pixel-failures.json').write_text(json.dumps([e for e in entries if e['kind']=='pixel'],indent=2)+'\n')
(r/'interaction-failures.json').write_text(json.dumps([e for e in entries if e['kind']=='interaction-or-accessibility'],indent=2)+'\n')
print(collections.Counter(e['kind'] for e in entries))
for e in entries:
 if e['kind']=='interaction-or-accessibility': print(e['title'], e['errors'][0][:700])
